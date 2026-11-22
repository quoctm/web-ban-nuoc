import { expiryMessage } from "../payments/vietqr";
import type { Order, OrderStatus } from "./model";

export const transitionLabels = {
  confirm_payment: "Xác nhận đã nhận tiền",
  preparing: "Bắt đầu chuẩn bị",
  out_for_delivery: "Đang giao",
  ready_for_pickup: "Sẵn sàng nhận tại quán",
  completed: "Hoàn tất",
  cancelled: "Hủy đơn",
};
export type Transition = keyof typeof transitionLabels;

export function orderIsExpired(order: Pick<Order, "status" | "expiresAt">, now: number) {
  return order.status === "awaiting_payment" && Boolean(order.expiresAt && Date.parse(order.expiresAt) <= now);
}

export function expireOrder(order: Order, now: number) {
  if (!orderIsExpired(order, now)) return false;
  order.status = "cancelled";
  order.cancelReason = expiryMessage;
  if (order.payment) order.payment.status = "expired";
  return true;
}

export function allowedTransitions(order: Pick<Order, "status" | "expiresAt" | "fulfillment">, now: number): Transition[] {
  if (orderIsExpired(order, now)) return [];
  switch (order.status) {
    case "awaiting_payment": return ["confirm_payment", "cancelled"];
    case "confirmed": return ["preparing", "cancelled"];
    case "preparing": return [order.fulfillment === "pickup" ? "ready_for_pickup" : "out_for_delivery", "cancelled"];
    case "out_for_delivery":
    case "ready_for_pickup": return ["completed", "cancelled"];
    default: return [];
  }
}

export function applyTransition(order: Order, transition: Transition, reason: string, now: number) {
  if (!allowedTransitions(order, now).includes(transition) || (transition === "cancelled" && !reason.trim())) return false;
  const previous = order.payment ?? { method: "cod", status: "pending" };
  if (transition === "confirm_payment" && (previous.method !== "vietqr" || previous.status !== "pending")) return false;
  order.payment = previous;
  order.status = (transition === "confirm_payment" ? "confirmed" : transition) satisfies OrderStatus;
  if (transition === "confirm_payment" || (transition === "completed" && previous.method === "cod")) {
    order.payment.status = "paid";
    order.payment.paidAt = new Date(now).toISOString();
  }
  if (transition === "cancelled") {
    if (order.payment.status === "pending") order.payment.status = "cancelled";
    order.cancelReason = reason.trim();
  }
  return true;
}
