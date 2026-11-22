import { z } from "zod";

export const accountTitles = {
  login: "Đăng nhập", register: "Đăng ký",
};
export type AccountOperation = keyof typeof accountTitles;
export const passwordMinimum = 8;

const email = z.string("Vui lòng nhập email.").trim().toLowerCase()
  .min(1, "Vui lòng nhập email.")
  .max(254, "Email tối đa 254 ký tự.")
  .pipe(z.email("Vui lòng nhập email hợp lệ."));
const password = z.string("Vui lòng nhập mật khẩu.").min(passwordMinimum, "Mật khẩu phải có ít nhất 8 ký tự.")
  .max(128, "Mật khẩu tối đa 128 ký tự.");

export const accountSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("login"), email, password: z.string("Vui lòng nhập mật khẩu.")
    .min(1, "Vui lòng nhập mật khẩu.").max(128, "Mật khẩu tối đa 128 ký tự."), newPassword: password.optional() }),
  z.object({ operation: z.literal("register"), email, password }),
]);
export type AccountInput = z.infer<typeof accountSchema>;
export type AccountFields = Partial<Record<"email" | "password" | "newPassword", string>>;
export type AccountResult = { fields?: AccountFields; message?: string; email?: string; temporary?: boolean };

export function fieldMessages(error: z.ZodError): AccountFields {
  const fields: AccountFields = {};
  for (const { path, message } of error.issues) {
    const name = path[0];
    if (name === "email" || name === "password" || name === "newPassword") fields[name] ??= message;
  }
  return fields;
}
