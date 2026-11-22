import { checkoutBackend } from "../checkout/server-config";
import { localTransaction } from "./local-store";

const state = globalThis as typeof globalThis & { matNhaExpiryTimer?: NodeJS.Timeout };

export function startOrderExpiry() {
  if (state.matNhaExpiryTimer || checkoutBackend().mode !== "local") return;
  let reportedError = false;
  state.matNhaExpiryTimer = setInterval(async () => {
    try {
      await localTransaction(() => {});
      reportedError = false;
    } catch (error) {
      if (!reportedError) console.error("Chưa cập nhật được đơn VietQR quá hạn.", error);
      reportedError = true;
    }
  }, 15_000).unref();
}
