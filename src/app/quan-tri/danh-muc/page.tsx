import { requireAdmin } from "@/features/account/server";
import { saveCategory } from "@/features/admin/actions";
import { adminCatalogClient, loadCategories } from "@/features/admin/catalog";
import { AdminForm } from "@/features/admin/form";
import type { ManagedCategory } from "@/features/catalog/local-catalog";

export const metadata = { title: "Danh mục" };

function CategoryFields({ category }: { category?: ManagedCategory }) {
  return <AdminForm action={saveCategory} fieldsKey={category ? JSON.stringify(category) : undefined} label={category ? "Lưu danh mục" : "Thêm danh mục"}>
    <input type="hidden" name="id" value={category?.id ?? ""} />
    <label className="shop-field">Tên danh mục<input name="name" defaultValue={category?.name} minLength={2} maxLength={80} required /></label>
    <label className="shop-field">Thứ tự hiển thị
      <input name="sort_order" type="number" min={0} max={999999} defaultValue={category?.sort_order ?? 0} required />
    </label>
    <label className="shop-choice"><input type="checkbox" name="is_active" defaultChecked={category?.is_active ?? true} /> Hiện trên thực đơn</label>
  </AdminForm>;
}
export default async function Page() {
  await requireAdmin();
  const categories = await loadCategories(await adminCatalogClient());
  return <>
    <h1>Danh mục</h1>
    <details className="admin-card"><summary>Thêm danh mục</summary><CategoryFields /></details>
    {categories.map((category) => <details key={category.id} className="admin-card">
      <summary>{category.sort_order}. {category.name}{!category.is_active && " · Đã ẩn"}</summary>
      <CategoryFields category={category} />
    </details>)}
  </>;
}
