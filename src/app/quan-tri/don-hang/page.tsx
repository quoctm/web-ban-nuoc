import { z } from "zod";
import { requireAdmin } from "@/features/account/server";
import { adminCatalogClient } from "@/features/admin/catalog";
import { LiveOrders } from "@/features/admin/live-orders";
import { checkoutBackend } from "@/features/checkout/server-config";
import { localTransaction } from "@/features/orders/local-store";
import { statusLabels, type OrderStatus } from "@/features/orders/model";
import { OrderList, parsePage } from "@/features/orders/order-list";
import { listOrders } from "@/features/orders/server";
import { getCatalogConfig } from "@/lib/supabase/server";

const statusSchema = z.enum(Object.keys(statusLabels) as OrderStatus[]);
export const metadata = { title: "Đơn hàng" };

export default async function Page({ searchParams }: { searchParams: Promise<{ trang?: string; trangThai?: string }> }) {
  await requireAdmin();
  const { trang, trangThai } = await searchParams;
  const page = parsePage(trang);
  const status = statusSchema.safeParse(trangThai).data;
  const backend = checkoutBackend();
  if (backend.mode === "unavailable") return <p className="shop-error">Chưa cấu hình máy chủ đặt hàng.</p>;
  let count: number;
  if (backend.mode === "local") {
    count = await localTransaction(({ orders }) => orders.length);
  } else {
    const client = await adminCatalogClient();
    const { data, error } = await client!.from("admin_order_signal").select("order_count").eq("id", 1).single();
    if (error) throw error;
    count = data.order_count;
  }
  const data = await listOrders(backend, { page, status });
  return <>
    <h1>Đơn hàng</h1>
    <LiveOrders count={count} realtime={getCatalogConfig()} />
    <form action="/quan-tri/don-hang" className="flex flex-wrap items-end gap-3">
      <label className="shop-field">Trạng thái<select name="trangThai" defaultValue={status ?? ""}>
        <option value="">Tất cả</option>
        {Object.entries(statusLabels).map(([key, title]) => <option key={key} value={key}>{title}</option>)}
      </select></label>
      <button className="button">Lọc đơn</button>
    </form>
    <OrderList data={data} page={page} admin filter={status} />
  </>;
}
