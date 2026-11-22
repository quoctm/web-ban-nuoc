"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { LocalDataError } from "@/lib/json-store";
import { requireAdmin } from "../account/server";
import { checkoutBackend } from "../checkout/server-config";
import { localTransaction } from "../orders/local-store";
import { orderCodeSchema } from "../orders/model";
import { applyTransition, expireOrder, transitionLabels } from "../orders/workflow";
import { AdminInputError, adminCatalogClient, writeCategory, writeProduct, writeSettings } from "./catalog";
import { categorySchema, productSchema, settingsSchema, type FormResult } from "./model";

function failure(error: unknown): FormResult {
  return { okay: false, message: error instanceof AdminInputError || error instanceof LocalDataError
    ? error.message : "Chưa lưu được thay đổi. Vui lòng thử lại." };
}
const saved = { okay: true, message: "Đã lưu thay đổi." };

function refreshCatalog(adminPath: string) {
  revalidatePath(adminPath);
  revalidatePath("/");
  revalidatePath("/san-pham");
  revalidatePath("/san-pham/[slug]", "page");
}

export async function saveCategory(_previous: FormResult, form: FormData): Promise<FormResult> {
  await requireAdmin();
  const input = categorySchema.safeParse(Object.fromEntries(form));
  if (!input.success) return { okay: false, message: "Kiểm tra tên và thứ tự danh mục." };
  try {
    await writeCategory(await adminCatalogClient(), input.data);
  } catch (error) {
    return failure(error);
  }
  refreshCatalog("/quan-tri/danh-muc");
  return saved;
}

export async function saveProduct(_previous: FormResult, form: FormData): Promise<FormResult> {
  await requireAdmin();
  const input = productSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return { okay: false, message: input.error.flatten().fieldErrors.image?.[0] ?? "Kiểm tra tên, danh mục, mô tả và giá của món." };
  try {
    await writeProduct(await adminCatalogClient(), input.data);
  } catch (error) {
    return failure(error);
  }
  refreshCatalog("/quan-tri/san-pham");
  return saved;
}

export async function saveSettings(_previous: FormResult, form: FormData): Promise<FormResult> {
  const admin = await requireAdmin();
  const input = settingsSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return { okay: false, message: input.error.flatten().formErrors[0] ?? "Kiểm tra phí giao, ngưỡng miễn phí và địa chỉ." };
  try {
    await writeSettings(await adminCatalogClient(), input.data, admin.id);
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/quan-tri/cai-dat");
  return saved;
}

const transitionSchema = z.object({
  code: orderCodeSchema, transition: z.enum(Object.keys(transitionLabels) as (keyof typeof transitionLabels)[]),
  reason: z.string().trim().max(300).optional().default(""),
});

export async function transitionOrder(_previous: FormResult, form: FormData): Promise<FormResult> {
  await requireAdmin();
  const input = transitionSchema.safeParse(Object.fromEntries(form));
  if (!input.success || (input.data.transition === "cancelled" && !input.data.reason)) {
    return { okay: false, message: "Vui lòng kiểm tra thao tác và lý do hủy." };
  }
  const { code, transition, reason } = input.data;
  let changed = false;
  try {
    const backend = checkoutBackend();
    if (backend.mode === "local") {
      changed = await localTransaction(({ orders }) => {
        const order = orders.find((entry) => entry.code === code);
        const now = Date.now();
        return Boolean(order && !expireOrder(order, now) && applyTransition(order, transition, reason, now));
      }, true);
    } else if (backend.mode === "supabase") {
      const client = await adminCatalogClient();
      const result = await client?.rpc("admin_transition_order", { p_code: code, p_action: transition, p_reason: reason });
      if (result?.error) throw result.error;
      changed = result?.data === true;
    }
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/quan-tri/don-hang");
  revalidatePath("/quan-tri/don-hang/" + code);
  revalidatePath("/don-hang/" + code);
  return changed ? saved : { okay: false, message: "Đơn đã đổi trạng thái hoặc đã quá hạn. Vui lòng xem lại đơn." };
}
