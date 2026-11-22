export const banks = {
  "970436": "Vietcombank",
  "970415": "VietinBank",
  "970418": "BIDV",
  "970405": "Agribank",
  "970422": "MB",
  "970407": "Techcombank",
  "970416": "ACB",
  "970432": "VPBank",
  "970423": "TPBank",
  "970403": "Sacombank",
  "970437": "HDBank",
  "970441": "VIB",
} as const;

export type BankDetails = {
  bank_bin: string;
  bank_account_number: string;
  bank_account_name: string;
};

export const paymentWindowMs = 30 * 60_000;
export const expiryMessage = "Đơn đã hủy do quá hạn thanh toán";

export function hasBank(bank: BankDetails) {
  return /^[0-9]{6}$/.test(bank.bank_bin) && /^[0-9]{4,19}$/.test(bank.bank_account_number)
    && /^[A-Z0-9 .'-]{2,70}$/.test(bank.bank_account_name);
}

export function bankName(bin: string) {
  return banks[bin as keyof typeof banks] ?? bin;
}

export function crc16(value: string) {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(value)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) crc = ((crc << 1) ^ (crc & 0x8000 ? 0x1021 : 0)) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function field(id: string, value: string) {
  return id + String(new TextEncoder().encode(value).length).padStart(2, "0") + value;
}

export function vietQrPayload(bank: BankDetails, amount: number, reference: string) {
  if (!hasBank(bank) || !Number.isSafeInteger(amount) || amount < 1 || amount > 2147483647
    || !/^[A-Z0-9]{1,25}$/.test(reference)) throw new Error("Thông tin VietQR không hợp lệ.");
  const recipient = field("00", bank.bank_bin) + field("01", bank.bank_account_number);
  const merchant = field("00", "A000000727") + field("01", recipient) + field("02", "QRIBFTTA");
  const payload = field("00", "01") + field("01", "12") + field("38", merchant)
    + field("53", "704") + field("54", String(amount)) + field("58", "VN")
    + field("62", field("08", reference)) + "6304";
  return payload + crc16(payload);
}
