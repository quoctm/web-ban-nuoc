import { configurationMessage } from "@/features/checkout/model";
import { checkoutBackend } from "@/features/checkout/server-config";
import { LookupForm } from "@/features/orders/lookup-form";

export const metadata = { title: "Tra cứu đơn hàng" };
export const dynamic = "force-dynamic";

export default function LookupPage() {
  return <div className="shell shop-page">
    <h1>Tra cứu đơn hàng</h1>
    {checkoutBackend().mode === "unavailable"
      ? <p className="shop-notice">{configurationMessage}</p> : <LookupForm />}
  </div>;
}
