"use client";

import { useActionState } from "react";
import { issueTemporaryPassword } from "./customer-actions";

export function TemporaryPasswordForm({ id }: { id: string }) {
  const [result, submit, pending] = useActionState(issueTemporaryPassword, {});
  return <form action={submit} className="shop-stack">
    <input type="hidden" name="id" value={id} />
    <button type="submit" className="button" disabled={pending}>
      {pending ? "Đang tạo…" : "Đặt mật khẩu tạm"}
    </button>
    {result.message && <p className="shop-error" role="alert">{result.message}</p>}
    {!pending && result.password && <p role="status">
      <code>{result.password}</code><br />Chỉ hiển thị lần này. Có hiệu lực trong 24 giờ.
    </p>}
  </form>;
}
