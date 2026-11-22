import { describe, expect, it } from "vitest";
import { orderAlphabet, orderCodeSchema } from "./model";
import { maskOrderContact } from "./privacy";

describe("mã tra cứu đơn", () => {
  it.each([
    ["MN-234ABCDE", "MN-234ABCDE"],
    ["  234abcde  ", "MN-234ABCDE"],
    [" mn - 234 abcde ", "MN-234ABCDE"],
    [" mn-234abc ", "MN-234ABC"],
    ["234abc", "MN-234ABC"],
  ])("chuẩn hóa %s thành %s", (input, expected) => {
    expect(orderCodeSchema.parse(input)).toBe(expected);
  });

  it.each(["0", "O", "1", "I"])("từ chối ký tự dễ nhầm %s", (character) => {
    expect(orderCodeSchema.safeParse("234ABCD" + character).success).toBe(false);
  });

  it("chỉ chấp nhận mã dài 6 hoặc 8 ký tự trong bảng chữ 32 ký tự", () => {
    expect(new Set(orderAlphabet).size).toBe(32);
    expect(orderCodeSchema.safeParse("234ABCD").success).toBe(false);
    expect(orderCodeSchema.safeParse("234ABCDEF").success).toBe(false);
  });
});

describe("che thông tin khi chỉ có mã đơn", () => {
  const delivery = {
    customerName: "Nguyễn Văn Tâm", phone: "0912345678",
    address: "12 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM", fulfillment: "delivery",
  } as const;

  it("rút gọn tên và chỉ giữ quận, thành phố cùng phần đầu và cuối số điện thoại", () => {
    expect(maskOrderContact(delivery)).toEqual({
      customerName: "Nguyễn T.", phone: "091****678", address: "Quận 1, TP.HCM",
    });
  });

  it.each(["12 Nguyễn Huệ", "Quận 1 đường Nguyễn Huệ", "12 Nguyễn Huệ, Quận Gò Vấp nhà anh An"])(
    "ẩn địa chỉ khi phần cuối còn lẫn nội dung riêng tư",
    (address) => {
      expect(maskOrderContact({ ...delivery, address }).address).toBe("Đã ẩn địa chỉ giao hàng");
    },
  );

  it("ẩn phần còn lại của tên chỉ có một từ", () => {
    expect(maskOrderContact({ ...delivery, customerName: "Tâm" }).customerName).toBe("T.");
  });

  it("giữ địa chỉ công khai của quán khi khách chọn nhận tại quán", () => {
    expect(maskOrderContact({ ...delivery, fulfillment: "pickup" }).address).toBe(delivery.address);
  });
});
