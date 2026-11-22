import Link from "next/link";
import { CartLink } from "@/features/cart/cart-link";
import { Icon } from "./icons";

import { currentActor } from "@/features/account/server";
import { accountAction } from "@/features/account/actions";

export async function SiteHeader() {
  const actor = await currentActor();
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link href="/" className="wordmark" aria-label="Mát Nhà, trang chủ">
          <span className="brand-icon"><Icon name="drink" className="size-[21px]" /></span>
          <span>Mát Nhà<span className="brand-dot">.</span></span>
        </Link>
        <Link href="/san-pham" className="header-menu">Thực đơn</Link>
        <form action="/san-pham" role="search" className="header-search" aria-label="Tìm món trên thực đơn">
          <label htmlFor="header-query" className="sr-only">Tìm món</label>
          <input id="header-query" name="q" type="search" maxLength={80} placeholder="Tìm món…" />
          <button aria-label="Tìm món"><Icon name="search" className="size-5" /></button>
        </form>
        {actor ? <details className="account-nav">
          <summary>Tài khoản</summary>
          <div className="shop-panel shop-stack">
            <Link href="/tai-khoan/don-hang">Đơn của tôi</Link>
            {actor.role === "admin" && <Link href="/quan-tri">Quản trị</Link>}
            <form action={accountAction}>
              <input type="hidden" name="operation" value="logout" />
              <button className="text-link">Đăng xuất</button>
            </form>
          </div>
        </details> : <Link href="/dang-nhap" className="account-entry">Đăng nhập</Link>}
        <CartLink />
      </div>
    </header>
  );
}
