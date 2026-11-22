# Mát Nhà

Website bán nước chạy trên máy Windows tại **http://localhost:3000**.

- **Mở quán** bằng cách bấm đúp `start.bat`. Cài Node.js LTS (tối thiểu 22.18, kèm npm) nếu được nhắc. Giữ cửa sổ chạy mở. Có thể chạy lần lượt `npm ci`, `npm run build` và `npm start` trong thư mục dự án.
- **Tạo quản trị viên** bằng `npm run create-admin -- <email> [mật-khẩu]` khi website đã dừng. Bỏ mật khẩu để hệ thống sinh và in một lần. Admin hiện có vẫn đăng nhập như trước.
- **Cấu hình quán** trong **Quản trị → Cài đặt**. Điền phí giao, ngưỡng miễn phí, địa chỉ nhận tại quán và thông tin ngân hàng để mở VietQR. Mật khẩu tạm nằm trong **Quản trị → Khách hàng**.
- **Sao lưu và khôi phục** khi website đã dừng. Chạy `npm run backup` để sao lưu vào `backups/`, và `npm run restore -- "backups/<ngày-giờ>" --yes` để khôi phục. Sau đó mở lại website.
- **Xóa dữ liệu thử** khi website đã dừng bằng `npm run reset-data -- --yes`. Lệnh giữ các tài khoản admin, xóa đơn, khách và ảnh tải lên khỏi kho đang dùng, đưa thực đơn và cài đặt về mặc định. Kho trước thao tác vẫn được giữ.
- **Dữ liệu** nằm trong `.data/`, gồm thực đơn, cài đặt, đơn hàng, tài khoản, ảnh tải lên và các tệp dự phòng `.bak`. Có thể đổi vị trí bằng `DATA_DIR` trong `.env.local`. Cất bản sao lưu ở nơi riêng tư vì có thông tin khách hàng.

Xem [hướng dẫn chi tiết](docs/SETUP.md).
