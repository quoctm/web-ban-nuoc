# AGENTS.md — Web bán nước

Kế hoạch đầy đủ: `docs/PLAN.md`. Luôn đọc file đó trước khi làm việc.

## Quy tắc chung
- Stack: Next.js (App Router) + TypeScript (strict) + Tailwind CSS + Supabase (Postgres/Auth/Storage), deploy Vercel. Trình quản lý gói: npm.
- Giao diện và nội dung hiển thị bằng tiếng Việt; tiền tệ VND định dạng `45.000₫`.
- Mobile-first, đơn giản, mượt: ưu tiên Server Components, hạn chế JavaScript phía client, ảnh qua `next/image`.
- Mọi thay đổi database đi qua `supabase/migrations/`. Bật RLS cho mọi bảng.
- Không commit bí mật. Chỉ tạo `.env.example`; người dùng tự điền `.env.local`.
- Validate mọi form và server action bằng `zod`.
- Làm đúng một giai đoạn mỗi lần; dừng lại và báo cáo khi xong để chủ dự án duyệt.
- Trước khi báo xong: `npm run lint`, `npm run typecheck` và `npm run build` đều phải qua.

## Giai đoạn đã xong
- 1 — Nền tảng và menu.
- 2 — Giỏ hàng, đặt đơn, COD; tra cứu đơn chỉ bằng mã đơn 8 ký tự, che thông tin cá nhân khi xem bằng mã.
- 3 — Tài khoản email, VietQR (QR tự sinh, đếm ngược, tự hủy 30 phút), quản trị đơn/sản phẩm/danh mục/cài đặt.

## Giai đoạn hiện tại: 4 — Chạy local hoàn chỉnh, kiểm thử tổng thể, hiệu năng
**Quyết định của chủ dự án (22/11/2026):** web CHỈ chạy local trên một máy Windows này (localhost), không triển khai lên Internet, không dùng Supabase/Vercel. Lưu dữ liệu bằng file JSON. Bỏ đăng nhập Google. Bỏ tính năng quên/đặt lại mật khẩu. Các quy tắc ở trên nhắc tới Supabase/Vercel/RLS chỉ áp dụng cho phần code Supabase còn giữ lại, không còn là đường chạy chính.

### Chế độ local là chế độ chính thức
- Cho phép kho JSON chạy cả với `npm run build && npm start` (bỏ chặn `NODE_ENV=production`). Chọn backend local khi không có biến Supabase; giữ code Supabase hiện có nhưng không bắt buộc, không hiện banner "thực đơn mẫu / cần Supabase" nữa.
- `next start` và `next dev` chỉ lắng nghe `127.0.0.1` cổng 3000 (không mở ra mạng LAN).
- Thực đơn mẫu (20 món, 4 danh mục) được ghi vào kho JSON ở lần chạy đầu để admin sửa được; không còn hai nguồn dữ liệu song song.

### Kho JSON an toàn
- Ghi nguyên tử (ghi file tạm rồi rename), tuần tự hóa mọi giao dịch đọc-ghi trong tiến trình (hàng đợi/khóa), không mất dữ liệu khi hai đơn đặt cùng lúc. Viết test đặt 20 đơn song song không mất đơn nào.
- Trước mỗi lần ghi giữ bản sao `.bak`; khi file hỏng (JSON lỗi) thì tự khôi phục từ `.bak`, nếu không được thì báo lỗi rõ ràng trên trang thay vì crash và không ghi đè file hỏng.
- Tách file theo loại dữ liệu nếu hợp lý (vd. `catalog.json`, `orders.json`, `users.json`, `settings.json`). Thư mục dữ liệu mặc định `.data/` (có thể đổi bằng biến `DATA_DIR`).
- Script `npm run backup` sao chép toàn bộ dữ liệu + ảnh sang `backups/<ngày-giờ>/`; `npm run restore -- <thư mục>` khôi phục (hỏi xác nhận bằng cờ `--yes`).

### Bỏ tính năng
- Bỏ nút và route đăng nhập Google, bỏ `/auth/callback` nếu không còn dùng.
- Bỏ `/quen-mat-khau`, `/dat-lai-mat-khau`, link "Quên mật khẩu", việc ghi `.data/dev-reset.txt`. Thêm chức năng admin **đặt mật khẩu tạm** cho khách trong trang quản trị (trang "Khách hàng": danh sách email, ngày tạo, số đơn; nút đặt mật khẩu tạm hiển thị một lần). Ở trang đăng nhập ghi chú "Quên mật khẩu? Liên hệ quán để được đặt lại."
- Đổi `dev:create-admin` thành `npm run create-admin -- <email> [mật khẩu]` (không truyền mật khẩu thì sinh ngẫu nhiên và chỉ in một lần).

### Ảnh sản phẩm
- `next start` không phục vụ file thêm vào `public/` sau khi build: lưu ảnh tải lên vào `DATA_DIR/uploads/` và phục vụ qua route handler (kiểm tra tên file an toàn, chống path traversal, đúng Content-Type, cache hợp lý). Chuyển ảnh đã có trong `public/uploads/` sang chỗ mới. Ảnh mẫu trong `public/images/` giữ nguyên.

### Khởi chạy dễ cho người không rành kỹ thuật
- `start.bat` ở thư mục gốc: kiểm tra Node.js (>= phiên bản trong `engines`, nếu thiếu thì in hướng dẫn tải Node LTS từ nodejs.org và dừng), cài thư viện nếu thiếu `node_modules`, build nếu chưa có bản build hoặc code mới hơn bản build, rồi chạy `npm start` và mở trình duyệt `http://localhost:3000`.
- `README.md` tiếng Việt ngắn gọn: cách chạy (start.bat hoặc lệnh), tạo admin, sao lưu/khôi phục, đổi phí ship/ngân hàng, nơi lưu dữ liệu, cách xóa dữ liệu thử. Cập nhật `docs/SETUP.md` cho phù hợp chế độ local (giữ phần Supabase ở mục "Tùy chọn nâng cao").
- Xóa dữ liệu thử: script `npm run reset-data -- --yes` đưa về trạng thái ban đầu (thực đơn mẫu, không đơn, không khách; giữ hoặc tạo lại admin).

### Kiểm thử tổng thể và hiệu năng
- Chạy trên bản production local (`npm run build && npm start`): luồng khách vãng lai COD, khách đăng nhập VietQR, admin xác nhận/huỷ/hoàn tất, đơn quá hạn, sửa món/ảnh/giá rồi đặt đơn, tra cứu đơn, phân quyền.
- Đo **Lighthouse mobile** trên bản production local cho `/`, `/san-pham`, một trang chi tiết, `/gio-hang` (có hàng), `/thanh-toan`: Performance ≥ 90, Accessibility ≥ 90, Best Practices ≥ 90 (trung vị 3 lần). Sửa đến khi đạt; lưu báo cáo tóm tắt vào `docs/lighthouse.md`.
- Toàn bộ `lint`, `typecheck`, `test`, `build` qua.
