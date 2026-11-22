# Kế hoạch cuối cho website bán nước uống

> Cập nhật Giai đoạn 4 ngày 22/11/2026. Website vận hành trên một máy Windows qua localhost, lưu JSON. Đăng nhập dùng email và mật khẩu. Khi cần cấp lại mật khẩu cho khách, quản trị viên tạo mật khẩu tạm. Xem quyết định hiện hành trong [AGENTS.md](../AGENTS.md) và cách vận hành trong [SETUP.md](SETUP.md). Nội dung bên dưới ghi lại thiết kế ban đầu.

> Lập cùng Codex ngày 22/11/2026. Quyết định đã chốt: Next.js + Supabase + Vercel; COD + VietQR (admin xác nhận tay); đăng nhập Email/mật khẩu + Google, cho mua không cần tài khoản; phí ship cố định + miễn phí theo ngưỡng + nhận tại quán; size M/L + mức đường/đá, topping để sau.

## 1. Mục tiêu và phạm vi

Ra mắt website bán trà sữa, cà phê, nước ép và nước đóng chai. Khách có thể tìm món, đặt hàng và tra cứu đơn trên điện thoại hoặc máy tính. Sử dụng Next.js App Router, TypeScript, Tailwind CSS, Supabase Postgres/Auth/Storage và triển khai trên Vercel.

**Có trong bản đầu**

- Menu theo danh mục, tìm kiếm tiếng Việt có dấu và không dấu, trang chi tiết sản phẩm. Ảnh lưu trên Supabase Storage và hiển thị bằng `next/image`.
- Size M/L có giá riêng. Mức đường và đá được ghi trên từng dòng hàng và giữ nguyên giá. Quản trị viên cấu hình món nào có các lựa chọn này.
- Giỏ hàng lưu trên trình duyệt. Khách có thể mua không cần tài khoản hoặc đăng nhập bằng email/mật khẩu hay Google.
- Giao hàng với phí cố định, miễn phí từ ngưỡng tiền hàng có thể cấu hình. Nhận tại quán có phí giao bằng 0. Ngưỡng miễn phí chỉ áp dụng cho đơn giao hàng.
- COD và VietQR. Quản trị viên xác nhận tiền VietQR thủ công. Đơn VietQR chưa được xác nhận tự hủy sau 30 phút.
- Lịch sử đơn cho khách đăng nhập. Tra cứu bằng mã đơn với thông tin liên hệ được che cho khách vãng lai. Giới hạn tần suất đặt đơn.
- Quản trị danh mục, sản phẩm, ảnh, tình trạng còn hàng, đơn hàng, phí giao và tài khoản ngân hàng.

**Ngoài phạm vi bản đầu**
Topping, mã giảm giá, tích điểm, đếm tồn kho, đồng bộ đơn vị vận chuyển, đối soát ngân hàng tự động, hoàn tiền tự động và gửi thông báo đơn qua email/SMS.

## 2. Trang và luồng sử dụng

| Đường dẫn | Nội dung |
|---|---|
| `/` | Trang chủ, danh mục và lối vào menu |
| `/san-pham` | Danh sách sản phẩm, tìm kiếm và lọc theo danh mục |
| `/san-pham/[slug]` | Chi tiết, size, mức đường/đá và số lượng |
| `/gio-hang` | Xem, chỉnh số lượng hoặc xóa từng lựa chọn |
| `/thanh-toan` | Thông tin liên hệ, giao hàng hoặc nhận tại quán, tổng tiền và phương thức thanh toán |
| `/tra-cuu-don`, `/don-hang/[ma]` | Tra cứu, xác nhận đơn, theo dõi trạng thái và xem QR khi đơn còn chờ thanh toán |
| `/dang-nhap`, `/dang-ky`, `/quen-mat-khau`, `/dat-lai-mat-khau` | Đăng nhập, đăng ký và khôi phục mật khẩu |
| `/tai-khoan/don-hang` | Lịch sử đơn của tài khoản hiện tại |
| `/quan-tri/san-pham`, `/quan-tri/danh-muc`, `/quan-tri/don-hang`, `/quan-tri/cai-dat` | Quản lý menu, vận hành đơn và cập nhật cấu hình |

