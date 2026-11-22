"use client";

import { useActionState, useState, type FormEvent } from "react";
import { submitAccountForm } from "./actions";
import { accountSchema, accountTitles, fieldMessages, passwordMinimum, type AccountFields, type AccountOperation } from "./model";

export function CredentialsForm({ operation, enabled }: {
  operation: AccountOperation; enabled: boolean;
}) {
  const [result, submit, pending] = useActionState(submitAccountForm, {});
  const [email, setEmail] = useState<string>();
  const [showPassword, setShowPassword] = useState(false);
  const [clientErrors, setClientErrors] = useState<AccountFields>({});
  const [edited, setEdited] = useState({ email: false, password: false, newPassword: false });
  const emailError = clientErrors.email ?? (!edited.email ? result.fields?.email : undefined);
  const passwordError = clientErrors.password ?? (!edited.password ? result.fields?.password : undefined);
  const newPassword = operation === "register";
  const newPasswordError = clientErrors.newPassword ?? (!edited.newPassword ? result.fields?.newPassword : undefined);

  function edit(field: keyof AccountFields) {
    setClientErrors((errors) => ({ ...errors, [field]: undefined }));
    setEdited((fields) => ({ ...fields, [field]: true }));
  }

  function validate(event: FormEvent<HTMLFormElement>) {
    const parsed = accountSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!parsed.success) {
      event.preventDefault();
      const fields = fieldMessages(parsed.error);
      setClientErrors(fields);
      if (fields.email) event.currentTarget.querySelector<HTMLInputElement>("#account-email")?.focus();
      else if (fields.password) event.currentTarget.querySelector<HTMLInputElement>("#account-password")?.focus();
      else if (fields.newPassword) event.currentTarget.querySelector<HTMLInputElement>("#account-new-password")?.focus();
    } else {
      setClientErrors({});
      setEdited({ email: false, password: false, newPassword: false });
    }
  }

  return <form action={submit} onSubmit={validate} noValidate className="shop-stack">
    <input type="hidden" name="operation" value={operation} />
    <div className="shop-field">
        <label htmlFor="account-email">Email</label>
        <input id="account-email" name="email" type="email" autoComplete="email" maxLength={254} required
          value={email ?? result.email ?? ""} onChange={(event) => { setEmail(event.currentTarget.value); edit("email"); }}
          aria-invalid={Boolean(emailError)} aria-describedby={emailError ? "account-email-error" : undefined} />
        {emailError && <span id="account-email-error" className="shop-error" role="alert">{emailError}</span>}
    </div>
    <div className="shop-field">
      <label htmlFor="account-password">Mật khẩu</label>
      <div className="flex items-center gap-2">
        <input id="account-password" name="password" type={showPassword ? "text" : "password"}
          minLength={newPassword ? passwordMinimum : 1} maxLength={128} required
          autoComplete={newPassword ? "new-password" : "current-password"} onChange={() => edit("password")}
          aria-invalid={Boolean(passwordError)}
          aria-describedby={[newPassword && "account-password-hint", passwordError && "account-password-error"].filter(Boolean).join(" ") || undefined} />
        <button type="button" className="button shrink-0" aria-controls="account-password" onClick={() => setShowPassword(!showPassword)}>
          {showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        </button>
      </div>
      {passwordError && <span id="account-password-error" className="shop-error" role="alert">{passwordError}</span>}
      {newPassword && <span id="account-password-hint" className="shop-muted">Tối thiểu 8 ký tự</span>}
    </div>
    {result.temporary && <div className="shop-field">
      <label htmlFor="account-new-password">Mật khẩu mới</label>
      <input id="account-new-password" name="newPassword" type="password" autoComplete="new-password"
        minLength={passwordMinimum} maxLength={128} required onChange={() => edit("newPassword")}
        aria-invalid={Boolean(newPasswordError)} aria-describedby={newPasswordError ? "new-password-error" : undefined} />
      {newPasswordError && <span id="new-password-error" className="shop-error" role="alert">{newPasswordError}</span>}
    </div>}
    {result.message && <p className="shop-error" role="alert">{result.message}</p>}
    <button type="submit" className="button button-primary" disabled={!enabled || pending}>
      {pending ? "Đang xử lý…" : accountTitles[operation]}
    </button>
  </form>;
}
