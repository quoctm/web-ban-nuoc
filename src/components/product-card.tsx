import Image from "next/image";
import Link from "next/link";
import { formatVnd } from "@/lib/currency";
import { productImageUrl } from "@/lib/supabase/server";
import type { Category, Product } from "@/features/catalog/types";
import { CategoryIcon } from "./icons";

const categoryPhotos: Record<string, string> = {
  "tra-sua": "/images/tra-sua.webp",
  "ca-phe": "/images/ca-phe.webp",
  "nuoc-ep": "/images/nuoc-ep.webp",
  "nuoc-dong-chai": "/images/nuoc-dong-chai.webp",
};

export function ProductPhoto({ product, category, detail = false }: {
  product: Product;
  category?: Category;
  detail?: boolean;
}) {
  const src = productImageUrl(product.image_path) ?? categoryPhotos[category?.slug ?? ""];
  return (
    <div className={detail ? "product-photo product-photo-detail" : "product-photo"}>
      {src ? <Image src={src} alt={product.image_path ? product.name : ""} fill
        preload={detail} sizes={detail ? "(max-width: 767px) 100vw, 550px" : "(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 276px"} />
        : <CategoryIcon slug={category?.slug ?? ""} />}
    </div>
  );
}

export function ProductCard({ product, category }: { product: Product; category?: Category }) {
  const price = product.variants.length ? Math.min(...product.variants.map(({ price_vnd }) => price_vnd)) : null;
  return (
    <article className="product-card">
      <Link href={`/san-pham/${product.slug}`} className="product-link">
        <ProductPhoto product={product} category={category} />
        <div className="product-card-body">
          {category && <p className="product-category">{category.name}</p>}
          <h3>{product.name}</h3>
          <p className="product-price">{!product.is_available || price === null ? "Tạm hết" : `Từ ${formatVnd(price)}`}</p>
        </div>
      </Link>
    </article>
  );
}
