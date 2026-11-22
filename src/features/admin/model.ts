import { z } from "zod";
import { slugSchema } from "../catalog/filters";
import { banks, hasBank } from "../payments/vietqr";

export function withoutAccents(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").replace(/[đĐ]/g, (value) => value === "đ" ? "d" : "D");
}

const sluggedName = z.string().trim().min(2).max(80)
  .refine((value) => slugSchema.safeParse(toSlug(value)).success, "Tên cần có chữ hoặc số.");
export function toSlug(name: string) {
  return withoutAccents(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const id = z.string().regex(/^[a-zA-Z0-9-]{1,100}$/);
const editId = z.union([id, z.literal("")]);
const checkbox = z.enum(["on"]).optional().transform((value) => value === "on");
const money = z.string().regex(/^\d{1,10}$/).transform(Number).pipe(z.int().min(0).max(2147483647));
const optionalMoney = z.union([money, z.literal("").transform(() => null)]);

export const categorySchema = z.object({
  id: editId,
  name: sluggedName,
  sort_order: z.string().regex(/^\d{1,6}$/).transform(Number),
  is_active: checkbox,
});

export const productSchema = z.object({
  id: editId,
  category_id: id,
  name: sluggedName,
  description: z.string().trim().max(1000),
  is_active: checkbox,
  is_available: checkbox,
  allow_sugar: checkbox,
  allow_ice: checkbox,
  medium: money,
  large: optionalMoney,
  image: z.file().max(5 * 1024 * 1024, "Ảnh phải nhỏ hơn hoặc bằng 5 MB.")
    .refine((file) => file.size === 0 || ["image/jpeg", "image/png", "image/webp"].includes(file.type), "Chọn ảnh JPEG, PNG hoặc WebP."),
});

export const settingsSchema = z.object({
  delivery_fee_vnd: money,
  free_delivery_threshold_vnd: money,
  pickup_address: z.string().trim().min(1).max(300),
  bank_bin: z.enum(["", ...Object.keys(banks)] as [string, ...string[]]),
  bank_account_number: z.string().trim().max(19),
  bank_account_name: z.string().trim().max(70).transform((value) => withoutAccents(value).toUpperCase().replace(/\s+/g, " ")),
}).refine((value) => hasBank(value) || (!value.bank_bin && !value.bank_account_number && !value.bank_account_name),
  "Điền đầy đủ thông tin ngân hàng hoặc để trống cả ba trường.");

export type FormResult = { okay: boolean; message: string };
