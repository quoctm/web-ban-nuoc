import Link from "next/link";
import { checkoutBackend } from "../checkout/server-config";
import { CredentialsForm } from "./credentials-form";
import { accountTitles, type AccountOperation } from "./model";

export async function AccountForm({ operation, query }: {
  operation: AccountOperation;
  query: Promise<{ loi?: string; "thong-bao"?: string }>;
}) {
  const params = await query;
  return <div className="shell shop-page max-w-lg">
    <h1>{accountTitles[operation]}</h1>
    <div className="shop-panel shop-stack">
      {params.loi && <p className="shop-error" role="alert">Không thực hiện được yêu cầu. Vui lòng kiểm tra thông tin và thử lại.</p>}
      {params["thong-bao"] === "xac-nhan" && <p role="status">Hãy kiểm tra email để xác nhận tài khoản.</p>}
      <CredentialsForm key={operation} operation={operation} enabled={checkoutBackend().mode !== "unavailable"} />
      {operation === "login" ? <>
        <Link href="/dang-ky" className="text-link">Đăng ký</Link>
        <p className="shop-muted">Quên mật khẩu? Liên hệ quán để được đặt lại.</p>
      </> : <Link href="/dang-nhap" className="text-link">Về đăng nhập</Link>}
    </div>
  </div>;
}
