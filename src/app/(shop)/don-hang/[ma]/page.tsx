import Link from "next/link";
import { LocalDataError } from "@/lib/json-store";
import { configurationMessage } from "@/features/checkout/model";
import { allowRequest, checkoutBackend, signingKey } from "@/features/checkout/server-config";
import { lookupErrorMessage, lookupLimitMessage, orderCodeSchema, unknownOrder } from "@/features/orders/model";
import { maskOrderContact } from "@/features/orders/privacy";
import { hasCheckoutAccess, readOrder } from "@/features/orders/server";
import { currentActor } from "@/features/account/server";
import { canViewContact, isAdmin } from "@/features/account/permissions";
import { OrderDetails } from "@/features/orders/order-details";

export const metadata = { title: "Đơn hàng", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

async function loadOrder(code: string | null) {
  const backend = checkoutBackend();
  if (backend.mode === "unavailable") return { error: configurationMessage };
  try {
    const key = await signingKey(backend);
    const actor = await currentActor();
    const checkoutAccess = code !== null && await hasCheckoutAccess(key, code);
    if (actor && code && !checkoutAccess && !isAdmin(actor)) {
      const ownOrder = await readOrder(backend, code, actor.id);
      if (ownOrder) return { order: ownOrder, fullAccess: true };
    }
    if (!checkoutAccess && !isAdmin(actor) && !await allowRequest(backend, key, "lookup")) return { error: lookupLimitMessage };
    const order = code && await readOrder(backend, code);
    return order ? { order, fullAccess: canViewContact(actor, order.userId, checkoutAccess) } : { error: unknownOrder };
  } catch (error) {
    return { error: error instanceof LocalDataError ? error.message : lookupErrorMessage };
  }
}

export default async function OrderPage({ params }: { params: Promise<{ ma: string }> }) {
  const { ma } = await params;
  const code = orderCodeSchema.safeParse(ma);
  const { order, fullAccess, error } = await loadOrder(code.success ? code.data : null);

  if (!order) return <div className="shell shop-page">
    <h1>Đơn hàng</h1>
    <div className="shop-panel shop-stack">
      <p role="status">{error}</p>
      <Link href="/tra-cuu-don" className="button button-primary">Tra cứu đơn hàng</Link>
    </div>
  </div>;

  const contact = fullAccess ? order : maskOrderContact(order);
  return <div className="shell shop-page shop-stack">
    <h1>Đơn hàng {order.code}</h1>
    {fullAccess && <p>Hãy lưu mã đơn để tra cứu khi cần.</p>}
    <OrderDetails order={order} contact={contact} fullAccess={fullAccess} />
    <Link href="/san-pham" className="text-link">Về thực đơn</Link>
  </div>;
}
