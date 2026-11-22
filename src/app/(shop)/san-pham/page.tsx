import type { Metadata } from "next";
import Link from "next/link";
import { CatalogNotice } from "@/components/catalog-notice";
import { ProductCard } from "@/components/product-card";
import { getCatalogStatus, getMenu } from "@/features/catalog/data";
import { menuFilters, menuHref, PAGE_SIZE } from "@/features/catalog/filters";

export const metadata: Metadata = { title: "Thực đơn" };

export default async function MenuPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = menuFilters.parse(await searchParams);
  const [catalog, menu] = await Promise.all([getCatalogStatus(), getMenu(filters)]);
  const status = menu.error ? "error" : catalog.mode;
  const lastPage = Math.max(1, Math.ceil(menu.total / PAGE_SIZE));
  const categories = new Map(catalog.categories.map((category) => [category.id, category]));
  const categoryLinks = [{ slug: "", name: "Tất cả" }, ...catalog.categories];

  return (
    <div className="shell menu-page">
      <div className="page-title">
        <h1>Thực đơn</h1>
      </div>
      {status !== "live" && <CatalogNotice />}

      <nav aria-label="Lọc theo danh mục" className="filter-list">
        {categoryLinks.map(({ slug, name }) => (
          <Link key={slug} href={menuHref({ q: filters.q, danhMuc: slug })}
            aria-current={filters.danhMuc === slug ? "page" : undefined}
            className="filter-link">{name}</Link>
        ))}
      </nav>

      {status !== "error" && (
        <>
          <div className="result-heading">
            <h2>{filters.q ? <>Kết quả cho “{filters.q}”</> : "Các món trong thực đơn"}</h2>
            {filters.q && <Link href={menuHref({ danhMuc: filters.danhMuc })} className="text-link">Xóa tìm kiếm</Link>}
          </div>
          <p className="result-count">{menu.total} món</p>
          {menu.products.length > 0 ? (
            <div className="product-grid">
              {menu.products.map((product) => (
                <ProductCard key={product.id} product={product} category={categories.get(product.category_id)} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>{filters.trang > lastPage ? "Trang này không có món." : "Không tìm thấy món phù hợp."}</p>
              <Link className="text-link" href={filters.trang > lastPage ? menuHref({ ...filters, trang: 1 }) : "/san-pham"}>
                {filters.trang > lastPage ? "Về trang đầu" : "Xem toàn bộ thực đơn"}
              </Link>
            </div>
          )}
          {lastPage > 1 && filters.trang <= lastPage && (
            <nav aria-label="Phân trang thực đơn" className="pagination">
              {filters.trang > 1 && <Link className="filter-link" href={menuHref({ ...filters, trang: filters.trang - 1 })}>Trang trước</Link>}
              <span>Trang {filters.trang} / {lastPage}</span>
              {filters.trang < lastPage && <Link className="filter-link" href={menuHref({ ...filters, trang: filters.trang + 1 })}>Trang sau</Link>}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
