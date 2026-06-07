const express = require('express');
const session = require('express-session');
const axios = require('axios');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const AUTH_INTERNAL = process.env.AUTH_SERVER_INTERNAL || 'http://localhost:4000';
const AUTH_PUBLIC = process.env.AUTH_SERVER_PUBLIC || 'http://localhost:4000';
const TIMETABLE = process.env.TIMETABLE_SERVICE_INTERNAL || 'http://localhost:5000';
const COURSE = process.env.COURSE_SERVICE_INTERNAL || 'http://localhost:6000';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'client_session_secret',
  resave: false,
  saveUninitialized: false
}));

function requireLogin(req, res, next) {
  if (req.session.accessToken && req.session.user) return next();
  res.redirect('/?message=' + encodeURIComponent('Vui lòng đăng nhập trước.'));
}
function tokenHeader(req) { return { Authorization: `Bearer ${req.session.accessToken}` }; }
function escapeHtml(s = '') {
  return String(s).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}
function layout({ title = 'SSO Student Portal', user = null, body = '', message = '', error = '' }) {
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title><style>
:root{--bg1:#eef2ff;--bg2:#f8fafc;--card:#fff;--text:#0f172a;--muted:#64748b;--border:#e2e8f0;--primary:#2563eb;--primary2:#4f46e5;--danger:#dc2626;--soft:#eff6ff;--shadow:0 22px 70px rgba(15,23,42,.12)}*{box-sizing:border-box}body{margin:0;font-family:Inter,Arial,sans-serif;color:var(--text);background:linear-gradient(135deg,var(--bg1),var(--bg2));min-height:100vh}.container{width:min(1120px,calc(100% - 32px));margin:0 auto}.auth-page{min-height:100vh;display:grid;place-items:center;padding:34px 0}.auth-shell{width:min(1020px,100%);display:grid;grid-template-columns:1.05fr .95fr;background:#fff;border:1px solid var(--border);border-radius:30px;overflow:hidden;box-shadow:var(--shadow)}.hero{padding:58px;color:#fff;background:radial-gradient(circle at top right,rgba(255,255,255,.18),transparent 35%),linear-gradient(135deg,var(--primary),var(--primary2))}.badge{display:inline-flex;gap:8px;padding:9px 13px;border-radius:999px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.22);font-weight:800;font-size:13px}.hero h1{margin:26px 0 14px;font-size:43px;line-height:1.08;letter-spacing:-.045em}.hero p{margin:0;color:rgba(255,255,255,.86);line-height:1.7}.flow{margin-top:34px;display:grid;gap:13px}.flow-item{display:flex;align-items:center;gap:12px;color:rgba(255,255,255,.92);font-size:14px}.num{width:30px;height:30px;border-radius:999px;background:rgba(255,255,255,.18);display:grid;place-items:center;font-weight:900;flex:none}.auth-box{padding:48px}.tabs{display:flex;padding:5px;border-radius:16px;background:#f1f5f9;margin-bottom:26px}.tab{flex:1;border:none;border-radius:12px;padding:12px;background:transparent;color:var(--muted);font-weight:900;cursor:pointer;text-align:center;text-decoration:none}.tab.active{background:#fff;color:var(--primary);box-shadow:0 8px 20px rgba(15,23,42,.08)}h2{margin:0 0 8px;font-size:29px;letter-spacing:-.035em}.sub{margin:0 0 22px;color:var(--muted);line-height:1.6}label{display:block;margin:15px 0 8px;font-size:14px;font-weight:800}input,select{width:100%;border:1px solid var(--border);border-radius:15px;padding:13px 14px;font-size:15px;outline:none;background:#fff}input:focus,select:focus{border-color:var(--primary);box-shadow:0 0 0 4px rgba(37,99,235,.12)}.btn{border:none;border-radius:15px;padding:13px 18px;display:inline-flex;justify-content:center;align-items:center;gap:9px;cursor:pointer;text-decoration:none;font-weight:900;font-size:15px;transition:.18s ease}.btn:hover{transform:translateY(-1px)}.btn-primary{background:var(--primary);color:#fff}.btn-primary:hover{background:#1d4ed8}.btn-block{width:100%;margin-top:20px}.btn-light{background:#f1f5f9;color:var(--text)}.btn-light:hover{background:#e2e8f0}.btn-outline{background:#fff;color:var(--text);border:1px solid var(--border);width:100%;margin-top:12px}.btn-danger{background:#fee2e2;color:#991b1b}.divider{display:flex;align-items:center;gap:12px;margin:22px 0 8px;color:var(--muted);font-size:14px}.divider:before,.divider:after{content:"";height:1px;background:var(--border);flex:1}.notice{margin:14px 0;border-radius:15px;padding:12px 14px;line-height:1.5;font-size:14px}.notice.success{color:#166534;background:#dcfce7}.notice.error{color:#991b1b;background:#fee2e2}.notice.info{color:#1e3a8a;background:#dbeafe}.navbar{position:sticky;top:0;z-index:9;background:rgba(255,255,255,.86);backdrop-filter:blur(14px);border-bottom:1px solid var(--border)}.nav-inner{min-height:74px;display:flex;align-items:center;justify-content:space-between;gap:14px}.brand{display:flex;align-items:center;gap:12px;font-size:20px;font-weight:950;letter-spacing:-.03em}.logo{width:43px;height:43px;border-radius:15px;background:var(--primary);color:#fff;display:grid;place-items:center;font-weight:950}.nav-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.main{padding:38px 0 64px}.panel,.feature{background:#fff;border:1px solid var(--border);border-radius:26px;box-shadow:0 18px 55px rgba(15,23,42,.07);padding:28px}.panel h1{margin:0 0 10px;font-size:34px;letter-spacing:-.04em}.panel p,.feature p{color:var(--muted);line-height:1.65;margin:0}.welcome{display:grid;grid-template-columns:1.3fr .7fr;gap:22px;margin-bottom:22px}.user-card{display:flex;align-items:center;gap:14px}.avatar{width:58px;height:58px;border-radius:19px;background:var(--soft);color:var(--primary);display:grid;place-items:center;font-size:23px;font-weight:950}.status-pill{display:inline-flex;margin-top:8px;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:900;background:#dcfce7;color:#166534}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:22px}.feature-icon{width:54px;height:54px;border-radius:18px;display:grid;place-items:center;font-size:27px;background:var(--soft);margin-bottom:17px}.feature h3{margin:0 0 9px;font-size:22px}.feature .btn{margin-top:20px}.toolbar{display:flex;align-items:end;gap:12px;margin-top:20px;flex-wrap:wrap}.field{width:260px}table{width:100%;margin-top:20px;border-collapse:collapse;background:#fff;border-radius:18px;overflow:hidden}th,td{padding:15px 16px;border-bottom:1px solid var(--border);text-align:left}th{background:#f8fafc;color:var(--muted);font-size:12px;letter-spacing:.06em;text-transform:uppercase}tr:last-child td{border-bottom:none}.small-note{margin-top:14px;font-size:13px;color:var(--muted)}@media(max-width:880px){.auth-shell,.welcome,.grid{grid-template-columns:1fr}.hero,.auth-box,.panel,.feature{padding:30px}.nav-inner{padding:16px 0;align-items:flex-start;flex-direction:column}.field{width:100%}.toolbar .btn{width:100%!important}}
</style></head><body>${user ? nav(user) : ''}${body}</body></html>`;
}
function nav(user) {
  return `<nav class="navbar"><div class="container nav-inner"><div class="brand"><div class="logo">S</div> SSO Student Portal</div><div class="nav-actions"><a class="btn btn-light" href="/dashboard">Trang chủ</a><a class="btn btn-light" href="/timetable">Thời khóa biểu</a><a class="btn btn-light" href="/courses">Môn học</a><a class="btn btn-light" href="/session">Phiên đăng nhập</a><form method="POST" action="/logout" style="margin:0"><button class="btn btn-danger">Đăng xuất</button></form></div></div></nav>`;
}
function authPage({ mode = 'login', message = '', error = '' }) {
  const isLogin = mode !== 'register';
  const googleMode = isLogin ? 'login' : 'register';
  const googleText = isLogin ? 'Đăng nhập bằng Google' : 'Đăng ký bằng Google SSO';
  const googleButton = GOOGLE_CLIENT_ID
    ? `<div id="google-button" style="display:flex;justify-content:center;margin-top:12px"></div>
       <script src="https://accounts.google.com/gsi/client" async defer></script>
       <script>
        window.onload = function () {
          if (!window.google || !google.accounts || !google.accounts.id) {
            document.getElementById('google-error').innerText = 'Không tải được Google Identity Services.';
            return;
          }
          google.accounts.id.initialize({
            client_id: ${JSON.stringify(GOOGLE_CLIENT_ID)},
            callback: async function (response) {
              const box = document.getElementById('google-error');
              box.innerText = 'Đang xử lý Google SSO...';
              try {
                const rs = await fetch('/google-sso', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ mode: ${JSON.stringify(googleMode)}, credential: response.credential })
                });
                const data = await rs.json();
                if (!rs.ok || !data.ok) {
                  box.innerText = data.message || 'Google SSO thất bại';
                  return;
                }
                window.location.href = data.redirect || '/dashboard';
              } catch (err) {
                box.innerText = 'Không gọi được Google SSO endpoint.';
              }
            }
          });
          google.accounts.id.renderButton(
            document.getElementById('google-button'),
            { theme: 'outline', size: 'large', text: ${JSON.stringify(isLogin ? 'signin_with' : 'signup_with')}, width: 320 }
          );
        };
       </script>
       <div id="google-error" class="small-note" style="color:#991b1b;text-align:center"></div>`
    : `<div class="notice error">Chưa cấu hình GOOGLE_CLIENT_ID trong .env</div>`;

  const form = isLogin
    ? `<h2>Đăng nhập</h2><p class="sub">Dùng tài khoản đã đăng ký để vào hệ thống.</p><form method="POST" action="/login"><label>Tên đăng nhập</label><input name="username" value="admin" placeholder="admin"/><label>Mật khẩu</label><input name="password" value="123456" type="password"/><button class="btn btn-primary btn-block">Đăng nhập</button></form><div class="divider">hoặc</div>${googleButton}`
    : `<h2>Đăng ký tài khoản</h2><p class="sub">Tài khoản phải được đăng ký trước khi đăng nhập.</p><form method="POST" action="/register"><label>Họ tên</label><input name="name" value="Nguyễn Văn A"/><label>Email</label><input name="email" value="student@example.com"/><label>Tên đăng nhập</label><input name="username" value="student01"/><label>Mật khẩu</label><input name="password" value="123456" type="password"/><button class="btn btn-primary btn-block">Tạo tài khoản</button></form><div class="divider">hoặc</div>${googleButton}`;

  return layout({ body: `<section class="auth-page"><div class="container"><div class="auth-shell"><div class="hero"><div class="badge">🔐 SSO Student Portal</div><h1>Đăng nhập một lần, dùng nhiều dịch vụ.</h1><p>Auth Server quản lý tài khoản và phiên trung tâm. Sau khi đăng nhập, người dùng dùng được Timetable Service và Course Service mà không cần đăng nhập lại.</p><div class="flow"><div class="flow-item"><span class="num">1</span>Đăng ký hoặc đăng nhập tại Auth Server</div><div class="flow-item"><span class="num">2</span>Auth Server tạo access token và session trung tâm</div><div class="flow-item"><span class="num">3</span>Các service xác minh token trước khi trả dữ liệu</div><div class="flow-item"><span class="num">4</span>Logout sẽ thu hồi phiên dùng chung</div></div></div><div class="auth-box"><div class="tabs"><a class="tab ${isLogin ? 'active' : ''}" href="/">Đăng nhập</a><a class="tab ${!isLogin ? 'active' : ''}" href="/register">Đăng ký</a></div>${message ? `<div class="notice info">${escapeHtml(message)}</div>` : ''}${error ? `<div class="notice error">${escapeHtml(error)}</div>` : ''}${form}</div></div></div></section>` });
}

app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.send(authPage({ mode: 'login', message: req.query.message, error: req.query.error }));
});
app.get('/register', (req, res) => res.send(authPage({ mode: 'register', message: req.query.message, error: req.query.error })));
app.post('/register', async (req, res) => {
  try {
    await axios.post(`${AUTH_INTERNAL}/register`, req.body);
    res.redirect('/?message=' + encodeURIComponent('Đăng ký thành công. Hãy đăng nhập.'));
  } catch (err) {
    res.redirect('/register?error=' + encodeURIComponent(err.response?.data?.message || 'Đăng ký thất bại'));
  }
});
app.post('/login', async (req, res) => {
  try {
    const rs = await axios.post(`${AUTH_INTERNAL}/login`, req.body);
    req.session.accessToken = rs.data.access_token;
    req.session.user = rs.data.user;
    res.redirect('/dashboard');
  } catch (err) {
    res.redirect('/?error=' + encodeURIComponent(err.response?.data?.message || 'Đăng nhập thất bại'));
  }
});
app.get('/auth/sso/callback', async (req, res) => {
  if (req.query.error) return res.redirect('/?error=' + encodeURIComponent(req.query.error));
  const token = req.query.token;
  if (!token) return res.redirect('/?error=' + encodeURIComponent('Không nhận được token từ Auth Server'));
  try {
    const rs = await axios.post(`${AUTH_INTERNAL}/verify`, { token });
    req.session.accessToken = token;
    req.session.user = rs.data.user;
    res.redirect('/dashboard');
  } catch (err) {
    res.redirect('/?error=' + encodeURIComponent('Token Google SSO không hợp lệ'));
  }
});

app.post('/google-sso', async (req, res) => {
  try {
    const { credential, mode } = req.body || {};
    const rs = await axios.post(`${AUTH_INTERNAL}/auth/google/id-token`, { credential, mode });
    req.session.accessToken = rs.data.access_token;
    req.session.user = rs.data.user;
    res.json({ ok: true, redirect: '/dashboard' });
  } catch (err) {
    res.status(err.response?.status || 500).json({
      ok: false,
      message: err.response?.data?.message || 'Google SSO thất bại'
    });
  }
});

app.get('/dashboard', requireLogin, (req, res) => {
  const u = req.session.user;
  res.send(layout({ user: u, body: `<main class="container main"><div class="welcome"><div class="panel"><h1>Xin chào, ${escapeHtml(u.name)}</h1><p>Bạn đã đăng nhập thành công. Cùng một phiên đăng nhập có thể sử dụng nhiều dịch vụ: Thời khóa biểu và Danh sách môn học.</p></div><div class="panel user-card"><div class="avatar">${escapeHtml((u.name || 'U')[0])}</div><div><strong>${escapeHtml(u.name)}</strong><br/><span style="color:var(--muted)">${escapeHtml(u.email)}</span><br/><span class="status-pill">Session active</span></div></div></div><div class="grid"><div class="feature"><div class="feature-icon">📅</div><h3>Timetable Service</h3><p>Tra cứu thời khóa biểu lớp A-E. Service này cần token hợp lệ và kiểm tra phiên qua Auth Server.</p><a class="btn btn-primary" href="/timetable">Tra cứu thời khóa biểu</a></div><div class="feature"><div class="feature-icon">📚</div><h3>Course Service</h3><p>Xem danh sách môn học đại học ngành An toàn thông tin. Service thứ hai dùng cùng phiên đăng nhập.</p><a class="btn btn-primary" href="/courses">Xem môn học</a></div></div></main>` }));
});
app.get('/timetable', requireLogin, async (req, res) => {
  const classCode = String(req.query.classCode || 'A').toUpperCase();
  let data = [], error = '';
  try {
    const rs = await axios.get(`${TIMETABLE}/timetable/${classCode}`, { headers: tokenHeader(req) });
    data = rs.data.data;
  } catch (err) { error = err.response?.data?.message || 'Không lấy được thời khóa biểu'; }
  const rows = data.map(r => `<tr><td>${r.day}</td><td>${r.period}</td><td>${escapeHtml(r.subject)}</td><td>${escapeHtml(r.lecturer)}</td><td>${escapeHtml(r.room)}</td></tr>`).join('');
  res.send(layout({ user: req.session.user, body: `<main class="container main"><div class="panel"><h1>Tra cứu thời khóa biểu</h1><p>Chọn lớp A-E để xem thời khóa biểu. Đây là service nghiệp vụ thứ nhất.</p>${error ? `<div class="notice error">${escapeHtml(error)}</div>` : ''}<form class="toolbar" method="GET" action="/timetable"><div class="field"><label>Lớp</label><select name="classCode">${['A','B','C','D','E'].map(c => `<option value="${c}" ${c===classCode?'selected':''}>Lớp ${c}</option>`).join('')}</select></div><button class="btn btn-primary" style="width:auto;margin:0">Tra cứu</button></form><table><thead><tr><th>Ngày</th><th>Tiết</th><th>Môn học</th><th>Giảng viên</th><th>Phòng</th></tr></thead><tbody>${rows}</tbody></table></div></main>` }));
});
app.get('/courses', requireLogin, async (req, res) => {
  const group = req.query.group || 'all';
  let data = [], error = '';
  try {
    const rs = await axios.get(`${COURSE}/courses?group=${encodeURIComponent(group)}`, { headers: tokenHeader(req) });
    data = rs.data.data;
  } catch (err) { error = err.response?.data?.message || 'Không lấy được danh sách môn học'; }
  const rows = data.map(c => `<tr><td>${escapeHtml(c.code)}</td><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.group)}</td></tr>`).join('');
  res.send(layout({ user: req.session.user, body: `<main class="container main"><div class="panel"><h1>Danh sách môn học ngành An toàn thông tin</h1><p>Đây là service nghiệp vụ thứ hai. Người dùng không cần đăng nhập lại để sử dụng.</p>${error ? `<div class="notice error">${escapeHtml(error)}</div>` : ''}<form class="toolbar" method="GET" action="/courses"><div class="field"><label>Nhóm môn</label><select name="group"><option value="all" ${group==='all'?'selected':''}>Tất cả</option><option value="DaiCuong" ${group==='DaiCuong'?'selected':''}>Đại cương</option><option value="CoSo" ${group==='CoSo'?'selected':''}>Cơ sở ngành</option><option value="ATTT" ${group==='ATTT'?'selected':''}>An toàn thông tin</option></select></div><button class="btn btn-primary" style="width:auto;margin:0">Tra cứu</button></form><table><thead><tr><th>Mã môn</th><th>Tên môn học</th><th>Nhóm môn</th></tr></thead><tbody>${rows}</tbody></table></div></main>` }));
});
app.get('/session', requireLogin, async (req, res) => {
  let s = null, error = '';
  try {
    const rs = await axios.get(`${AUTH_INTERNAL}/sessions/me`, { headers: tokenHeader(req) });
    s = rs.data.session;
  } catch (err) { error = err.response?.data?.message || 'Không lấy được session'; }
  res.send(layout({ user: req.session.user, body: `<main class="container main"><div class="panel"><h1>Phiên đăng nhập trung tâm</h1><p>Trang này thể hiện Centralized Session Management. Khi logout, phiên trung tâm bị thu hồi và các service sẽ không chấp nhận token cũ.</p>${error ? `<div class="notice error">${escapeHtml(error)}</div>` : ''}${s ? `<table><thead><tr><th>Thông tin</th><th>Giá trị</th></tr></thead><tbody><tr><td>Session ID</td><td>${escapeHtml(s.session_id)}</td></tr><tr><td>User ID</td><td>${s.user_id}</td></tr><tr><td>Provider</td><td>${escapeHtml(s.provider)}</td></tr><tr><td>Trạng thái</td><td>${s.is_active ? 'Active' : 'Revoked'}</td></tr><tr><td>Created At</td><td>${escapeHtml(s.created_at)}</td></tr><tr><td>Expires At</td><td>${escapeHtml(s.expires_at)}</td></tr><tr><td>Revoked At</td><td>${escapeHtml(s.revoked_at || '-')}</td></tr></tbody></table>` : ''}<p class="small-note">Trong source code thật, dữ liệu phiên được lưu ở bảng UserSessions trong SQL Server.</p></div></main>` }));
});
app.post('/logout', requireLogin, async (req, res) => {
  try { await axios.post(`${AUTH_INTERNAL}/logout`, {}, { headers: tokenHeader(req) }); } catch {}
  req.session.destroy(() => res.redirect('/?message=' + encodeURIComponent('Đã đăng xuất. Phiên SSO trung tâm đã bị thu hồi.')));
});
app.listen(PORT, () => console.log(`Client App running at http://localhost:${PORT}`));
