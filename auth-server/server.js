require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const sql = require('mssql');
const { v4: uuidv4 } = require('uuid');
const { OAuth2Client } = require('google-auth-library');
const axios = require('axios');

const app = express();
const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET || 'sso_demo_secret';
const CLIENT_CALLBACK_URL = process.env.CLIENT_CALLBACK_URL || 'http://localhost:3000/auth/sso/callback';

function cleanEnv(value) {
  return String(value || '').trim().replace(/^[\s'\"`]+|[\s'\"`]+$/g, '');
}

function normalizeRedirectUri(value) {
  let uri = cleanEnv(value || 'http://localhost:4000/auth/google/callback');
  // Chống lỗi cấu hình nhầm dạng: http:'''//localhost:4000/auth/google/callback
  uri = uri.replace(/^http:['\"`]+\/\//, 'http://');
  uri = uri.replace(/^https:['\"`]+\/\//, 'https://');
  return uri;
}

const GOOGLE_CLIENT_ID = cleanEnv(process.env.GOOGLE_CLIENT_ID);
const GOOGLE_CLIENT_SECRET = cleanEnv(process.env.GOOGLE_CLIENT_SECRET);
const GOOGLE_REDIRECT_URI = normalizeRedirectUri(process.env.GOOGLE_REDIRECT_URI);

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'auth_session_secret',
  resave: false,
  saveUninitialized: false
}));

const dbBase = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'YourStrong!Passw0rd',
  server: process.env.DB_SERVER || 'localhost',
  port: Number(process.env.DB_PORT || 1433),
  options: {
    encrypt: String(process.env.DB_ENCRYPT || 'false') === 'true',
    trustServerCertificate: String(process.env.DB_TRUST_SERVER_CERTIFICATE || 'true') === 'true'
  }
};
const DB_NAME = process.env.DB_NAME || 'SsoDemoDb';
let pool;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function connectWithRetry(config, retries = 30) {
  let last;
  for (let i = 0; i < retries; i++) {
    try {
      return await new sql.ConnectionPool(config).connect();
    } catch (err) {
      last = err;
      console.log(`DB chưa sẵn sàng, thử lại ${i + 1}/${retries}: ${err.message}`);
      await sleep(3000);
    }
  }
  throw last;
}

async function initDb() {
  const masterPool = await connectWithRetry({ ...dbBase, database: 'master' });
  await masterPool.request().query(`
    IF DB_ID(N'${DB_NAME}') IS NULL
    BEGIN
      CREATE DATABASE [${DB_NAME}];
    END
  `);
  await masterPool.close();

  pool = await connectWithRetry({ ...dbBase, database: DB_NAME });
  await pool.request().query(`
    IF OBJECT_ID('dbo.Users', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Users (
        id INT IDENTITY(1,1) PRIMARY KEY,
        provider NVARCHAR(30) NOT NULL,
        username NVARCHAR(100) NULL,
        email NVARCHAR(255) NOT NULL,
        password_hash NVARCHAR(255) NULL,
        google_sub NVARCHAR(255) NULL,
        name NVARCHAR(255) NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
      );
      CREATE UNIQUE INDEX UX_Users_Email_Provider ON dbo.Users(email, provider);
      CREATE UNIQUE INDEX UX_Users_Username ON dbo.Users(username) WHERE username IS NOT NULL;
    END

    IF OBJECT_ID('dbo.UserSessions', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.UserSessions (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL,
        session_id NVARCHAR(255) NOT NULL UNIQUE,
        provider NVARCHAR(30) NOT NULL,
        is_active BIT NOT NULL DEFAULT 1,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        expires_at DATETIME2 NOT NULL,
        revoked_at DATETIME2 NULL,
        CONSTRAINT FK_UserSessions_Users FOREIGN KEY (user_id) REFERENCES dbo.Users(id)
      );
    END
  `);

  const existing = await pool.request()
    .input('username', sql.NVarChar, 'admin')
    .query('SELECT id FROM dbo.Users WHERE username = @username');
  if (existing.recordset.length === 0) {
    const hash = await bcrypt.hash('123456', 10);
    await pool.request()
      .input('provider', sql.NVarChar, 'local')
      .input('username', sql.NVarChar, 'admin')
      .input('email', sql.NVarChar, 'admin@example.com')
      .input('password_hash', sql.NVarChar, hash)
      .input('name', sql.NVarChar, 'Admin User')
      .query(`INSERT INTO dbo.Users(provider, username, email, password_hash, name)
              VALUES(@provider, @username, @email, @password_hash, @name)`);
    console.log('Đã tạo tài khoản demo admin / 123456');
  }
}

function publicUser(row) {
  return {
    id: row.id,
    provider: row.provider,
    username: row.username,
    email: row.email,
    name: row.name
  };
}

async function createTokenForUser(user) {
  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await pool.request()
    .input('user_id', sql.Int, user.id)
    .input('session_id', sql.NVarChar, sessionId)
    .input('provider', sql.NVarChar, user.provider)
    .input('expires_at', sql.DateTime2, expiresAt)
    .query(`INSERT INTO dbo.UserSessions(user_id, session_id, provider, expires_at)
            VALUES(@user_id, @session_id, @provider, @expires_at)`);

  const token = jwt.sign({
    sub: user.id,
    provider: user.provider,
    username: user.username,
    email: user.email,
    name: user.name,
    session_id: sessionId
  }, JWT_SECRET, { expiresIn: '1h' });
  return { access_token: token, token_type: 'Bearer', user: publicUser(user), session_id: sessionId };
}

async function verifyBearer(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Thiếu token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.tokenPayload = payload;
    next();
  } catch {
    res.status(401).json({ message: 'Token không hợp lệ' });
  }
}

app.get('/health', (req, res) => res.json({ ok: true, service: 'auth-server' }));

app.get('/debug/google-config', (req, res) => {
  res.json({
    configured: Boolean(googleConfigured()),
    client_id: GOOGLE_CLIENT_ID,
    client_secret_loaded: Boolean(GOOGLE_CLIENT_SECRET),
    redirect_uri: GOOGLE_REDIRECT_URI,
    encoded_redirect_uri: encodeURIComponent(GOOGLE_REDIRECT_URI),
    callback_url: CLIENT_CALLBACK_URL,
    auth_uri: GOOGLE_AUTH_URI,
    token_uri: GOOGLE_TOKEN_URI
  });
});

app.post('/register', async (req, res) => {
  const { name, email, username, password } = req.body;
  if (!name || !email || !username || !password) return res.status(400).json({ message: 'Thiếu thông tin đăng ký' });
  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.request()
      .input('provider', sql.NVarChar, 'local')
      .input('username', sql.NVarChar, username)
      .input('email', sql.NVarChar, email)
      .input('password_hash', sql.NVarChar, hash)
      .input('name', sql.NVarChar, name)
      .query(`INSERT INTO dbo.Users(provider, username, email, password_hash, name)
              VALUES(@provider, @username, @email, @password_hash, @name)`);
    res.json({ message: 'Đăng ký thành công' });
  } catch (err) {
    res.status(409).json({ message: 'Username hoặc email đã tồn tại' });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const result = await pool.request()
    .input('username', sql.NVarChar, username)
    .query(`SELECT * FROM dbo.Users WHERE provider = 'local' AND username = @username`);
  const user = result.recordset[0];
  if (!user) return res.status(401).json({ message: 'Tài khoản chưa đăng ký hoặc sai thông tin' });
  const ok = await bcrypt.compare(password || '', user.password_hash || '');
  if (!ok) return res.status(401).json({ message: 'Sai mật khẩu' });
  res.json(await createTokenForUser(user));
});

app.post('/verify', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ valid: false, message: 'Thiếu token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const session = await pool.request()
      .input('session_id', sql.NVarChar, payload.session_id)
      .query(`SELECT * FROM dbo.UserSessions WHERE session_id = @session_id`);
    const s = session.recordset[0];
    if (!s) return res.status(401).json({ valid: false, message: 'Session không tồn tại' });
    if (!s.is_active) return res.status(401).json({ valid: false, message: 'Session đã bị thu hồi' });
    if (new Date(s.expires_at).getTime() < Date.now()) return res.status(401).json({ valid: false, message: 'Session hết hạn' });
    res.json({ valid: true, user: { id: payload.sub, provider: payload.provider, username: payload.username, email: payload.email, name: payload.name, session_id: payload.session_id } });
  } catch {
    res.status(401).json({ valid: false, message: 'Token không hợp lệ' });
  }
});

