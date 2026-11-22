import { requireAdmin } from "@/features/account/server";
import { saveSettings } from "@/features/admin/actions";
import { adminCatalogClient, loadSettings } from "@/features/admin/catalog";
import { AdminForm } from "@/features/admin/form";
import { banks } from "@/features/payments/vietqr";

export const metadata = { title: "Cài đặt" };

export default async function Page() {
  await requireAdmin();
  const settings = await loadSettings(await adminCatalogClient());
  return <>
    <h1>Cài đặt</h1>
    <section className="shop-panel max-w-2xl">
      <AdminForm action={saveSettings} fieldsKey={JSON.stringify(settings)} label="Lưu cài đặt">
        <h2>Giao hàng và nhận tại quán</h2>
        <label className="shop-field">Phí giao (₫)<input type="number" name="delivery_fee_vnd" min={0} max={2147483647} defaultValue={settings.delivery_fee_vnd} required /></label>
        <label className="shop-field">Miễn phí giao từ (₫)<input type="number" name="free_delivery_threshold_vnd" min={0} max={2147483647} defaultValue={settings.free_delivery_threshold_vnd} required /></label>
        <label className="shop-field">Địa chỉ quán<input name="pickup_address" maxLength={300} defaultValue={settings.pickup_address} required /></label>
        <h2>Chuyển khoản VietQR</h2>
        <p className="shop-muted">Để trống cả ba trường để tắt VietQR.</p>
        <label className="shop-field">Ngân hàng<select name="bank_bin" defaultValue={settings.bank_bin}>
          <option value="">Chọn ngân hàng</option>
          {Object.entries(banks).map(([bin, name]) => <option key={bin} value={bin}>{name}</option>)}
        </select></label>
        <label className="shop-field">Số tài khoản<input name="bank_account_number" inputMode="numeric" maxLength={19} defaultValue={settings.bank_account_number} /></label>
        <label className="shop-field">Tên chủ tài khoản<input name="bank_account_name" maxLength={70} defaultValue={settings.bank_account_name} /></label>
      </AdminForm>
    </section>
  </>;
}
