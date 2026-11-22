import { z } from "zod";
import { lineKey, MAX_CART_LINES, priceSchema, quantitySchema, selectionSchema } from "../cart/model.ts";

export const fulfillmentSchema = z.enum(["delivery", "pickup"]);
export type Fulfillment = z.infer<typeof fulfillmentSchema>;

export const defaultSettings = {
  delivery_fee_vnd: 15_000,
  free_delivery_threshold_vnd: 150_000,
  pickup_address: "Cập nhật trong trang quản trị",
};
export type DeliverySettings = typeof defaultSettings;

export const configurationMessage = "Cần cấu hình Supabase và khóa máy chủ để sử dụng tính năng đặt và tra cứu đơn.";

export function deliveryFee(subtotal: number, fulfillment: Fulfillment, settings: DeliverySettings) {
  return fulfillment === "delivery" && subtotal < settings.free_delivery_threshold_vnd
    ? settings.delivery_fee_vnd : 0;
}

const quotedLineSchema = selectionSchema.extend({ quantity: quantitySchema, expectedPrice: priceSchema });

export const reviewSchema = z.array(selectionSchema.extend({ price: priceSchema })).max(MAX_CART_LINES);

function limitedText(limit: number, message: string) {
  return z.string().trim().refine((value) => Array.from(value).length <= limit, message);
}
export const checkoutSchema = z.object({
  customerName: limitedText(100, "Họ tên tối đa 100 ký tự.")
    .refine((value) => Array.from(value).length >= 2, "Vui lòng nhập họ tên."),
  phone: z.string().trim().regex(/^0[0-9]{9}$/, "Số điện thoại phải có 10 chữ số và bắt đầu bằng 0."),
  fulfillment: fulfillmentSchema,
  address: limitedText(300, "Địa chỉ tối đa 300 ký tự."),
  note: limitedText(500, "Ghi chú tối đa 500 ký tự."),
  payment: z.enum(["cod", "vietqr"]),
  idempotencyKey: z.uuid({ version: "v4" }).transform((key) => key.toLowerCase()),
  expectedFee: priceSchema,
  items: z.array(quotedLineSchema).min(1).max(MAX_CART_LINES),
}).superRefine(({ fulfillment, address, items }, context) => {
  if (fulfillment === "delivery" && !address) {
    context.addIssue({ code: "custom", path: ["address"], message: "Vui lòng nhập địa chỉ giao hàng." });
  }
  if (new Set(items.map(lineKey)).size !== items.length) {
    context.addIssue({ code: "custom", path: ["items"], message: "Giỏ hàng có lựa chọn bị trùng." });
  }
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export type ReviewedLine = { key: string; price: number | null; changed: boolean };
export type CartReview = { lines: ReviewedLine[]; settings: DeliverySettings; checkoutAvailable: boolean; vietqrAvailable: boolean };
