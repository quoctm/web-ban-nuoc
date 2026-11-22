import { randomBytes } from "node:crypto";
import { z } from "zod";
import { createLocalUser } from "../src/features/account/local-users.ts";
import { loadLocalEnvironment, requireStoppedServer } from "./local-environment.mjs";

loadLocalEnvironment();

try {
  const [emailArg, passwordArg, ...extra] = process.argv.slice(2);
  const email = z.email().max(254).safeParse(emailArg?.trim().toLowerCase());
  if (!email.success || extra.length) throw new Error("Cách dùng: npm run create-admin -- <email> [mật khẩu]");
  const password = passwordArg ?? randomBytes(18).toString("base64url");
  if (password.length < 8 || password.length > 128) throw new Error("Mật khẩu cần có từ 8 đến 128 ký tự.");
  await requireStoppedServer();
  if (!await createLocalUser(email.data, password, "admin")) throw new Error("Email đã tồn tại.");
  console.log("Đã tạo quản trị viên " + email.data);
  if (passwordArg === undefined) console.log("Mật khẩu (chỉ in lần này): " + password);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
