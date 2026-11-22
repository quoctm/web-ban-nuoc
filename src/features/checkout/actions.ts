"use server";

import { LocalDataError } from "@/lib/json-store";
import { reviewCart } from "./catalog-review";
import { checkoutSchema, configurationMessage, reviewSchema } from "./model";
import { allowRequest, checkoutBackend, signingKey } from "./server-config";
import { currentActor } from "../account/server";
import { ChangedCartError, VietQrUnavailableError, createOrder, grantCheckoutAccess } from "../orders/server";

export async function checkCart(input: unknown) {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { error: "Giỏ hàng có lựa chọn không hợp lệ." };
  try {
    return { review: await reviewCart(parsed.data) };
  } catch (error) {
    return { error: error instanceof LocalDataError ? error.message : "Chưa kiểm tra được giá và tình trạng món. Vui lòng thử lại." };
  }
}

export async function placeOrder(input: unknown) {
  const backend = checkoutBackend();
  if (backend.mode === "unavailable") return { error: configurationMessage };
  try {
    const key = await signingKey(backend);
    if (!await allowRequest(backend, key, "checkout")) {
      return { error: "Bạn đã gửi quá nhiều yêu cầu đặt đơn. Vui lòng đợi một lúc rồi thử lại." };
    }
    const payload = input instanceof FormData ? input.get("checkout") : null;
    if (typeof payload !== "string" || payload.length > 65_536) {
      return { error: "Vui lòng kiểm tra thông tin đặt hàng và giỏ hàng." };
    }
    const parsed = checkoutSchema.safeParse(JSON.parse(payload));
    if (!parsed.success) return { error: "Vui lòng kiểm tra thông tin đặt hàng và giỏ hàng." };

    const actor = await currentActor();
    if (actor && !await allowRequest(backend, key, "checkout", actor.id)) {
      return { error: "Bạn đã gửi quá nhiều yêu cầu đặt đơn. Vui lòng đợi một lúc rồi thử lại." };
    }
    const code = await createOrder(backend, parsed.data, actor?.id ?? null);
    await grantCheckoutAccess(key, code);
    return { code };
  } catch (error) {
    if (error instanceof LocalDataError) return { error: error.message };
    if (error instanceof VietQrUnavailableError) return { error: "VietQR hiện không khả dụng. Vui lòng chọn COD.", changed: true };
    if (error instanceof ChangedCartError) {
      return { error: "Giá, phí giao hoặc tình trạng món vừa thay đổi. Vui lòng kiểm tra lại giỏ hàng.", changed: true };
    }
    return { error: "Chưa thể xác nhận đơn. Vui lòng thử lại." };
  }
}
