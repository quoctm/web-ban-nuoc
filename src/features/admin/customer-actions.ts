"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { LocalDataError } from "@/lib/json-store";
import { passwordHash, usersTransaction } from "../account/local-users";
import { requireAdmin } from "../account/server";
import { checkoutBackend } from "../checkout/server-config";

export type TemporaryPasswordResult = { password?: string; message?: string };

export async function issueTemporaryPassword(_previous: TemporaryPasswordResult, form: FormData): Promise<TemporaryPasswordResult> {
  await requireAdmin();
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success || checkoutBackend().mode !== "local") return { message: "Yêu cầu không hợp lệ." };

  try {
    const password = randomBytes(15).toString("base64url");
    const hash = await passwordHash(password);
    const saved = await usersTransaction((users) => {
      const user = users.find((entry) => entry.id === id.data && entry.role === "customer");
      if (!user) return false;
      user.passwordHash = hash;
      user.temporaryUntil = Date.now() + 24 * 60 * 60 * 1000;
      return true;
    }, true);
    return saved ? { password } : { message: "Không tìm thấy khách hàng." };
  } catch (error) {
    return { message: error instanceof LocalDataError ? error.message : "Chưa đặt được mật khẩu tạm." };
  }
}
