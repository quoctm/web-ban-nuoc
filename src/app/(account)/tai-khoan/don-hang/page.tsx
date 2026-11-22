import { redirect } from "next/navigation";
import { currentActor } from "@/features/account/server";
import { checkoutBackend } from "@/features/checkout/server-config";
import { OrderList, parsePage } from "@/features/orders/order-list";
import { listOrders } from "@/features/orders/server";

export const metadata = { title: "Đơn của tôi", robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ trang?: string }> }) {
  const actor = await currentActor();
  if (!actor) redirect("/dang-nhap");
  const page = parsePage((await searchParams).trang);
  const backend = checkoutBackend();
  const data = backend.mode === "unavailable" ? null : await listOrders(backend, { page, owner: actor.id }).catch(() => null);
  return <div className="shell shop-page shop-stack">
    <h1>Đơn của tôi</h1>
    {data ? <OrderList page={page} data={data} /> : <p className="shop-error">Chưa tải được đơn hàng. Vui lòng thử lại.</p>}
  </div>;
}
