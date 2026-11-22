"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { formatVnd } from "@/lib/currency";
import { lineKey, selectionLabel } from "../cart/model";
import { clearCart, useCart } from "../cart/store";
import { useCartReview } from "../cart/use-cart-review";
import { orderPath } from "../orders/model";
import { placeOrder } from "./actions";
import { checkoutSchema, configurationMessage, deliveryFee, fulfillmentSchema, type Fulfillment } from "./model";
import { OrderTotals } from "./order-totals";

type EditableField = "customerName" | "phone" | "address" | "note";

export function CheckoutView({ contact }: { contact?: { customerName: string; phone: string } }) {
  const router = useRouter();
  const { lines, ready } = useCart();
  // Keep the server snapshot for the lifetime of the form, including router refreshes.
  const [initialContact] = useState(() => ({
    customerName: contact?.customerName ?? "",
    phone: contact?.phone ?? "",
  }));
  const { review, byKey, subtotal, unavailable, changed, error: reviewError, refresh } = useCartReview(lines);
  const [fulfillment, setFulfillment] = useState<Fulfillment>("delivery");
  const [selectedPayment, setSelectedPayment] = useState<"cod" | "vietqr">("cod");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const idempotencyKey = useRef<string | null>(null);
  const submitting = useRef(false);

  useEffect(() => { idempotencyKey.current ??= crypto.randomUUID(); }, []);

  const fee = review ? deliveryFee(subtotal, fulfillment, review.settings) : 0;
  const vietqrAvailable = Boolean(review?.vietqrAvailable && subtotal + fee > 0);
  const payment = vietqrAvailable ? selectedPayment : "cod";
  const canSubmit = review?.checkoutAvailable && !unavailable;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || submitting.current) return;
    const fields = new FormData(event.currentTarget);
    const parsed = checkoutSchema.safeParse({
      idempotencyKey: idempotencyKey.current ??= crypto.randomUUID(),
      customerName: fields.get("customerName"),
      phone: fields.get("phone"),
      fulfillment: fields.get("fulfillment"),
      address: fields.get("address") ?? "",
      note: fields.get("note"),
      payment: fields.get("payment"),
      expectedFee: fee,
      items: lines.map((line) => ({ ...line, expectedPrice: byKey.get(lineKey(line))?.price })),
    });
    setError("");
    setFieldErrors({});
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors);
      return;
    }

    submitting.current = true;
    setPending(true);
    try {
      // A form body keeps checkout data out of action argument logs.
      const payload = new FormData();
      payload.set("checkout", JSON.stringify(parsed.data));
      const result = await placeOrder(payload);
      if (result.code) {
        clearCart();
        router.replace(orderPath(result.code));
        return;
      }
      setError(result.error ?? "Chưa thể xác nhận đơn. Vui lòng thử lại.");
      if (result.changed) refresh();
    } catch {
      setError("Chưa thể xác nhận đơn. Vui lòng thử lại.");
    }
    submitting.current = false;
    setPending(false);
  }

  if (!ready || (pending && !lines.length)) return <p role="status">{pending ? "Đang mở đơn hàng…" : "Đang mở giỏ hàng…"}</p>;
  if (!lines.length) return <div className="shop-panel shop-stack">
    <p>Giỏ hàng đang trống.</p><Link href="/san-pham" className="button button-primary">Về thực đơn</Link>
  </div>;

  function clearFieldError(name: EditableField) {
    setFieldErrors((current) => {
      if (!current[name]) return current;
      const remaining = { ...current };
      delete remaining[name];
      return remaining;
    });
  }

  function fieldProps(name: EditableField) {
    return {
      id: `checkout-${name}`,
      name,
      "aria-invalid": Boolean(fieldErrors[name]?.length),
      "aria-describedby": fieldErrors[name]?.length ? `checkout-${name}-error` : undefined,
      onChange: () => clearFieldError(name),
    };
  }

  function fieldError(name: EditableField) {
    const message = fieldErrors[name]?.[0];
    return message && <span id={`checkout-${name}-error`} className="shop-error">{message}</span>;
  }

  return (
    <form noValidate onSubmit={submit} className="shop-columns">
      <section className="shop-panel shop-stack" aria-labelledby="contact-heading">
        <h2 id="contact-heading">Thông tin nhận hàng</h2>
        <fieldset className="shop-stack" disabled={pending}>
          <div className="shop-field">
            <label htmlFor="checkout-customerName">Họ và tên</label>
            <input {...fieldProps("customerName")} autoComplete="name" defaultValue={initialContact.customerName} required />
            {fieldError("customerName")}
          </div>
          <div className="shop-field">
            <label htmlFor="checkout-phone">Số điện thoại</label>
            <input {...fieldProps("phone")} type="tel" autoComplete="tel" defaultValue={initialContact.phone} inputMode="tel" required />
            {fieldError("phone")}
          </div>
          <fieldset className="shop-choices">
            <legend>Hình thức nhận hàng</legend>
            {fulfillmentSchema.options.map((option) => (
              <div className="shop-choice" key={option}>
                <input id={`checkout-${option}`} type="radio" name="fulfillment" value={option}
                  checked={fulfillment === option} onChange={() => {
                    setFulfillment(option);
                    clearFieldError("address");
                  }} />
                <label htmlFor={`checkout-${option}`}>{option === "delivery" ? "Giao hàng" : "Nhận tại quán"}</label>
              </div>
            ))}
          </fieldset>
          <div className="shop-field" hidden={fulfillment !== "delivery"}>
            <label htmlFor="checkout-address">Địa chỉ giao hàng</label>
            <input {...fieldProps("address")} autoComplete="street-address"
              required={fulfillment === "delivery"} disabled={fulfillment !== "delivery"} />
            {fieldError("address")}
          </div>
          {fulfillment === "pickup" && review && <p>Địa chỉ quán: {review.settings.pickup_address}</p>}
          <div className="shop-field">
            <label htmlFor="checkout-note">Ghi chú <span className="shop-muted">(không bắt buộc)</span></label>
            <textarea {...fieldProps("note")} rows={3} />
            {fieldError("note")}
          </div>
          <fieldset className="shop-choices">
            <legend>Thanh toán</legend>
            <div className="shop-choice">
              <input id="checkout-payment-cod" type="radio" name="payment" value="cod"
                checked={payment === "cod"} onChange={() => setSelectedPayment("cod")} />
              <label htmlFor="checkout-payment-cod">COD khi nhận hàng</label>
            </div>
            <div className="shop-choice">
              <input id="checkout-payment-vietqr" type="radio" name="payment" value="vietqr"
                disabled={!vietqrAvailable} checked={payment === "vietqr"} onChange={() => setSelectedPayment("vietqr")} />
              <label htmlFor="checkout-payment-vietqr">VietQR (chuyển khoản)</label>
            </div>
            {review && !review.vietqrAvailable && <p className="shop-muted">VietQR chưa có thông tin ngân hàng.</p>}
            {review?.vietqrAvailable && subtotal + fee <= 0 && <p className="shop-muted">VietQR yêu cầu số tiền lớn hơn 0₫.</p>}
          </fieldset>
        </fieldset>
      </section>

      <aside className="shop-panel shop-stack">
        <h2>Đơn hàng của bạn</h2>
        <ul className="shop-line-list">
          {lines.map((line) => {
            const key = lineKey(line);
            const price = byKey.get(key)?.price;
            return <li key={key} className="shop-summary-line">
              <div><strong>{line.quantity} × {line.name}</strong><p className="shop-muted">{selectionLabel(line)}</p></div>
              <span>{typeof price === "number" ? formatVnd(price * line.quantity) : price === null ? "Ngừng bán" : "—"}</span>
            </li>;
          })}
        </ul>
        {review && <OrderTotals subtotal={subtotal} fee={fee} total={subtotal + fee} />}
        {!review && !reviewError && <p role="status">Đang kiểm tra giá và phí giao…</p>}
        {reviewError && <><p role="alert" className="shop-error">{reviewError}</p><button type="button" className="button" onClick={refresh}>Thử lại</button></>}
        {changed && <p className="shop-notice" role="status">Giá một số món đã thay đổi. Vui lòng xem lại tổng tiền.</p>}
        {unavailable && <p className="shop-notice" role="status">Có món đã ngừng bán. Vui lòng chỉnh giỏ hàng.</p>}
        {review && !review.checkoutAvailable && <p className="shop-notice">{configurationMessage}</p>}
        {Object.keys(fieldErrors).length > 0 && <p className="shop-error" role="alert">Vui lòng kiểm tra thông tin đặt hàng.</p>}
        {error && <p className="shop-error" role="alert">{error}</p>}
        <button type="submit" className="button button-primary" disabled={pending || !canSubmit}>
          {pending ? "Đang đặt đơn…" : "Đặt đơn"}
        </button>
        <Link href="/gio-hang" className="text-link">Về giỏ hàng</Link>
      </aside>
    </form>
  );
}
