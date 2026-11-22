import { describe, expect, it } from "vitest";
import { crc16, hasBank, vietQrPayload } from "./vietqr";

const bank = { bank_bin: "970436", bank_account_number: "0000000000", bank_account_name: "TAI KHOAN MAU" };
function fields(payload: string) {
  const results: Record<string, string> = {};
  while (payload.length) {
    const length = Number(payload.slice(2, 4));
    expect(payload).toMatch(/^\d{4}/);
    expect(payload.length).toBeGreaterThanOrEqual(length + 4);
    results[payload.slice(0, 2)] = payload.slice(4, length + 4);
    payload = payload.slice(length + 4);
  }
  return results;
}

describe("VietQR", () => {
  it("tính CRC-16/CCITT-FALSE theo vectơ chuẩn", () => {
    expect(crc16("123456789")).toBe("29B1");
  });
  it("mã hóa tài khoản, VND, số tiền và nội dung theo trường EMV", () => {
    const payload = vietQrPayload(bank, 54000, "MN23456789");
    const tags = fields(payload);
    expect(tags).toMatchObject({ "00": "01", "01": "12", "53": "704", "54": "54000", "58": "VN" });
    const recipient = fields(tags["38"]);
    expect(recipient).toMatchObject({ "00": "A000000727", "02": "QRIBFTTA" });
    expect(fields(recipient["01"])).toEqual({ "00": "970436", "01": "0000000000" });
    expect(fields(tags["62"])).toEqual({ "08": "MN23456789" });
    expect(tags["63"]).toBe(crc16(payload.slice(0, -4)));
  });
  it("từ chối cấu hình thiếu, tổng bằng 0 và nội dung sai định dạng", () => {
    expect(hasBank({ ...bank, bank_account_name: "" })).toBe(false);
    expect(() => vietQrPayload(bank, 0, "MN23456789")).toThrow();
    expect(() => vietQrPayload(bank, 54000, "MN-23456789")).toThrow();
  });
});
