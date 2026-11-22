import Link from "next/link";
import { requireAdmin } from "@/features/account/server";
import { saveProduct } from "@/features/admin/actions";
import { adminCatalogClient, loadCategories, loadProducts } from "@/features/admin/catalog";
import { AdminForm } from "@/features/admin/form";
import type { ManagedCategory, ManagedProduct } from "@/features/catalog/local-catalog";
import { ProductPhoto } from "@/components/product-card";

export const metadata = { title: "Sản phẩm" };

function ProductFields({ product, categories }: { product?: ManagedProduct; categories: ManagedCategory[] }) {
  const category = categories.find(({ id }) => id === product?.category_id);
  return <AdminForm action={saveProduct} fieldsKey={product ? JSON.stringify(product) : undefined} label={product ? "Lưu sản phẩm" : "Thêm sản phẩm"}>
    <input type="hidden" name="id" value={product?.id ?? ""} />
    <label className="shop-field">Tên món<input name="name" minLength={2} maxLength={80} defaultValue={product?.name} required /></label>
    <label className="shop-field">Danh mục<select name="category_id" defaultValue={product?.category_id ?? ""} required>
      <option value="" disabled>Chọn danh mục</option>
      {categories.map(({ id, name, is_active }) => <option key={id} value={id}>{name}{!is_active && " (đã ẩn)"}</option>)}
    </select></label>
    <label className="shop-field">Mô tả<textarea name="description" rows={3} maxLength={1000} defaultValue={product?.description} /></label>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="shop-field">Giá M (₫)<input name="medium" type="number" min={0} max={2147483647}
        defaultValue={product?.variants.find(({ size }) => size === "M")?.price_vnd} required /></label>
      <label className="shop-field">Giá L (₫)<input name="large" type="number" min={0} max={2147483647}
        placeholder="Để trống nếu không bán size L" defaultValue={product?.variants.find(({ size }) => size === "L")?.price_vnd} /></label>
    </div>
    <label className="shop-field">Ảnh món (JPEG, PNG, WebP tối đa 5 MB)
      <input name="image" type="file" accept="image/jpeg,image/png,image/webp" />
    </label>
    {product?.image_path && <div className="max-w-40"><ProductPhoto product={product} category={category} /></div>}
    <div className="flex flex-wrap gap-4">
      <label className="shop-choice"><input type="checkbox" name="is_active" defaultChecked={product?.is_active ?? true} /> Hiện trên thực đơn</label>
      <label className="shop-choice"><input type="checkbox" name="is_available" defaultChecked={product?.is_available ?? true} /> Còn hàng</label>
      <label className="shop-choice"><input type="checkbox" name="allow_sugar" defaultChecked={product?.allow_sugar ?? true} /> Chọn mức đường</label>
      <label className="shop-choice"><input type="checkbox" name="allow_ice" defaultChecked={product?.allow_ice ?? true} /> Chọn mức đá</label>
    </div>
  </AdminForm>;
}

export default async function Page() {
  await requireAdmin();
  const client = await adminCatalogClient();
  const [categories, products] = await Promise.all([loadCategories(client), loadProducts(client)]);
  return <>
    <h1>Sản phẩm</h1>
    {categories.length ? <details className="admin-card"><summary>Thêm sản phẩm</summary><ProductFields categories={categories} /></details>
      : <Link href="/quan-tri/danh-muc" className="text-link">Thêm danh mục để đăng sản phẩm</Link>}
    {products.map((product) => <details key={product.id} className="admin-card">
      <summary>{product.name}{!product.is_active ? " · Đã ẩn" : !product.is_available ? " · Hết hàng" : ""}</summary>
      <ProductFields product={product} categories={categories} />
    </details>)}
  </>;
}
