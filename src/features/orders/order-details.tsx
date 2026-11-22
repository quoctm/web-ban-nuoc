import { formatVnd } from "@/lib/currency";
import { lineKey, selectionLabel } from "../cart/model";
import { OrderTotals } from "../checkout/order-totals";
import { OrderPayment } from "../payments/order-payment";
import { bankName } from "../payments/vietqr";
import { statusLabels, type Order } from "./model";

export function OrderDetails({ order, contact, fullAccess = false, admin = false }: {
  order: Order; contact: Pick<Order, "customerName" | "phone" | "address">; fullAccess?: boolean; admin?: boolean;
}) {
  const payment = order.payment;
  return <div className="shop-columns">
    <section className="shop-panel shop-stack">
      <h2>Các món đã đặt</h2>
      <ul className="shop-line-list">
        {order.items.map((item) => (
          <li key={lineKey(item)} className="shop-summary-line">
            <div><strong>{item.quantity} × {item.name}</strong><p className="shop-muted">{selectionLabel(item)}</p></div>
            <span>{formatVnd(item.price * item.quantity)}</span>
          </li>
        ))}
      </ul>
    </section>
    <section className="shop-panel shop-stack">
      <h2>{statusLabels[order.status]}</h2>
      <OrderPayment order={order} live={fullAccess} />
      {admin && payment?.method === "vietqr" && payment.bank && order.status !== "awaiting_payment" &&
        <div className="shop-stack">
          <p><strong>Thông tin chuyển khoản của đơn</strong><br />
            {bankName(payment.bank.bank_bin)} · {payment.bank.bank_account_number} · {payment.bank.bank_account_name}<br />
            Nội dung {payment.reference}
          </p>
        </div>}
      {admin && payment?.paidAt && <p>Ghi nhận tiền lúc {new Intl.DateTimeFormat("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short",
      }).format(new Date(payment.paidAt))}</p>} 
      {fullAccess && order.cancelReason && order.payment?.status !== "expired" && <p>Lý do hủy: {order.cancelReason}</p>}
      <p><strong>Họ và tên</strong><br />{contact.customerName}</p>
      <p><strong>Số điện thoại</strong><br />{contact.phone}</p>
      <p className="order-address"><strong>{order.fulfillment === "delivery" ? "Giao đến" : "Nhận tại quán"}</strong><br />{contact.address}</p>
      {order.note && <div><strong>Ghi chú</strong><p className="order-note">{order.note}</p></div>}
      <OrderTotals subtotal={order.subtotal} fee={order.fee} total={order.total} />
    </section>
  </div>;
}
