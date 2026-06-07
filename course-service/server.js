const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const PORT = Number(process.env.PORT || 6000);
const AUTH_SERVER = process.env.AUTH_SERVER_INTERNAL || 'http://localhost:4000';
app.use(cors());
app.use(express.json());

const courses = [
  { code: 'PHY101', name: 'Vật lý đại cương A1', group: 'Đại cương', groupCode: 'DaiCuong' },
  { code: 'PHY102', name: 'Vật lý đại cương A2', group: 'Đại cương', groupCode: 'DaiCuong' },
  { code: 'PHY103', name: 'Thực hành vật lý đại cương 1&2', group: 'Đại cương', groupCode: 'DaiCuong' },
  { code: 'ENG101', name: 'Tiếng Anh 1', group: 'Đại cương', groupCode: 'DaiCuong' },
  { code: 'ENG102', name: 'Tiếng Anh 2', group: 'Đại cương', groupCode: 'DaiCuong' },
  { code: 'ENG103', name: 'Tiếng Anh 3', group: 'Đại cương', groupCode: 'DaiCuong' },
  { code: 'ENGATTT', name: 'Tiếng Anh chuyên ngành', group: 'Cơ sở ngành', groupCode: 'CoSo' },
  { code: 'MATH101', name: 'Toán cao cấp A1 - Giải tích 1', group: 'Đại cương', groupCode: 'DaiCuong' },
  { code: 'MATH102', name: 'Toán cao cấp A2 - Giải tích 2', group: 'Đại cương', groupCode: 'DaiCuong' },
  { code: 'MATH103', name: 'Toán cao cấp A3 - Đại số tuyến tính', group: 'Đại cương', groupCode: 'DaiCuong' },
  { code: 'MATH201', name: 'Toán xác suất thống kê', group: 'Cơ sở ngành', groupCode: 'CoSo' },
  { code: 'MATH202', name: 'Phương pháp tính', group: 'Cơ sở ngành', groupCode: 'CoSo' },
  { code: 'MATH203', name: 'Toán rời rạc', group: 'Cơ sở ngành', groupCode: 'CoSo' },
  { code: 'POL101', name: 'Triết học Mác - Lênin', group: 'Đại cương', groupCode: 'DaiCuong' },
  { code: 'POL102', name: 'Lịch sử Đảng Cộng sản Việt Nam', group: 'Đại cương', groupCode: 'DaiCuong' },
  { code: 'LAW101', name: 'Pháp luật Việt Nam đại cương', group: 'Đại cương', groupCode: 'DaiCuong' },
  { code: 'POL103', name: 'Kinh tế chính trị Mác - Lênin', group: 'Đại cương', groupCode: 'DaiCuong' },
  { code: 'POL104', name: 'Tư tưởng Hồ Chí Minh', group: 'Đại cương', groupCode: 'DaiCuong' },
  { code: 'PSY101', name: 'Tâm lý học đại cương', group: 'Đại cương', groupCode: 'DaiCuong' },
  { code: 'SKILL101', name: 'Kỹ năng mềm', group: 'Đại cương', groupCode: 'DaiCuong' },
  { code: 'POL105', name: 'Chủ nghĩa xã hội khoa học', group: 'Đại cương', groupCode: 'DaiCuong' },
  { code: 'ATTT101', name: 'Cơ sở an toàn thông tin', group: 'An toàn thông tin', groupCode: 'ATTT' },
  { code: 'ATTT201', name: 'An toàn mạng máy tính', group: 'An toàn thông tin', groupCode: 'ATTT' },
  { code: 'ATTT202', name: 'Giao thức an toàn mạng', group: 'An toàn thông tin', groupCode: 'ATTT' },
  { code: 'ATTT203', name: 'Nhập môn mật mã học', group: 'An toàn thông tin', groupCode: 'ATTT' },
  { code: 'ATTT301', name: 'Mã độc', group: 'An toàn thông tin', groupCode: 'ATTT' },
  { code: 'ATTT302', name: 'An toàn cơ sở dữ liệu', group: 'An toàn thông tin', groupCode: 'ATTT' },
  { code: 'ATTT303', name: 'An toàn thương mại điện tử', group: 'An toàn thông tin', groupCode: 'ATTT' },
  { code: 'ATTT304', name: 'Đánh giá và kiểm định an toàn hệ thống thông tin', group: 'An toàn thông tin', groupCode: 'ATTT' },
  { code: 'ATTT401', name: 'Quản trị an toàn hệ thống', group: 'An toàn thông tin', groupCode: 'ATTT' }
];
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
app.get('/health', (req, res) => res.json({ ok: true, service: 'course-service' }));
app.get('/courses', verifyToken, (req, res) => {
  const group = req.query.group || 'all';
  const data = group === 'all' ? courses : courses.filter(c => c.groupCode === group);
  res.json({ message: 'Danh sách môn học ngành An toàn thông tin', group, user: req.user, data });
});
app.listen(PORT, () => console.log(`Course Service running at http://localhost:${PORT}`));
