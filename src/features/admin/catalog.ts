import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { dataDirectory } from "@/lib/json-store";
import { sessionClient } from "@/lib/supabase/session";
import { checkoutBackend } from "../checkout/server-config";
import { catalogTransaction, initialSettings, type ManagedCategory, type ManagedProduct, type ShopSettings } from "../catalog/local-catalog";
import type { categorySchema, productSchema } from "./model";
import { toSlug } from "./model";

export class AdminInputError extends Error {}
const duplicate = "Tên này tạo ra đường dẫn đã tồn tại. Vui lòng dùng tên khác.";
function databaseError(error: { code: string }) {
  if (error.code === "23505") return new AdminInputError(duplicate);
  return error;
}

export async function adminCatalogClient() {
  if (checkoutBackend().mode === "local") return null;
  const client = await sessionClient();
  if (!client) throw new Error("Chưa cấu hình Supabase.");
  return client;
}

export async function loadCategories(client: SupabaseClient | null): Promise<ManagedCategory[]> {
  if (!client) return catalogTransaction(({ categories }) =>
    categories.sort((a, b) => a.sort_order - b.sort_order || a.slug.localeCompare(b.slug)));
  const { data, error } = await client.from("categories").select("id,name,slug,sort_order,is_active").order("sort_order").order("slug");
  if (error) throw error;
  return data;
}

export async function loadProducts(client: SupabaseClient | null): Promise<ManagedProduct[]> {
  if (!client) return catalogTransaction(({ products }) => products.sort((a, b) => a.name.localeCompare(b.name, "vi")));
  const { data, error } = await client.from("products").select(
    "id,name,slug,category_id,description,image_path,is_active,is_available,allow_sugar,allow_ice,product_variants(id,size,price_vnd,is_available)",
  ).order("name");
  if (error) throw error;
  return data.map(({ product_variants, ...product }) => ({
    ...product, variants: product_variants.filter((variant) => variant.is_available),
  }));
}

export async function loadSettings(client: SupabaseClient | null): Promise<ShopSettings> {
  if (!client) return catalogTransaction(({ settings }) => settings);
  const { data, error } = await client.from("settings")
    .select("delivery_fee_vnd,free_delivery_threshold_vnd,pickup_address,bank_bin,bank_account_number,bank_account_name")
    .eq("id", 1).maybeSingle();
  if (error) throw error;
  return data ?? initialSettings;
}

export async function writeCategory(client: SupabaseClient | null, { id, ...fields }: z.infer<typeof categorySchema>) {
  const row = { ...fields, slug: toSlug(fields.name) };
  if (!client) return catalogTransaction(({ categories }) => {
    if (categories.some((entry) => entry.id !== id && entry.slug === row.slug)) throw new AdminInputError(duplicate);
    const existing = categories.find((entry) => entry.id === id);
    if (existing) Object.assign(existing, row);
    else if (!id) categories.push({ id: randomUUID(), ...row });
    else throw new AdminInputError("Không tìm thấy danh mục.");
  }, true);
  const table = client.from("categories");
  const { data, error } = id
    ? await table.update(row).eq("id", z.uuid().parse(id)).select("id").maybeSingle()
    : await table.insert(row).select("id").single();
  if (error) throw databaseError(error);
  if (!data) throw new AdminInputError("Không tìm thấy danh mục.");
}

function imageExtension(file: File, bytes: Buffer) {
  if (file.type === "image/png" && bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) return "png";
  if (file.type === "image/jpeg" && bytes.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"))) return "jpg";
  if (file.type === "image/webp" && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  throw new AdminInputError("Nội dung ảnh phải là JPEG, PNG hoặc WebP hợp lệ.");
}

async function uploadImage(client: SupabaseClient | null, image: File) {
  const bytes = Buffer.from(await image.arrayBuffer());
  const name = randomUUID() + "." + imageExtension(image, bytes);
  if (client) {
    const bucket = client.storage.from("product-images");
    const { error } = await bucket.upload(name, bytes, { contentType: image.type });
    if (error) throw error;
    return { path: name, remove: () => bucket.remove([name]) };
  }
  const path = "uploads/" + name;
  await mkdir(join(dataDirectory(), "uploads"), { recursive: true });
  const file = join(dataDirectory(), path);
  await writeFile(file, bytes, { flag: "wx" });
  return { path, remove: () => unlink(file) };
}

export async function writeProduct(client: SupabaseClient | null, input: z.infer<typeof productSchema>) {
  const { id, image, medium, large, ...fields } = input;
  const slug = toSlug(fields.name);
  const databaseId = client && id ? z.uuid().parse(id) : null;
  const databaseCategory = client ? z.uuid().parse(fields.category_id) : null;
  const uploaded = image.size ? await uploadImage(client, image) : null;
  try {
    if (client) {
      const { error } = await client.rpc("admin_save_product", {
        p_id: databaseId, p_category: databaseCategory,
        p_name: fields.name, p_slug: slug, p_description: fields.description, p_active: fields.is_active,
        p_available: fields.is_available, p_sugar: fields.allow_sugar, p_ice: fields.allow_ice,
        p_image: uploaded?.path ?? null, p_medium: medium, p_large: large,
      });
      if (error) throw databaseError(error);
      return;
    }
    await catalogTransaction(({ categories, products }) => {
      if (!categories.some((entry) => entry.id === fields.category_id)) throw new AdminInputError("Danh mục không tồn tại.");
      if (products.some((entry) => entry.id !== id && entry.slug === slug)) throw new AdminInputError(duplicate);
      const previous = products.find((entry) => entry.id === id);
      if (id && !previous) throw new AdminInputError("Không tìm thấy sản phẩm.");
      const productId = previous?.id ?? randomUUID();
      const variantId = (size: "M" | "L") => previous?.variants.find((variant) => variant.size === size)?.id ?? productId + "-" + size;
      const product: ManagedProduct = {
        ...fields, id: productId, slug, image_path: uploaded?.path ?? previous?.image_path ?? null,
        variants: [{ id: variantId("M"), size: "M", price_vnd: medium }],
      };
      if (large !== null) product.variants.push({ id: variantId("L"), size: "L", price_vnd: large });
      if (previous) Object.assign(previous, product);
      else products.push(product);
    }, true);
  } catch (error) {
    // A lost RPC response can follow a committed write. Keep the image unless the operation definitively failed.
    const sqlError = typeof error === "object" && error !== null && "code" in error && /^[0-9A-Z]{5}$/.test(String(error.code));
    if (!client || error instanceof AdminInputError || sqlError) await uploaded?.remove().catch(() => {});
    throw error;
  }
}

export async function writeSettings(client: SupabaseClient | null, settings: ShopSettings, adminId: string) {
  if (!client) return catalogTransaction((data) => { data.settings = settings; }, true);
  const { error } = await client.from("settings").upsert({ ...settings, id: 1, updated_by: adminId });
  if (error) throw error;
}
