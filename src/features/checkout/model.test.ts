import { describe, expect, it } from "vitest";
import { checkoutSchema, defaultSettings, deliveryFee } from "./model";

describe("phí giao hàng", () => {
  it.each([[149_999, 15_000], [150_000, 0], [150_001, 0]])("tạm tính %i₫ có phí giao %i₫", (subtotal, expected) => {
    expect(deliveryFee(subtotal, "delivery", defaultSettings)).toBe(expected);
  });

  it("nhận tại quán có phí bằng 0", () => {
    expect(deliveryFee(1, "pickup", defaultSettings)).toBe(0);
  });

  it("dùng phí và ngưỡng của quán", () => {
    const settings = { delivery_fee_vnd: 20_000, free_delivery_threshold_vnd: 175_000, pickup_address: "Địa chỉ" };
    expect(deliveryFee(150_000, "delivery", settings)).toBe(20_000);
    expect(deliveryFee(175_000, "delivery", settings)).toBe(0);
  });
});

const order = {
  customerName: "  Nguyễn An  ", phone: "0912345678", fulfillment: "delivery",
  address: "1 Nguyễn Huệ", note: "", payment: "cod", expectedFee: 15_000,
  idempotencyKey: "e9001ac1-6868-454b-9c5b-342f23863b7b",
  items: [{ variantId: "tra-sua-M", sugar: "50%", ice: "Ít đá", quantity: 1, expectedPrice: 39_000 }],
};

describe("biểu mẫu đặt đơn", () => {
  it("chấp nhận đơn hợp lệ và chuẩn hóa họ tên", () => {
    expect(checkoutSchema.parse(order).customerName).toBe("Nguyễn An");
  });

  it.each(["912345678", "8412345678", "09123a5678", "09123456789"])("từ chối số điện thoại %s", (phone) => {
    expect(checkoutSchema.safeParse({ ...order, phone }).success).toBe(false);
  });

  it("chỉ yêu cầu địa chỉ khi giao hàng", () => {
    expect(checkoutSchema.safeParse({ ...order, address: " " }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...order, fulfillment: "pickup", address: "" }).success).toBe(true);
  });

  it.each([["customerName", 100], ["address", 300], ["note", 500]] as const)(
    "áp dụng giới hạn ký tự Unicode cho %s",
    (field, limit) => {
      expect(checkoutSchema.safeParse({ ...order, [field]: "🍹".repeat(limit) }).success).toBe(true);
      expect(checkoutSchema.safeParse({ ...order, [field]: "🍹".repeat(limit + 1) }).success).toBe(false);
    },
  );

  it("từ chối phương thức không hỗ trợ, giỏ trống, dòng trùng và số lượng vượt giới hạn", () => {
    const invalid = [
      { payment: "card" },
      { items: [] },
      { items: [...order.items, ...order.items] },
      { items: [{ ...order.items[0], quantity: 100 }] },
    ];
    for (const fields of invalid) expect(checkoutSchema.safeParse({ ...order, ...fields }).success).toBe(false);
  });
});
