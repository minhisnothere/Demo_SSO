const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const PORT = Number(process.env.PORT || 5000);
const AUTH_SERVER = process.env.AUTH_SERVER_INTERNAL || 'http://localhost:4000';
app.use(cors());
app.use(express.json());

const timetables = {
  A: [
    { day: 'Thứ 2', period: '1-3', subject: 'Cơ sở an toàn thông tin', lecturer: 'ThS. Nguyễn Văn Nam', room: 'A101' },
    { day: 'Thứ 3', period: '4-6', subject: 'Toán rời rạc', lecturer: 'ThS. Trần Thị Lan', room: 'B201' },
    { day: 'Thứ 5', period: '1-3', subject: 'Vật lý đại cương A1', lecturer: 'TS. Lê Hoàng Anh', room: 'A203' },
    { day: 'Thứ 6', period: '7-9', subject: 'Tiếng Anh 1', lecturer: 'Cô Mai', room: 'C105' }
  ],
  B: [
    { day: 'Thứ 2', period: '4-6', subject: 'An toàn mạng máy tính', lecturer: 'TS. Phạm Quốc Bảo', room: 'Lab Network' },
    { day: 'Thứ 3', period: '1-3', subject: 'Nhập môn mật mã học', lecturer: 'TS. Nguyễn Đức Minh', room: 'Lab Crypto' },
    { day: 'Thứ 4', period: '7-9', subject: 'Toán xác suất thống kê', lecturer: 'ThS. Vũ Thị Hạnh', room: 'B202' },
    { day: 'Thứ 6', period: '1-3', subject: 'Pháp luật Việt Nam đại cương', lecturer: 'ThS. Hoàng Thị Mai', room: 'B204' }
  ],
  C: [
    { day: 'Thứ 2', period: '7-9', subject: 'Giao thức an toàn mạng', lecturer: 'TS. Đỗ Quốc Huy', room: 'Lab Network' },
    { day: 'Thứ 4', period: '1-3', subject: 'Mã độc', lecturer: 'ThS. Lê Minh Khoa', room: 'Lab Malware' },
    { day: 'Thứ 5', period: '4-6', subject: 'An toàn cơ sở dữ liệu', lecturer: 'ThS. Trần Anh Tuấn', room: 'Lab DB' },
    { day: 'Thứ 7', period: '1-3', subject: 'Kỹ năng mềm', lecturer: 'ThS. Nguyễn Thị Hương', room: 'C301' }
  ],
  D: [
    { day: 'Thứ 3', period: '7-9', subject: 'Đánh giá và kiểm định AT hệ TTT', lecturer: 'ThS. Nguyễn Hải Đăng', room: 'Lab Pentest' },
    { day: 'Thứ 4', period: '4-6', subject: 'An toàn thương mại điện tử', lecturer: 'TS. Lê Quốc Việt', room: 'D401' },
    { day: 'Thứ 5', period: '7-9', subject: 'Quản trị an toàn hệ thống', lecturer: 'ThS. Bùi Văn Sơn', room: 'Lab Linux' },
    { day: 'Thứ 6', period: '4-6', subject: 'Tiếng Anh chuyên ngành', lecturer: 'Cô Lan', room: 'D402' }
  ],
  E: [
    { day: 'Thứ 2', period: '1-3', subject: 'Triết học Mác - Lênin', lecturer: 'TS. Phạm Thị Ngọc', room: 'E501' },
    { day: 'Thứ 3', period: '4-6', subject: 'Phương pháp tính', lecturer: 'ThS. Đỗ Minh Hoàng', room: 'E502' },
    { day: 'Thứ 5', period: '1-3', subject: 'Quản trị an toàn hệ thống', lecturer: 'ThS. Nguyễn Tuấn Anh', room: 'SOC Lab' },
    { day: 'Thứ 6', period: '7-9', subject: 'Đồ án chuyên ngành ATTT', lecturer: 'TS. Trần Quốc Khánh', room: 'Project Lab' }
  ]
};
async function verifyToken(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Thiếu Bearer token' });
  try {
    const rs = await axios.post(`${AUTH_SERVER}/verify`, { token });
    req.user = rs.data.user;
    next();
  } catch (err) {
    res.status(401).json({ message: err.response?.data?.message || 'Verify token thất bại' });
  }
}
app.get('/health', (req, res) => res.json({ ok: true, service: 'timetable-service' }));
app.get('/timetable/:classCode', verifyToken, (req, res) => {
  const classCode = String(req.params.classCode || '').toUpperCase();
  const data = timetables[classCode];
  if (!data) return res.status(404).json({ message: 'Chỉ hỗ trợ lớp A, B, C, D, E' });
  res.json({ message: `Thời khóa biểu lớp ${classCode}`, classCode, user: req.user, data });
});
app.listen(PORT, () => console.log(`Timetable Service running at http://localhost:${PORT}`));