**Luồng mua hàng**
Tìm món → chọn size, đường/đá → thêm vào giỏ → chọn giao hàng hoặc nhận tại quán → chọn COD hoặc VietQR → nhận xác nhận và theo dõi đơn. Trang xác nhận hiển thị mã đơn để khách lưu lại. Mã mới có 8 ký tự sau tiền tố MN-, và hệ thống tiếp tục nhận mã cũ 6 ký tự.

## 3. Schema database và phân quyền

### Bảng và cột

Các cột mặc định bắt buộc trừ khi ghi `NULL`. Số tiền là `integer` theo VND và không âm. Thời gian dùng `timestamptz`. Mỗi bảng nghiệp vụ có khóa chính UUID, ngoại trừ `profiles`, `settings` và `checkout_rate_limits` theo khóa ghi bên dưới.

| Bảng | Cột, kiểu và khóa |
|---|---|
| `profiles` | `id uuid` PK, FK → `auth.users.id`; `role enum(admin, customer)` mặc định `customer`; `display_name text NULL`; `created_at`, `updated_at timestamptz` |
| `categories` | `id uuid` PK; `name text`; `slug text` UNIQUE; `sort_order integer`; `is_active boolean`; `created_at`, `updated_at timestamptz` |
| `products` | `id uuid` PK; `category_id uuid` FK → `categories.id`; `name`, `slug`, `description text`; `slug` UNIQUE; `image_path text NULL`; `is_active`, `is_available`, `allow_sugar`, `allow_ice boolean`; `search_text text`; `search_vector tsvector`; `created_at`, `updated_at timestamptz` |
| `product_variants` | `id uuid` PK; `product_id uuid` FK → `products.id`; `size enum(M, L)`; `price_vnd integer`; `is_available boolean`; UNIQUE (`product_id`, `size`) |
| `orders` | `id uuid` PK; `code text` UNIQUE; `user_id uuid NULL` FK → `profiles.id`; `guest_secret_hash text NULL`; `idempotency_key uuid` UNIQUE; `customer_name`, `phone text`; `fulfillment_method enum(delivery, pickup)`; `delivery_address text NULL`; `pickup_address text NULL`; `customer_note text NULL`; `subtotal_vnd`, `delivery_fee_vnd`, `total_vnd integer`; `status order_status`; `payment_expires_at`, `cancelled_at timestamptz NULL`; `cancel_reason text NULL`; `created_at`, `updated_at timestamptz` |
| `order_items` | `id uuid` PK; `order_id uuid` FK → `orders.id`; `variant_id uuid` FK → `product_variants.id`; `product_name text`; `size enum(M, L)`; `unit_price_vnd integer`; `quantity integer` > 0; `sugar_level`, `ice_level text NULL` |
| `payments` | `id uuid` PK; `order_id uuid` UNIQUE, FK → `orders.id`; `method enum(cod, vietqr)`; `status payment_status`; `amount_vnd integer`; `bank_bin`, `bank_account_number`, `bank_account_name`, `transfer_reference text NULL`; `paid_at timestamptz NULL`; `confirmed_by uuid NULL` FK → `profiles.id`; `created_at`, `updated_at timestamptz` |
| `settings` | `id smallint` PK, ràng buộc chỉ có giá trị `1`; `delivery_fee_vnd`, `free_delivery_threshold_vnd integer`; `pickup_address text`; `bank_bin`, `bank_account_number`, `bank_account_name text`; `updated_at timestamptz`; `updated_by uuid NULL` FK → `profiles.id` |
| `checkout_rate_limits` | `subject_hash text`, `window_start timestamptz` tạo PK ghép; `request_count integer`; `expires_at timestamptz` |

**Ràng buộc và chỉ mục**

