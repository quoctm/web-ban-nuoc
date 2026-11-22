"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent, type ReactNode } from "react";
import type { FormResult } from "./model";

export function AdminForm({ action, children, label = "Lưu", primary = true, fieldsKey }: {
  action: (state: FormResult, form: FormData) => Promise<FormResult>;
  children: ReactNode; label?: string; primary?: boolean; fieldsKey?: string;
}) {
  const [result, submit, pending] = useActionState(action, { okay: false, message: "" });
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (result.okay) {
      formRef.current?.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach((input) => { input.value = ""; });
    }
  }, [result]);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const fields = new FormData(event.currentTarget);
    // Dispatch without React's automatic form reset. The server refresh supplies saved defaults.
    startTransition(() => submit(fields));
  }

  return <form ref={formRef} action={submit} onSubmit={save} className="shop-stack">
    <fieldset key={fieldsKey} disabled={pending} className="shop-stack">
      {children}
      <button className={primary ? "button button-primary" : "button"}>{pending ? "Đang lưu…" : label}</button>
    </fieldset>
    {result.message && <p role={result.okay ? "status" : "alert"} className={result.okay ? "shop-notice" : "shop-error"}>{result.message}</p>}
  </form>;
}