app.post('/logout', verifyBearer, async (req, res) => {
  await pool.request()
    .input('session_id', sql.NVarChar, req.tokenPayload.session_id)
    .query(`UPDATE dbo.UserSessions SET is_active = 0, revoked_at = SYSDATETIME() WHERE session_id = @session_id`);
  res.json({ message: 'Đã logout toàn hệ thống' });
});

app.get('/sessions/me', verifyBearer, async (req, res) => {
  const result = await pool.request()
    .input('session_id', sql.NVarChar, req.tokenPayload.session_id)
    .query(`SELECT TOP 1 session_id, user_id, provider, is_active, created_at, expires_at, revoked_at
            FROM dbo.UserSessions WHERE session_id = @session_id`);
  res.json({ session: result.recordset[0] || null });
});

app.get('/debug/users', async (req, res) => {
  const result = await pool.request().query('SELECT id, provider, username, email, name, created_at FROM dbo.Users ORDER BY id DESC');
  res.json(result.recordset);
});
app.get('/debug/sessions', async (req, res) => {
  const result = await pool.request().query('SELECT TOP 50 * FROM dbo.UserSessions ORDER BY id DESC');
  res.json(result.recordset);
});

function googleConfigured() {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI);
}

const GOOGLE_AUTH_URI = cleanEnv(process.env.GOOGLE_AUTH_URI || 'https://accounts.google.com/o/oauth2/v2/auth');
const GOOGLE_TOKEN_URI = cleanEnv(process.env.GOOGLE_TOKEN_URI || 'https://oauth2.googleapis.com/token');

