import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CatalogNotice } from "@/components/catalog-notice";
import { ProductPhoto } from "@/components/product-card";
import { getCatalogStatus, getProduct } from "@/features/catalog/data";
import { menuHref, slugSchema } from "@/features/catalog/filters";
import { ProductOptions } from "@/features/catalog/product-options";

type ProductPageProps = { params: Promise<{ slug: string }> };

async function loadProduct(params: ProductPageProps["params"]) {
  const slug = slugSchema.safeParse((await params).slug);
  return slug.success ? getProduct(slug.data) : { product: null, error: false };
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { product, error } = await loadProduct(params);
  if (product) return { title: product.name, description: product.description };
  return { title: error ? "Chi tiết món" : "Không tìm thấy món" };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const [catalog, result] = await Promise.all([getCatalogStatus(), loadProduct(params)]);
  if (result.error) {
    return <div className="shell detail-page"><CatalogNotice /><Link href="/san-pham" className="text-link">Về thực đơn</Link></div>;
  }
  if (!result.product) notFound();
  const product = result.product;
  const category = catalog.categories.find(({ id }) => id === product.category_id);

  return (
    <div className="shell detail-page">
      <nav className="breadcrumbs" aria-label="Đường dẫn">
        <Link href="/san-pham">Thực đơn</Link>
        {category && <><span aria-hidden="true">/</span><Link href={menuHref({ danhMuc: category.slug })}>{category.name}</Link></>}
      </nav>
      {catalog.mode !== "live" && <CatalogNotice />}
      <div className="detail-grid">
        <ProductPhoto product={product} category={category} detail />
        <div className="detail-copy">
          <h1>{product.name}</h1>
          <p className="detail-description">{product.description}</p>
          <ProductOptions key={product.id} productName={product.name} variants={product.variants} allowSugar={product.allow_sugar}
            allowIce={product.allow_ice} available={product.is_available} />
        </div>
      </div>
    </div>
  );
}
