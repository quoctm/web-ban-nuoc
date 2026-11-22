"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { LocalDataError } from "@/lib/json-store";
import { sessionClient, siteUrl } from "@/lib/supabase/session";
import { allowAccountRequest, checkoutBackend, signingKey } from "../checkout/server-config";
import { createLocalUser, passwordHash, usersTransaction, verifiesPassword } from "./local-users";
import { clearLocalSession, setLocalSession } from "./server";
import { accountSchema, fieldMessages, type AccountInput, type AccountResult } from "./model";

const failedMessage = "Không thực hiện được yêu cầu. Vui lòng kiểm tra thông tin và thử lại.";

export async function submitAccountForm(previous: AccountResult, form: FormData): Promise<AccountResult> {
  const parsed = accountSchema.safeParse(Object.fromEntries(form));
  const email = form.get("email");
  const values = typeof email === "string" ? { email: email.slice(0, 254) } : {};
  if (!parsed.success) {
    const fields = fieldMessages(parsed.error);
    return { ...values, fields, temporary: previous.temporary, message: Object.keys(fields).length ? undefined : failedMessage };
  }
  return { ...values, ...await performAccountAction(parsed.data, previous.temporary ?? false) };
}

export async function accountAction(form: FormData) {
  if (!z.literal("logout").safeParse(form.get("operation")).success) redirect("/dang-nhap?loi=du-lieu");
  const client = await sessionClient();
  if (client) await client.auth.signOut({ scope: "local" });
  await clearLocalSession();
  redirect("/");
}

async function performAccountAction(input: AccountInput, changingTemporary: boolean): Promise<AccountResult> {
  const backend = checkoutBackend();
  let destination: string | null = null;
  try {
    if (backend.mode === "unavailable") return { message: "Cần cấu hình máy chủ để sử dụng tài khoản." };
    if (!await allowAccountRequest(backend, await signingKey(backend), input.email)) {
      return { message: "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau." };
    }

    const client = await sessionClient();
    if (client) {
      if (input.operation === "login") {
        const result = await client.auth.signInWithPassword({ email: input.email, password: input.password });
        if (!result.error) destination = "/tai-khoan/don-hang";
      } else {
        const result = await client.auth.signUp({
          email: input.email, password: input.password,
          options: { emailRedirectTo: siteUrl() + "/auth/callback" },
        });
        if (!result.error) destination = result.data.session ? "/tai-khoan/don-hang" : "/dang-nhap?thong-bao=xac-nhan";
      }
    } else if (backend.mode === "local") {
      if (input.operation === "register") {
        const user = await createLocalUser(input.email, input.password, "customer");
        if (user) {
          await setLocalSession(user);
          destination = "/tai-khoan/don-hang";
        }
      } else {
        const user = await usersTransaction((users) => users.find((entry) => entry.email === input.email));
        const dummyHash = "0".repeat(32) + ":" + "0".repeat(128);
        if (await verifiesPassword(input.password, user?.passwordHash ?? dummyHash) && user) {
          if (user.temporaryUntil) {
            if (user.temporaryUntil <= Date.now()) return { message: "Mật khẩu tạm đã hết hạn. Vui lòng liên hệ quán." };
            if (!input.newPassword || input.newPassword === input.password) {
              return { temporary: true, message: "Hãy nhập lại mật khẩu tạm và chọn mật khẩu mới khác mật khẩu tạm." };
            }
            const hash = await passwordHash(input.newPassword);
            const updated = await usersTransaction((users) => {
              const match = users.find((entry) => entry.id === user.id && entry.passwordHash === user.passwordHash);
              if (!match?.temporaryUntil || match.temporaryUntil <= Date.now()) return null;
              match.passwordHash = hash;
              delete match.temporaryUntil;
              return match;
            }, true);
            if (!updated) return { message: "Mật khẩu tạm đã thay đổi hoặc hết hạn. Vui lòng liên hệ quán." };
            await setLocalSession(updated);
          } else {
            await setLocalSession(user);
          }
          destination = "/tai-khoan/don-hang";
        }
      }
    }
  } catch (error) {
    if (error instanceof LocalDataError) return { message: error.message, temporary: changingTemporary };
  }
  if (destination) redirect(destination);
  return { temporary: changingTemporary, message: input.operation === "login" ? "Email hoặc mật khẩu không đúng." : failedMessage };
}
