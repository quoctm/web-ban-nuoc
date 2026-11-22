import { usersTransaction } from "@/features/account/local-users";
import { requireAdmin } from "@/features/account/server";
import { TemporaryPasswordForm } from "@/features/admin/temporary-password-form";
import { checkoutBackend } from "@/features/checkout/server-config";
import { localTransaction } from "@/features/orders/local-store";

export const metadata = { title: "Khách hàng" };

export default async function CustomerPage() {
  await requireAdmin();
  if (checkoutBackend().mode !== "local") {
    return <><h1>Khách hàng</h1><p>Quản lý tài khoản khách hàng trong bảng điều khiển Supabase.</p></>;
  }
  const [customers, counts] = await Promise.all([
    usersTransaction((users) => users.filter(({ role }) => role === "customer")),
    localTransaction(({ orders }) => {
      const counts = new Map<string, number>();
      for (const { userId } of orders) {
        if (userId) counts.set(userId, (counts.get(userId) ?? 0) + 1);
      }
      return counts;
    }),
  ]);
  const date = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "medium" });
  return <>
    <h1>Khách hàng</h1>
    {!customers.length && <p>Chưa có tài khoản khách hàng.</p>}
    <ul className="shop-stack">
      {customers.map(({ id, email, createdAt }) => <li key={id} className="shop-panel shop-stack min-w-0">
        <h2 className="break-all">{email}</h2>
        <p>Ngày tạo {createdAt ? date.format(new Date(createdAt)) : "không có dữ liệu"} · {counts.get(id) ?? 0} đơn</p>
        <TemporaryPasswordForm id={id} />
      </li>)}
    </ul>
  </>;
}
