import Link from "next/link";
import { Icon } from "./icons";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-inner">
        <Link href="/" className="wordmark">
          <span className="brand-icon"><Icon name="drink" className="size-[21px]" /></span>
          <span>Mát Nhà<span className="brand-dot">.</span></span>
        </Link>
        <nav className="footer-links" aria-label="Liên kết cửa hàng">
          <Link href="/san-pham" className="text-link">Xem thực đơn</Link>
          <Link href="/tra-cuu-don" className="text-link">Tra cứu đơn</Link>
        </nav>
      </div>
    </footer>
  );
}
