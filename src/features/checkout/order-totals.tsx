import { formatVnd } from "@/lib/currency";

export function OrderTotals({ subtotal, fee, total }: { subtotal: number; fee: number; total: number }) {
  return <dl className="shop-totals">
    <div><dt>Tạm tính</dt><dd>{formatVnd(subtotal)}</dd></div>
    <div><dt>Phí giao hàng</dt><dd>{formatVnd(fee)}</dd></div>
    <div className="shop-total"><dt>Tổng cộng</dt><dd>{formatVnd(total)}</dd></div>
  </dl>;
}
