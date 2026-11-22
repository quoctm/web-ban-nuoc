"use client";

export default function PageError({ reset }: { reset: () => void }) {
  return <section className="shell shop-page shop-stack" role="alert">
    <h1>Chưa tải được trang</h1>
    <p>Hãy thử lại. Nếu lỗi tiếp diễn, quản trị viên cần kiểm tra các tệp dữ liệu cục bộ và bản sao lưu.</p>
    <button className="button button-primary" onClick={reset}>Thử lại</button>
  </section>;
}