- Đơn giao hàng phải có địa chỉ giao. Đơn nhận tại quán lưu địa chỉ quán tại thời điểm đặt. Tổng đơn bằng tiền hàng cộng phí giao. Phí giao bằng 0 khi nhận tại quán hoặc tiền hàng đạt ngưỡng miễn phí. Máy chủ kiểm tra các lựa chọn và tính lại giá trước khi tạo đơn.
- Lưu tên món, size, đơn giá và thông tin chuyển khoản tại thời điểm đặt. Ẩn món hoặc size đã ngừng bán để giữ liên kết với các đơn cũ. Mỗi đơn VietQR có nội dung chuyển khoản riêng.
- Chuẩn hóa tên và mô tả bằng chữ thường và `unaccent` khi ghi dữ liệu. Tạo `search_vector` với cấu hình `simple`, chuẩn hóa truy vấn theo cùng cách và ưu tiên kết quả khớp tên. Dùng chỉ mục GIN cho full-text và `pg_trgm` cho truy vấn gần đúng. Kiểm thử riêng trường hợp `đ/d`.
- Tạo chỉ mục cho sản phẩm theo danh mục, đơn theo `user_id` và thời điểm tạo, dòng hàng theo `order_id`, đơn chờ thanh toán theo `payment_expires_at` và bản ghi giới hạn theo `expires_at`.

### Chính sách RLS

Bật RLS cho mọi bảng ứng dụng. Cấp quyền quản trị dựa trên `profiles.role` được kiểm tra phía máy chủ. Hồ sơ mới mặc định là `customer`. Cấp quyền `admin` bằng thao tác vận hành có kiểm soát.

| Bảng hoặc tài nguyên | Quyền truy cập |
|---|---|
| `profiles` | Khách đọc hồ sơ của mình và chỉ được sửa trường hiển thị qua luồng được cấp quyền. Thay đổi vai trò chỉ qua luồng quản trị được bảo vệ. |
| `categories`, `products`, `product_variants` | Khách đọc danh mục và món đang công khai cùng các size tương ứng. Quản trị viên đọc và cập nhật toàn bộ. |
| `orders`, `order_items`, `payments` | Khách đăng nhập đọc dữ liệu của đơn thuộc tài khoản mình. Khách vãng lai tra cứu qua máy chủ bằng mã đơn. Chỉ phiên trình duyệt vừa đặt đơn, chủ đơn và admin được xem đầy đủ thông tin liên hệ. Quy trình tạo đơn và chuyển trạng thái chạy phía máy chủ. Quản trị viên được xem và thao tác theo quyền. |
| `settings` | Quản trị viên đọc và sửa. Máy chủ trả cho giỏ hàng và trang thanh toán các giá trị cần hiển thị. Thông tin chuyển khoản lấy từ bản ghi thanh toán của đơn đã xác thực quyền truy cập. |
| `checkout_rate_limits` | Chỉ luồng máy chủ được đọc và ghi. Dọn bản ghi khi hết hạn. |
| Supabase Storage | Ảnh sản phẩm đã đăng được đọc công khai. Chính sách trên `storage.objects` chỉ cho quản trị viên tải lên, thay thế và xóa trong bucket ảnh sản phẩm. |

**Bảo vệ thao tác đặt và tra cứu đơn**
Tạo đơn, dòng hàng và bản ghi thanh toán trong cùng giao dịch. Gửi lại cùng yêu cầu dùng khóa chống trùng và chỉ trả kết quả sau khi kiểm tra đúng người gửi. Giới hạn tần suất bằng bộ đếm cập nhật nguyên tử theo IP và theo tài khoản khi có, với ngưỡng cấu hình được. Áp dụng giới hạn riêng cho tra cứu. Sinh mã đơn ngẫu nhiên và che thông tin liên hệ trong kết quả tra cứu công khai.

## 4. Trạng thái đơn hàng và thanh toán

