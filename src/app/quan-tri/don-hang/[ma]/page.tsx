import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/features/account/server";
import { transitionOrder } from "@/features/admin/actions";
import { AdminForm } from "@/features/admin/form";
import { checkoutBackend } from "@/features/checkout/server-config";
import { orderCodeSchema } from "@/features/orders/model";
import { OrderDetails } from "@/features/orders/order-details";
import { readOrder } from "@/features/orders/server";
import { allowedTransitions, transitionLabels } from "@/features/orders/workflow";

function currentTransitions(order: NonNullable<Awaited<ReturnType<typeof readOrder>>>) {
  return allowedTransitions(order, Date.now());
}

export const metadata = { title: "Chi tiết đơn hàng" };

export default async function Page({ params }: { params: Promise<{ ma: string }> }) {
  await requireAdmin();
  const code = orderCodeSchema.safeParse((await params).ma);
  if (!code.success) notFound();
  const backend = checkoutBackend();
  if (backend.mode === "unavailable") return <p className="shop-error">Chưa cấu hình máy chủ đặt hàng.</p>;
  const order = await readOrder(backend, code.data);
  if (!order) notFound();
  const transitions = currentTransitions(order);
  return <>
    <Link href="/quan-tri/don-hang" className="text-link">Về danh sách đơn hàng</Link>
    <h1>Đơn hàng {order.code}</h1>
    <OrderDetails order={order} contact={order} fullAccess admin />
    {transitions.length > 0 && <section className="shop-panel shop-stack">
      <h2>Xử lý đơn hàng</h2>
      <div className="flex flex-wrap items-start gap-4">
        {transitions.map((transition) => (
          <AdminForm key={transition} action={transitionOrder} label={transitionLabels[transition]} primary={transition !== "cancelled"}>
            <input type="hidden" name="code" value={order.code} />
            <input type="hidden" name="transition" value={transition} />
            {transition === "cancelled" && <label className="shop-field">Lý do hủy<input name="reason" required maxLength={300} /></label>}
          </AdminForm>
        ))}
      </div>
    </section>}
  </>;
}
