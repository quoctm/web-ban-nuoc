# Lighthouse mobile

Đo lại ngày 22/11/2026 sau khi thêm favicon, trên bản production tại http://localhost:3000. Dùng Lighthouse 13.6.0 với Microsoft Edge headless, cấu hình mobile và mô phỏng tốc độ mặc định. Mỗi trang đo ba lần, xóa bộ nhớ đệm HTTP trước mỗi lần. Giỏ hàng và thanh toán dùng cùng một ly trà sữa trân châu cỡ M đã thêm vào giỏ.

| Trang | Performance | Accessibility | Best Practices | Ba lượt đo (P/A/BP) |
| --- | ---: | ---: | ---: | --- |
| `/` | 97 | 100 | 100 | 97/100/100, 99/100/100, 97/100/100 |
| `/san-pham` | 98 | 100 | 100 | 98/100/100, 98/100/100, 98/100/100 |
| `/san-pham/tra-sua-tran-chau` | 99 | 100 | 100 | 100/100/100, 99/100/100, 98/100/100 |
| `/gio-hang` | 100 | 100 | 100 | 96/100/100, 100/100/100, 100/100/100 |
| `/thanh-toan` | 100 | 100 | 100 | 99/100/100, 100/100/100, 100/100/100 |

Cả năm trang đạt 100 điểm Best Practices trong cả ba lượt. `/favicon.ico` trả về HTTP 200.