function googleClient() {
  return new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}

function encodeState(mode) {
  return Buffer.from(JSON.stringify({ mode, ts: Date.now() })).toString('base64url');
}

function decodeState(value) {
  if (!value) return { mode: 'login' };
  // Hỗ trợ cả state cũ dạng "login" / "register".
  if (value === 'login' || value === 'register') return { mode: value };
  try {
    return JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'));
  } catch {
    return { mode: 'login' };
  }
}

function buildGoogleAuthUrl(mode) {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
    state: encodeState(mode)
  });
  return `${GOOGLE_AUTH_URI}?${params.toString()}`;
}

app.get('/debug/google-url/:mode', (req, res) => {
  const mode = req.params.mode === 'register' ? 'register' : 'login';
  const url = googleConfigured() ? buildGoogleAuthUrl(mode) : null;
  res.json({
    configured: googleConfigured(),
    mode,
    client_id: GOOGLE_CLIENT_ID,
    client_secret_loaded: Boolean(GOOGLE_CLIENT_SECRET),
    redirect_uri: GOOGLE_REDIRECT_URI,
    encoded_redirect_uri: encodeURIComponent(GOOGLE_REDIRECT_URI),
    auth_url: url,
    auth_url_contains_bad_quotes: url ? url.includes('%27') || url.includes("'") : false
  });
});


// Google Identity Services flow: frontend receives a Google ID token and sends it here.
// This avoids redirect_uri/callback loops in local Docker environments.
app.post('/auth/google/id-token', async (req, res) => {
  try {
    const { credential, mode: rawMode } = req.body || {};
    const mode = rawMode === 'register' ? 'register' : 'login';

    if (!GOOGLE_CLIENT_ID) {
      return res.status(500).json({ message: 'Chưa cấu hình GOOGLE_CLIENT_ID' });
    }
    if (!credential) {
      return res.status(400).json({ message: 'Thiếu Google credential/id_token' });
    }

    const ticket = await new OAuth2Client(GOOGLE_CLIENT_ID).verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID
    });

    const info = ticket.getPayload();
    console.log('[GOOGLE_ID_TOKEN_USER]', { mode, email: info?.email, name: info?.name, sub: info?.sub });

    if (!info || !info.email) {
      return res.status(401).json({ message: 'Không lấy được email từ Google' });
    }

    let result = await pool.request()
      .input('provider', sql.NVarChar, 'google')
      .input('email', sql.NVarChar, info.email)
      .query('SELECT * FROM dbo.Users WHERE provider = @provider AND email = @email');

    let user = result.recordset[0];

    if (mode === 'login' && !user) {
      return res.status(401).json({ message: 'Google account chưa đăng ký. Hãy vào tab Đăng ký và bấm Đăng ký bằng Google SSO trước.' });
    }

    if (mode === 'register' && !user) {
      await pool.request()
        .input('provider', sql.NVarChar, 'google')
        .input('username', sql.NVarChar, info.email)
        .input('email', sql.NVarChar, info.email)
        .input('google_sub', sql.NVarChar, info.sub)
        .input('name', sql.NVarChar, info.name || info.email)
        .query(`INSERT INTO dbo.Users(provider, username, email, google_sub, name)
                VALUES(@provider, @username, @email, @google_sub, @name)`);

      result = await pool.request()
        .input('provider', sql.NVarChar, 'google')
        .input('email', sql.NVarChar, info.email)
        .query('SELECT * FROM dbo.Users WHERE provider = @provider AND email = @email');

      user = result.recordset[0];
    }

    const tokenData = await createTokenForUser(user);
    res.json(tokenData);
  } catch (err) {
    console.error('[GOOGLE_ID_TOKEN_ERROR]', err);
    res.status(401).json({ message: err.message || 'Google SSO thất bại' });
  }
});

