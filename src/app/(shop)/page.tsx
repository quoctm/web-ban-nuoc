import Image from "next/image";
import Link from "next/link";
import { CatalogNotice } from "@/components/catalog-notice";
import { CategoryIcon } from "@/components/icons";
import { ProductCard } from "@/components/product-card";
import { getCatalogStatus, getMenu } from "@/features/catalog/data";
import { menuHref } from "@/features/catalog/filters";
import type { Product } from "@/features/catalog/types";

const featuredSlugs = ["tra-sua-tran-chau", "ca-phe-sua-da", "nuoc-cam-ep", "nuoc-khoang"];

export default async function Home() {
  const catalog = await getCatalogStatus();
  const menuByCategory = await Promise.all(catalog.categories.slice(0, 4).map(async (category) => {
    const menu = await getMenu({ q: "", danhMuc: category.slug, trang: 1 });
    const available = menu.products.filter(({ is_available, variants }) => is_available && variants.length);
    return { category, product: available.find(({ slug }) => featuredSlugs.includes(slug)) ?? available[0], error: menu.error };
  }));
  const featured = menuByCategory.filter((item): item is typeof item & { product: Product } => Boolean(item.product));
  const status = menuByCategory.some(({ error }) => error) ? "error" : catalog.mode;

  return (
    <div className="shell home">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <h1 id="hero-title">Hôm nay<br />uống gì<span>?</span></h1>
          <p>Trà sữa thơm, cà phê đậm, nước ép tươi. Chọn một ly cho ngày thêm mát.</p>
          <Link href="/san-pham" className="button button-primary">Xem thực đơn</Link>
        </div>
        <div className="hero-photo">
          <Image src="/images/hero.webp" alt="Ba ly trà sữa trân châu, cà phê sữa đá và nước cam ép" fill
            preload sizes="(max-width: 767px) 100vw, 650px" />
        </div>
      </section>

      {status !== "live" && <CatalogNotice />}

      {catalog.categories.length > 0 && (
        <section className="home-section" aria-labelledby="categories-title">
          <h2 id="categories-title">Danh mục</h2>
          <div className="category-grid">
            {catalog.categories.map((category) => (
              <Link className="category-card" key={category.id} href={menuHref({ danhMuc: category.slug })} data-category={category.slug}>
                <span className="category-icon"><CategoryIcon slug={category.slug} /></span>
                {category.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {featured.length > 0 && (
        <section className="home-section" aria-labelledby="featured-title">
          <div className="section-heading">
            <h2 id="featured-title">Món gợi ý</h2>
            <Link href="/san-pham" className="text-link">Xem tất cả</Link>
          </div>
          <div className="product-grid">
            {featured.map(({ category, product }) => <ProductCard key={product.id} product={product} category={category} />)}
          </div>
        </section>
      )}
    </div>
  );
}
