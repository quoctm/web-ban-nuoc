"use client";

import Link from "next/link";
import { formatVnd } from "@/lib/currency";
import { configurationMessage } from "../checkout/model";
import { lineKey, MAX_QUANTITY, selectionLabel } from "./model";
import { changeQuantity, removeLine, useCart } from "./store";
import { useCartReview } from "./use-cart-review";

export function CartView() {
  const { lines, ready, storageAvailable } = useCart();
  const { review, byKey, subtotal, error, unavailable, changed, previousPrices, refresh } = useCartReview(lines);

  if (!ready) return <p role="status">Đang mở giỏ hàng…</p>;

  return (
    <>
      {!storageAvailable && <p role="status" className="shop-notice">Trình duyệt không lưu được giỏ hàng. Giỏ chỉ dùng được trong phiên này.</p>}
      {!lines.length ? (
        <div className="shop-panel shop-stack">
          <p>Giỏ hàng đang trống. Chọn món yêu thích trong thực đơn để bắt đầu.</p>
          <Link href="/san-pham" className="button button-primary">Về thực đơn</Link>
        </div>
      ) : (
        <div className="shop-columns">
          <section className="shop-panel shop-stack" aria-label="Các món trong giỏ">
            {changed && <p role="status" className="shop-notice">Giá một số món đã thay đổi. Giá mới được hiển thị bên dưới.</p>}
            {unavailable && <p role="status" className="shop-notice">Một số lựa chọn đã ngừng bán. Vui lòng xóa các dòng này để thanh toán.</p>}
            <ul className="shop-line-list">
              {lines.map((line) => {
                const key = lineKey(line);
                const current = byKey.get(key);
                const price = current?.price ?? line.price;
                const previous = previousPrices?.get(key);
                return (
                  <li key={key} className="shop-line">
                    <div>
                      <h2>{line.name}</h2>
                      <p className="shop-muted">{selectionLabel(line)}</p>
                      {current?.price === null ? <p className="shop-error">Đã ngừng bán</p> : (
                        <p>{previous !== undefined && <><del className="shop-muted">{formatVnd(previous)}</del>{" "}</>}{formatVnd(price)}</p>
                      )}
                    </div>
                    <div className="shop-line-controls">
                      <div className="quantity-stepper" aria-label={`Số lượng ${line.name}`}>
                        <button type="button" aria-label={`Giảm số lượng ${line.name}`} disabled={line.quantity === 1}
                          onClick={() => changeQuantity(key, line.quantity - 1)}>−</button>
                        <span className="cart-quantity" aria-live="polite">{line.quantity}</span>
                        <button type="button" aria-label={`Tăng số lượng ${line.name}`} disabled={line.quantity === MAX_QUANTITY}
                          onClick={() => changeQuantity(key, line.quantity + 1)}>+</button>
                      </div>
                      <button type="button" className="text-link" aria-label={`Xóa ${line.name}`} onClick={() => removeLine(key)}>Xóa</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
          <aside className="shop-panel shop-stack">
            <div className="shop-total"><span>Tạm tính</span><strong>{review ? formatVnd(subtotal) : "—"}</strong></div>
            {error && <><p role="alert" className="shop-error">{error}</p><button type="button" className="button" onClick={refresh}>Thử lại</button></>}
            {!review && !error && <p role="status">Đang kiểm tra giá và tình trạng món…</p>}
            {review && !review.checkoutAvailable && <p className="shop-notice">{configurationMessage}</p>}
            {review?.checkoutAvailable && !unavailable && <Link href="/thanh-toan" className="button button-primary">Sang thanh toán</Link>}
            <Link href="/san-pham" className="text-link">Chọn thêm món</Link>
          </aside>
        </div>
      )}
    </>
  );
}