| Mốc | Trạng thái đơn | Trạng thái thanh toán |
|---|---|---|
| Tạo đơn COD | `confirmed` | `pending` |
| Tạo đơn VietQR | `awaiting_payment` | `pending` |
| Quản trị viên xác nhận VietQR trước hạn | `confirmed` | `paid` |
| VietQR hết 30 phút mà chưa xác nhận | `cancelled`, lý do hết hạn | `expired` |
| Quán bắt đầu chuẩn bị | `preparing` | Giữ nguyên |
| Đang giao hoặc sẵn sàng nhận tại quán | `out_for_delivery` hoặc `ready_for_pickup` | Giữ nguyên |
| Giao hoặc nhận thành công | `completed` | `paid`, ghi nhận tiền COD khi hoàn tất |
| Hủy theo nghiệp vụ trước khi hoàn tất | `cancelled`, lưu lý do | `cancelled` nếu chưa thu. Khoản đã thu giữ `paid` để đối soát thủ công. |

Hạn thanh toán tính từ lúc tạo đơn theo giờ máy chủ. Supabase Cron chạy mỗi phút để cập nhật đơn hết hạn. Từ đúng thời điểm hết hạn, trang đơn ngừng hiển thị QR và máy chủ từ chối xác nhận, kể cả khi tác vụ định kỳ chưa chạy. Luồng xác nhận tiền và luồng hết hạn cập nhật có điều kiện trong giao dịch để chỉ một thao tác thành công. Khoản chuyển đến sau hạn được quản trị viên xử lý thủ công.

## 5. Cấu trúc thư mục

```text
src/
  app/
    (shop)/          Trang chủ, menu, giỏ hàng, thanh toán, tra cứu
    (account)/       Đăng nhập, khôi phục mật khẩu, lịch sử đơn
    auth/callback/   Hoàn tất luồng xác thực
    quan-tri/        Danh mục, sản phẩm, đơn hàng, cấu hình
  components/        Thành phần giao diện dùng chung
  features/
    catalog/         Danh mục, sản phẩm và tìm kiếm
    cart/            Giỏ hàng và lựa chọn từng món
    checkout/        Tính phí, tạo đơn và chống gửi trùng
    orders/          Tra cứu, phân quyền và chuyển trạng thái
    payments/        COD, VietQR và xác nhận thanh toán
  lib/
    supabase/        Kết nối trình duyệt và máy chủ
    server/          Xác thực quản trị và giới hạn tần suất
supabase/
  migrations/        Schema, chỉ mục, RLS và tác vụ hết hạn
public/              Tài nguyên giao diện tĩnh
```

## 6. Bốn giai đoạn triển khai

| Giai đoạn | Công việc cụ thể | Tiêu chí hoàn thành |
|---|---|---|
| **1. Nền tảng và menu** | Thiết lập Next.js, Supabase, bản xem trước Vercel. Tạo schema, vai trò, RLS và bucket ảnh. Làm trang menu, chi tiết, lọc danh mục và tìm kiếm có dấu/không dấu. | Menu dùng được trên điện thoại. `tra sua` tìm được `Trà sữa`, `da` tìm được `đá` trong dữ liệu kiểm thử. Khách chỉ đọc được menu công khai và không thể tải ảnh lên. |
| **2. Giỏ hàng, đặt đơn và COD** | Làm giỏ hàng theo size/đường/đá. Tính phí cố định, miễn phí và nhận tại quán. Tạo đơn trong giao dịch, chống gửi trùng, giới hạn tần suất và tra cứu khách vãng lai. | Khách vãng lai đặt và tra được đơn COD. Phí đúng ở cả dưới, bằng và trên ngưỡng. Nhận tại quán có phí 0. Gửi lại không tạo đơn thứ hai. Mã sai và yêu cầu quá giới hạn bị chặn. |
| **3. Tài khoản, VietQR và quản trị** | Hoàn thiện email/mật khẩu, Google, đặt lại mật khẩu và lịch sử đơn. Làm giao diện quản trị, cấu hình ngân hàng, hiển thị QR, xác nhận tiền và tự hủy. | Quét QR ra đúng tài khoản, số tiền và nội dung. Admin xác nhận được trước hạn. Từ phút 30, máy chủ chặn xác nhận và tác vụ tự hủy cập nhật đơn trong lần chạy kế tiếp. Khách không xem được đơn của người khác hoặc vào trang quản trị. |
| **4. Kiểm thử và mở bán** | Chạy thử COD và VietQR theo cả hai hình thức nhận hàng. Kiểm tra quyền, lỗi mạng, thay đổi giá, hết hàng và xác nhận tiền sát hạn. Đo hiệu năng, cấu hình môi trường thật và rà soát quy trình xử lý chuyển khoản muộn. | Các luồng mua, thanh toán, tra cứu và xử lý đơn chạy trọn vẹn trên bản triển khai. Đạt ngưỡng Lighthouse mobile. Thông tin ngân hàng, phí giao và địa chỉ quán đã được chủ dự án xác nhận. |

