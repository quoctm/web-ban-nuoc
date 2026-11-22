import Link from "next/link";
import { requireAdmin } from "@/features/account/server";

export const metadata = {
  title: { default: "Quản trị · Mát Nhà", template: "%s · Quản trị · Mát Nhà" },
  robots: { index: false, follow: false },
};
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <main className="shell shop-page shop-stack">
    <nav aria-label="Quản trị" className="flex flex-wrap gap-2">
      <Link href="/quan-tri/don-hang" className="button">Đơn hàng</Link>
      <Link href="/quan-tri/san-pham" className="button">Sản phẩm</Link>
      <Link href="/quan-tri/danh-muc" className="button">Danh mục</Link>
      <Link href="/quan-tri/khach-hang" className="button">Khách hàng</Link>
      <Link href="/quan-tri/cai-dat" className="button">Cài đặt</Link>
      <Link href="/" className="button">Về cửa hàng</Link>
    </nav>
    {children}
  </main>;
}
