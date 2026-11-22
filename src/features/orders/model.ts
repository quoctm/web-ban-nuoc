import { z } from "zod";
import type { CartLine } from "../cart/model";
import type { BankDetails } from "../payments/vietqr";
import type { Fulfillment } from "../checkout/model";

export const orderAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const orderCodeLength = 8;
const codeCharacters = "[" + orderAlphabet + "]";
const codePattern = new RegExp(`^(?:${codeCharacters}{6}|${codeCharacters}{${orderCodeLength}})$`, "i");

export const orderCodeSchema = z.string()
  .transform((code) => code.replace(/\s/g, "").replace(/^MN-/i, ""))
  .pipe(z.string().regex(codePattern))
  .transform((code) => "MN-" + code.toUpperCase());

export const statusLabels = {
  awaiting_payment: "Chờ thanh toán",
  confirmed: "Đã xác nhận",
  preparing: "Đang chuẩn bị",
  out_for_delivery: "Đang giao",
  ready_for_pickup: "Sẵn sàng nhận tại quán",
  completed: "Đã hoàn tất",
  cancelled: "Đã hủy",
};

export type OrderItem = Pick<CartLine, "variantId" | "name" | "size" | "price" | "quantity" | "sugar" | "ice">;
export type OrderStatus = keyof typeof statusLabels;
export type Payment = {
  method: "cod" | "vietqr";
  status: "pending" | "paid" | "expired" | "cancelled";
  bank?: BankDetails;
  reference?: string;
  paidAt?: string;
};
export type Order = {
  code: string;
  status: OrderStatus;
  userId?: string | null;
  createdAt?: string;
  expiresAt?: string | null;
  cancelReason?: string | null;
  payment?: Payment;
  fulfillment: Fulfillment;
  customerName: string;
  phone: string;
  address: string;
  note: string | null;
  subtotal: number;
  fee: number;
  total: number;
  items: OrderItem[];
};

export const unknownOrder = "Không tìm thấy đơn hàng. Vui lòng kiểm tra lại mã đơn.";
export const lookupLimitMessage = "Bạn đã tra cứu quá nhiều lần. Vui lòng đợi một lúc rồi thử lại.";
export const lookupErrorMessage = "Chưa thể tra cứu đơn. Vui lòng thử lại.";
export const orderPath = (code: string) => `/don-hang/${code}`;
