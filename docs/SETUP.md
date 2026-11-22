# Thiết lập Mát Nhà

## Chạy local trên Windows

1. Cài Node.js LTS từ nodejs.org, phiên bản 22.18 trở lên và có npm.
2. Bấm đúp `start.bat`, hoặc chạy `npm ci`, `npm run build` và `npm start` trong thư mục dự án. Khi sửa mã có thể dùng `npm run dev`. Cả hai chế độ nghe tại `127.0.0.1:3000`; mở `http://localhost:3000`.
3. Khi website đã dừng, chạy `npm run create-admin -- <email> [mật-khẩu]` nếu cần tài khoản admin mới. Mật khẩu tự sinh được in một lần khi bỏ đối số mật khẩu. Lệnh báo trùng nếu email đã tồn tại.
4. Đăng nhập rồi mở **Quản trị → Cài đặt** để cập nhật phí giao, ngưỡng miễn phí và địa chỉ nhận. VietQR khả dụng khi có đủ thông tin ngân hàng hợp lệ. Quán tự xác nhận tiền chuyển khoản. Đơn chờ chuyển khoản hết hạn sau 30 phút.
5. **Quản trị → Khách hàng** hiển thị số đơn và ngày tạo khi có dữ liệu. Mật khẩu tạm được hiển thị ngay sau lúc tạo, có hạn 24 giờ và khách đổi sang mật khẩu mới ngay tại trang đăng nhập. Các phiên đăng nhập cũ hết hiệu lực.

## Dữ liệu và ảnh

Kho mặc định là `.data/`. Có thể đặt `DATA_DIR` trong `.env.local` thành một thư mục riêng. Lần mở đầu ghi 20 món và 4 danh mục vào `catalog.json`. Cài đặt nằm cùng file này để lúc chốt đơn dùng cùng phiên bản thực đơn và phí. Đơn và người dùng nằm trong `orders.json` và `users.json`. Ảnh tải lên được lưu trong `uploads/` bên trong kho. Lệnh khởi chạy chuyển ảnh cũ từ `public/uploads/` nếu có.

Dừng website trước khi thao tác với kho dữ liệu:

- `npm run backup` sao lưu toàn bộ kho, gồm ảnh và các tệp `.bak`, vào `backups/<ngày-giờ UTC>/`.
- `npm run restore -- "backups/<ngày-giờ>" --yes` khôi phục toàn bộ kho từ bản đã chọn.
- `npm run reset-data -- --yes` giữ admin, xóa dữ liệu dùng thử và đưa thực đơn cùng cài đặt về mặc định.
- Sau khi khôi phục hoặc đặt lại, thư mục cũ được giữ cạnh kho đang dùng để có thể lấy lại dữ liệu. Bảo quản các bản sao ở nơi riêng tư.

Khi một tệp JSON lỗi cú pháp, ứng dụng thử phục hồi từ tệp `.bak`. Nếu cả hai không đọc được, giữ nguyên tệp lỗi và kiểm tra bản sao lưu.

## Kiểm thử

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

## Tùy chọn nâng cao — Supabase

Đường chạy mặc định dùng JSON và không cần cấu hình biến môi trường. Nếu cần dùng lại backend Supabase, tạo dự án, dùng `.env.example` để điền cả URL, khóa publishable, khóa secret và `RATE_LIMIT_HMAC_SECRET` có ít nhất 32 byte. Dùng Supabase CLI liên kết dự án và chạy `supabase db push`. Migration thiết lập RLS, bucket ảnh, tín hiệu đơn hàng và tác vụ hết hạn VietQR.

Bật Email trong Supabase Auth. Đặt Site URL theo `NEXT_PUBLIC_SITE_URL` và cho phép URL đầy đủ kết thúc bằng `/auth/callback` để xác nhận đăng ký. Đường dẫn này trả về 404 khi chạy với kho JSON. Sau khi xác nhận email người vận hành, cấp vai trò `admin` trong bảng `public.profiles` theo UUID tài khoản. Quản lý tài khoản khách của backend này từ bảng điều khiển Supabase.
