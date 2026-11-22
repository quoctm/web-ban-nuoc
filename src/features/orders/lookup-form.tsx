"use client";

import { useActionState, useState } from "react";
import { lookupOrder } from "./actions";
import { unknownOrder } from "./model";

export function LookupForm() {
  const [feedback, submit, pending] = useActionState(lookupOrder, "");
  const [edited, setEdited] = useState(false);
  const message = edited || pending ? "" : feedback;
  const invalid = message === unknownOrder;
  const errorId = invalid ? "lookup-error" : undefined;

  return <form action={submit} className="shop-panel shop-stack shop-form-narrow" noValidate
    onSubmit={() => setEdited(false)} onChange={() => setEdited(true)}>
    <p>Nhập mã đơn bạn nhận được khi đặt hàng.</p>
    <div className="shop-field">
      <label htmlFor="lookup-code">Mã đơn hàng</label>
      <input id="lookup-code" name="code" placeholder="MN-________" autoCapitalize="characters" autoComplete="off"
        spellCheck={false} required aria-invalid={invalid} aria-describedby={errorId} />
    </div>
    {message && <p id="lookup-error" className="shop-error" role="alert">{message}</p>}
    <button type="submit" className="button button-primary" disabled={pending}>{pending ? "Đang tra cứu…" : "Tra cứu đơn"}</button>
  </form>;
}
