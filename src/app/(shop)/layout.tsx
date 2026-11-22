import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#noi-dung" className="skip-link">Đến nội dung chính</a>
      <SiteHeader />
      <main id="noi-dung">{children}</main>
      <SiteFooter />
    </>
  );
}