## 7. Hiệu năng và tiêu chí nghiệm thu

- **Lighthouse Mobile Performance ≥ 90** cho từng trang `/`, `/san-pham`, một trang chi tiết, giỏ hàng có sản phẩm và trang thanh toán. Đo trên bản dựng production đã triển khai, với dữ liệu đại diện. Lấy điểm trung vị của ba lần đo cho mỗi trang.
- Khai báo kích thước và `sizes` phù hợp cho ảnh qua `next/image`. Chỉ ưu tiên tải ảnh chính ở đầu trang. Giới hạn ảnh từ đúng máy chủ và đường dẫn bucket Supabase.
- Phân trang menu và kết quả tìm kiếm, dùng chỉ mục cho truy vấn và giới hạn JavaScript phía trình duyệt. Chỉ dùng bộ nhớ đệm dùng chung cho nội dung công khai. Kiểm tra giá, tình trạng còn hàng và phí giao khi đặt đơn.

## 8. Biến môi trường và cấu hình triển khai

| Biến | Phạm vi và mục đích |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | URL chính của website dùng cho luồng xác thực và các liên kết tuyệt đối |
| `NEXT_PUBLIC_SUPABASE_URL` | URL dự án Supabase theo từng môi trường |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Khóa công khai cho ứng dụng dùng Supabase theo RLS |
| `SUPABASE_SECRET_KEY` | Chỉ phía máy chủ, dùng cho thao tác đặc quyền đã giới hạn như đặt đơn vãng lai và tra cứu |
| `RATE_LIMIT_HMAC_SECRET` | Chỉ phía máy chủ, dùng để băm định danh giới hạn tần suất |
| `CHECKOUT_RATE_LIMIT_MAX`, `CHECKOUT_RATE_LIMIT_WINDOW_SECONDS` | Số lần gửi đơn tối đa và độ dài cửa sổ giới hạn |
| `ORDER_LOOKUP_RATE_LIMIT_MAX`, `ORDER_LOOKUP_RATE_LIMIT_WINDOW_SECONDS` | Ngưỡng và cửa sổ giới hạn riêng cho tra cứu đơn |

Cấu hình Google OAuth trong Supabase Auth, cùng URL chuyển hướng cho các môi trường được phép. Lưu Client ID và Client Secret của Google trong cấu hình nhà cung cấp xác thực. Phí giao, ngưỡng miễn phí, địa chỉ quán và tài khoản ngân hàng lấy từ `settings`. Hạn VietQR cố định 30 phút. Ngưỡng giới hạn tần suất được chốt khi chạy thử trước khi mở bán.

## 9. Ghi chú review của Claude (đề xuất thêm)

- **Báo đơn mới cho quán:** bản đầu không có email/SMS, nên trang `/quan-tri/don-hang` nên dùng Supabase Realtime + âm báo để nhân viên không bỏ sót đơn, nhất là đơn VietQR chỉ có 30 phút.
- **Đồng hồ đếm ngược** trên trang đơn VietQR để khách biết còn bao lâu.
- **Validate số điện thoại VN** (10 số, đầu 0) và dùng `zod` cho mọi form + server action.
- **Dữ liệu mẫu (seed)** khoảng 20 món, 4 danh mục, để kiểm thử tìm kiếm và đo Lighthouse ngay từ Giai đoạn 1.
