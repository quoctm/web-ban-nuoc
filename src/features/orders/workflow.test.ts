import { describe, expect, it } from "vitest";
import { paymentWindowMs } from "../payments/vietqr";
import type { Order } from "./model";
import { allowedTransitions, applyTransition, expireOrder } from "./workflow";

const start = Date.UTC(2026, 10, 22);
const deadline = start + paymentWindowMs;

function example(overrides: Partial<Order> = {}): Order {
  return {
    code: "MN-23456789", fulfillment: "pickup", customerName: "Khách Thử", phone: "0900000000",
    address: "Quán thử", note: null, subtotal: 39000, fee: 0, total: 39000, items: [],
    status: "awaiting_payment", expiresAt: new Date(deadline).toISOString(),
    payment: { method: "vietqr", status: "pending" }, ...overrides,
  };
}

describe("xử lý đơn", () => {
  it("cho xác nhận ở mili giây cuối và giữ khoản đã nhận khi hủy", () => {
    const order = example();
    expect(applyTransition(order, "confirm_payment", "", deadline - 1)).toBe(true);
    expect(order.status).toBe("confirmed");
    expect(order.payment?.status).toBe("paid");
    expect(expireOrder(order, deadline)).toBe(false);
    expect(applyTransition(order, "cancelled", " Món hết ", deadline)).toBe(true);
    expect(order.cancelReason).toBe("Món hết");
    expect(order.payment?.status).toBe("paid");
  });
  it("không xác nhận từ đúng thời điểm hết hạn, chỉ hủy một lần", () => {
    const order = example();
    expect(expireOrder(order, deadline - 1)).toBe(false);
    expect(allowedTransitions(order, deadline)).toEqual([]);
    expect(applyTransition(order, "confirm_payment", "", deadline)).toBe(false);
    expect(expireOrder(order, deadline)).toBe(true);
    expect(order.status).toBe("cancelled");
    expect(order.payment?.status).toBe("expired");
    expect(expireOrder(order, deadline + 1)).toBe(false);
  });
  it("chỉ cho chuyển theo hình thức nhận và ghi tiền COD lúc hoàn tất", () => {
    const order = example({ status: "confirmed", expiresAt: null, payment: { method: "cod", status: "pending" } });
    expect(applyTransition(order, "completed", "", start)).toBe(false);
    expect(applyTransition(order, "cancelled", "", start)).toBe(false);
    expect(applyTransition(order, "preparing", "", start)).toBe(true);
    expect(applyTransition(order, "out_for_delivery", "", start)).toBe(false);
    expect(applyTransition(order, "ready_for_pickup", "", start)).toBe(true);
    expect(applyTransition(order, "completed", "", start)).toBe(true);
    expect(order.payment?.status).toBe("paid");
    expect(allowedTransitions(order, start)).toEqual([]);
  });
  it("hủy giao hàng đang chuẩn bị và giữ các bước giao hàng hợp lệ", () => {
    const order = example({ fulfillment: "delivery", status: "preparing", expiresAt: null, payment: { method: "cod", status: "pending" } });
    expect(allowedTransitions(order, start)).toEqual(["out_for_delivery", "cancelled"]);
    expect(applyTransition(order, "cancelled", "Hết món", start)).toBe(true);
    expect(order.payment?.status).toBe("cancelled");
  });
});
