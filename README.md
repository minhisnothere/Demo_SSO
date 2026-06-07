# SSO Demo - Google Identity Services

## Thành phần

- `client-app` - giao diện đăng ký, đăng nhập, logout, thời khóa biểu, môn học.
- `auth-server` - Identity Provider/Auth Server, quản lý user, Google SSO, JWT, session trung tâm.
- `timetable-service` - service tra cứu thời khóa biểu.
- `course-service` - service danh sách môn học ngành An toàn thông tin.
- `sqlserver` - SQL Server lưu `Users` và `UserSessions`.

## 1. Tạo file `.env`

Điền secret thật từ Google Cloud Console hoặc file `client_secret_*.json` bạn tải từ Google:

```env
GOOGLE_CLIENT_ID=________________.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=PASTE_YOUR_GOOGLE_CLIENT_SECRET_HERE
GOOGLE_REDIRECT_URI=http://localhost:4000/auth/google/callback
```

Trong Google Cloud, OAuth Client cần cấu hình:

Authorized JavaScript origins:

```text
http://localhost:3000
```

Allowed/Authorized redirect URIs, giữ lại để fallback OAuth redirect cũ nếu cần:

```text
http://localhost:4000/auth/google/callback
```

## 2. Chạy Docker

```bash
docker compose down
docker compose up -d --build
```

Mở:

```text
http://localhost:3000
```

Tài khoản local demo:

```text
username: admin
password: 123456
```

## 3. Test Google SSO đúng thứ tự

Vì demo yêu cầu đăng ký trước, lần đầu dùng Google phải làm:

```text
1. Vào http://localhost:3000
2. Chọn tab Đăng ký
3. Bấm Đăng ký bằng Google SSO
4. Bấm nút Google hiện trên form
5. Chọn email Google
```

Sau khi đăng ký Google thành công, logout rồi mới test:

```text
Đăng nhập → Đăng nhập bằng Google
```

## 4. Debug Google SSO

Kiểm tra config container đang nhận:

```bash
docker compose exec auth-server printenv GOOGLE_CLIENT_ID
docker compose exec auth-server printenv GOOGLE_REDIRECT_URI
```

Mở config:

```text
http://localhost:4000/debug/google-config
```

Khi test Google Identity Services, log đúng sẽ có:

```bash
docker compose logs -f auth-server
```

```text
[GOOGLE_ID_TOKEN_USER]
```

Nếu không thấy nút Google hoặc bấm không được, kiểm tra Google Cloud đã thêm Authorized JavaScript origin `http://localhost:3000` chưa.

## 5. 

- Không redirect sang Google OAuth URL ở flow chính.
- Dùng Google Identity Services ở `client-app` để lấy Google ID Token.
- `client-app` gửi ID Token về `auth-server`.
- `auth-server` verify ID Token bằng `GOOGLE_CLIENT_ID`, sau đó register/login user Google.

## 6. Luồng SSO

```text
User đăng nhập một lần tại Auth Server
        ↓
Auth Server tạo JWT + UserSession trong SQL Server
        ↓
Client App dùng cùng token gọi nhiều service
        ↓
Timetable Service và Course Service gọi Auth Server /verify
        ↓
Auth Server kiểm tra JWT + UserSessions.is_active
```

## 7. Global logout

Khi logout:

```text
Client App → Auth Server /logout
Auth Server set UserSessions.is_active = 0
Token cũ không còn dùng được ở Timetable Service/Course Service
```

## 8. Xóa sạch database khi cần

```bash
docker compose down -v
docker compose up -d --build
```