app.get('/auth/google/:mode', (req, res) => {
  if (!googleConfigured()) {
    return res.status(500).send('Chưa cấu hình GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET trong .env');
  }

  const mode = req.params.mode === 'register' ? 'register' : 'login';
  const url = buildGoogleAuthUrl(mode);

  console.log('[GOOGLE_AUTH_START]', {
    mode,
    clientId: GOOGLE_CLIENT_ID,
    redirectUri: GOOGLE_REDIRECT_URI,
    encodedRedirectUri: encodeURIComponent(GOOGLE_REDIRECT_URI),
    authUrlContainsBadQuotes: url.includes('%27') || url.includes("'")
  });

  res.redirect(url);
});

app.get('/auth/google/callback', async (req, res) => {
  console.log('[GOOGLE_CALLBACK_QUERY]', req.query);

  try {
    if (!googleConfigured()) return res.status(500).send('Chưa cấu hình Google OAuth');

    if (req.query.error) {
      return res.redirect(`${CLIENT_CALLBACK_URL}?error=${encodeURIComponent('Google OAuth error: ' + req.query.error)}`);
    }

    if (!req.query.code) {
      return res.redirect(`${CLIENT_CALLBACK_URL}?error=${encodeURIComponent('Google không trả về authorization code')}`);
    }

    const state = decodeState(req.query.state);
    const mode = state.mode === 'register' ? 'register' : 'login';
    console.log('[GOOGLE_CALLBACK_MODE]', mode);

    // Đổi authorization code lấy token thủ công để đảm bảo redirect_uri gửi lên Google
    // luôn chính xác 100%, không bị thư viện tự biến đổi.
    const tokenResponse = await axios.post(
      GOOGLE_TOKEN_URI,
      new URLSearchParams({
        code: String(req.query.code),
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code'
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const tokens = tokenResponse.data;
    if (!tokens.id_token) {
      return res.redirect(`${CLIENT_CALLBACK_URL}?error=${encodeURIComponent('Google không trả về id_token')}`);
    }

    const ticket = await googleClient().verifyIdToken({
      idToken: tokens.id_token,
      audience: GOOGLE_CLIENT_ID
    });

    const info = ticket.getPayload();
    if (!info || !info.email) {
      return res.redirect(`${CLIENT_CALLBACK_URL}?error=${encodeURIComponent('Không lấy được email từ Google')}`);
    }

    console.log('[GOOGLE_USER_INFO]', { email: info.email, name: info.name, sub: info.sub });

    let result = await pool.request()
      .input('provider', sql.NVarChar, 'google')
      .input('email', sql.NVarChar, info.email)
      .query('SELECT * FROM dbo.Users WHERE provider = @provider AND email = @email');

    let user = result.recordset[0];

    if (mode === 'login' && !user) {
      return res.redirect(`${CLIENT_CALLBACK_URL}?error=${encodeURIComponent('Google account chưa đăng ký. Hãy vào tab Đăng ký và bấm Đăng ký bằng Google SSO trước.')}`);
    }

    if (mode === 'register' && !user) {
      await pool.request()
        .input('provider', sql.NVarChar, 'google')
        .input('username', sql.NVarChar, info.email)
        .input('email', sql.NVarChar, info.email)
        .input('google_sub', sql.NVarChar, info.sub)
        .input('name', sql.NVarChar, info.name || info.email)
        .query(`INSERT INTO dbo.Users(provider, username, email, google_sub, name)
                VALUES(@provider, @username, @email, @google_sub, @name)`);

      result = await pool.request()
        .input('provider', sql.NVarChar, 'google')
        .input('email', sql.NVarChar, info.email)
        .query('SELECT * FROM dbo.Users WHERE provider = @provider AND email = @email');

      user = result.recordset[0];
    }

    const tokenData = await createTokenForUser(user);
    res.redirect(`${CLIENT_CALLBACK_URL}?token=${encodeURIComponent(tokenData.access_token)}`);
  } catch (err) {
    const detail = err.response?.data || err.message || err;
    console.error('[GOOGLE_CALLBACK_ERROR]', detail);
    const message = typeof detail === 'string' ? detail : (detail.error_description || detail.error || 'Google callback error');
    res.redirect(`${CLIENT_CALLBACK_URL}?error=${encodeURIComponent(message)}`);
  }
});

initDb().then(() => {
  app.listen(PORT, () => {
    console.log('[GOOGLE_CONFIG]', {
      configured: Boolean(googleConfigured()),
      clientId: GOOGLE_CLIENT_ID,
      redirectUri: GOOGLE_REDIRECT_URI,
      encodedRedirectUri: encodeURIComponent(GOOGLE_REDIRECT_URI)
    });
    console.log(`Auth Server running at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Không thể khởi tạo Auth Server:', err);
  process.exit(1);
});
