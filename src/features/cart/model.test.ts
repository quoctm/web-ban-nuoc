import { describe, expect, it } from "vitest";
import { lineKey, mergeLine, parseStoredCart, type CartLine } from "./model";

const drink: CartLine = { variantId: "tra-sua-M", name: "Trà sữa", size: "M", quantity: 2, price: 39_000, sugar: "50%", ice: "Ít đá" };

describe("gộp giỏ hàng", () => {
  it("cộng số lượng cho cùng biến thể, đường và đá", () => {
    expect(mergeLine([drink], { ...drink, quantity: 3 })).toEqual([{ ...drink, quantity: 5 }]);
  });

  it("giới hạn 99 món mỗi dòng", () => {
    expect(mergeLine([drink], { ...drink, quantity: 99 })[0].quantity).toBe(99);
  });

  it("giữ giá đã lưu để đối chiếu khi giá món thay đổi", () => {
    expect(mergeLine([drink], { ...drink, price: 45_000 })[0].price).toBe(39_000);
  });

  it("tách dòng khi đổi size, đường hoặc đá", () => {
    const alternatives: CartLine[] = [
      { ...drink, variantId: "tra-sua-L", size: "L" },
      { ...drink, sugar: "100%" },
      { ...drink, ice: "Không đá" },
    ];
    const lines = alternatives.reduce(mergeLine, [drink]);
    expect(new Set(lines.map(lineKey)).size).toBe(4);
  });
});

describe("đọc giỏ đã lưu", () => {
  it("chỉ bỏ các dòng sai và vẫn gộp các dòng hợp lệ", () => {
    const alternative: CartLine = { ...drink, sugar: "0%" };
    const raw = JSON.stringify([drink, null, { ...drink, quantity: 100 }, alternative, drink]);
    expect(parseStoredCart(raw)).toEqual([{ ...drink, quantity: 4 }, alternative]);
  });

  it("khôi phục giỏ trống khi dữ liệu gốc không phải mảng hợp lệ", () => {
    expect(parseStoredCart("{")).toEqual([]);
    expect(parseStoredCart("{}")).toEqual([]);
  });
});
