import QRCode from "qrcode";
import { formatVnd } from "@/lib/currency";
import type { Order } from "../orders/model";
import { PaymentPanel } from "./payment-panel";
import { bankName, expiryMessage, vietQrPayload } from "./vietqr";

function currentTime() { return Date.now(); }

export async function OrderPayment({ order, live }: { order: Order; live: boolean }) {
  const payment = order.payment;
  if (payment?.method !== "vietqr") return <p>{payment?.status === "paid" ? "Đã thu tiền COD" : "Thanh toán COD khi nhận hàng"}</p>;
  if (payment.status === "expired") return <p role="status">{expiryMessage}</p>;
  if (payment.status === "paid") return <p>Đã nhận thanh toán VietQR</p>;
  if (order.status !== "awaiting_payment" || !order.expiresAt || !payment.bank || !payment.reference) return <p>Thanh toán VietQR</p>;
  const expiresAt = Date.parse(order.expiresAt);
  if (expiresAt <= currentTime()) return <p role="status">{expiryMessage}</p>;
  const qr = await QRCode.toDataURL(vietQrPayload(payment.bank, order.total, payment.reference), { errorCorrectionLevel: "M" });
  return <PaymentPanel live={live} qr={qr} expiresAt={expiresAt} serverNow={currentTime()} fields={[
    { label: "Ngân hàng", value: bankName(payment.bank.bank_bin) },
    { label: "Số tài khoản", value: payment.bank.bank_account_number, copy: payment.bank.bank_account_number },
    { label: "Chủ tài khoản", value: payment.bank.bank_account_name },
    { label: "Số tiền", value: formatVnd(order.total), copy: String(order.total) },
    { label: "Nội dung", value: payment.reference, copy: payment.reference },
  ]} />;
}
