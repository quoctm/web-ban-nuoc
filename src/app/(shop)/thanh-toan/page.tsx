import { currentActor } from "@/features/account/server";
import { CheckoutView } from "@/features/checkout/checkout-view";
import { configurationMessage } from "@/features/checkout/model";
import { checkoutBackend } from "@/features/checkout/server-config";
import { latestContact } from "@/features/orders/server";

export const metadata = { title: "Thanh toán" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const backend = checkoutBackend();
  const actor = await currentActor();
  const contact = actor && backend.mode !== "unavailable" ? await latestContact(backend, actor.id).catch(() => undefined) : undefined;
  return <div className="shell shop-page">
    <h1>Thanh toán</h1>
    {backend.mode === "unavailable"
      ? <p className="shop-notice">{configurationMessage}</p> : <CheckoutView contact={contact} />}
  </div>;
}
