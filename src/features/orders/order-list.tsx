import Link from "next/link";
import { z } from "zod";
import { formatVnd } from "@/lib/currency";
import { orderPath, statusLabels } from "./model";
import type { listOrders } from "./server";

const pageNumber = z.coerce.number().int().min(1).max(10_000);
export function parsePage(value: unknown) {
  return pageNumber.safeParse(value).data ?? 1;
}
const dateFormat = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });

export function OrderList({ data, page, admin = false, filter }: {
  data: Awaited<ReturnType<typeof listOrders>>; page: number; admin?: boolean; filter?: string;
}) {
  const base = admin ? "/quan-tri/don-hang" : "/tai-khoan/don-hang";
  const pagePath = (target: number) => base + "?" + new URLSearchParams({
    trang: String(target), ...(filter ? { trangThai: filter } : {}),
  });
  return <>
    <ul className="shop-line-list">
      {data.orders.map((order) => <li key={order.code} className="shop-panel shop-summary-line">
        <div>
          <Link prefetch={false} href={admin ? base + "/" + order.code : orderPath(order.code)} className="text-link">{order.code}</Link>
          <p>{order.createdAt ? dateFormat.format(new Date(order.createdAt)) + " · " : ""}
            {order.fulfillment === "delivery" ? "Giao hàng" : "Nhận tại quán"}</p>
        </div>
        <div className="text-right"><strong>{formatVnd(order.total)}</strong><p>{statusLabels[order.status]}</p></div>
      </li>)}
      {!data.orders.length && <li className="shop-panel">Chưa có đơn hàng.</li>}
    </ul>
    {(page > 1 || data.more) && <nav aria-label="Phân trang đơn hàng" className="flex items-center gap-4">
      {page > 1 && <Link href={pagePath(page - 1)} className="button">Trang trước</Link>}
      <span>Trang {page}</span>
      {data.more && page < 10_000 && <Link href={pagePath(page + 1)} className="button">Trang sau</Link>}
    </nav>}
  </>;
}
