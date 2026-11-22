import { cache } from "react";
import { connection } from "next/server";
import { createCatalogClient } from "@/lib/supabase/server";
import { expandSearchAliases, PAGE_SIZE, searchWords, type Filters } from "./filters";
import { localMenu } from "./local-catalog";
import type { Category, Product, Variant } from "./types";

const productColumns = "id,category_id,slug,name,description,image_path,is_available,allow_sugar,allow_ice";
const categoryColumns = "id,slug,name,sort_order";
type ProductRow = Omit<Product, "variants">;

const runtimeLocalMenu = cache(async () => {
  await connection();
  return localMenu();
});

export const getCatalogStatus = cache(async () => {
  const client = createCatalogClient();
  if (!client) return { categories: (await runtimeLocalMenu()).categories, mode: "live" } as const;

  const { data, error } = await client.from("categories").select(categoryColumns)
    .eq("is_active", true).order("sort_order").order("slug");
  if (error) return { categories: [] as Category[], mode: "error" } as const;
  return { categories: data as Category[], mode: "live" } as const;
});

async function filterLocalMenu(filters: Filters, query: string) {
  const { categories, products } = await runtimeLocalMenu();
  const categoryOrder = new Map(categories.map(({ id, sort_order }) => [id, sort_order]));
  const words = searchWords(query);
  const fullWords = words.slice(0, -1);
  const prefix = words.at(-1);
  const matches = products
    .filter((product) => !filters.danhMuc || product.category_id === filters.danhMuc)
    .map((product) => {
      const nameWords = searchWords(product.name);
      const documentWords = [...nameWords, ...searchWords(product.description)];
      const matches = !filters.q || (prefix !== undefined
        && fullWords.every((word) => documentWords.includes(word))
        && documentWords.some((word) => word.startsWith(prefix)));
      const score = (nameWords.join(" ") === query ? 100 : 0)
        + fullWords.filter((word) => nameWords.includes(word)).length
        + Number(prefix !== undefined && nameWords.some((word) => word.startsWith(prefix)));
      return { product, matches, score };
    })
    .filter((item) => item.matches)
    .sort((a, b) => b.score - a.score
      || (categoryOrder.get(a.product.category_id) ?? 0) - (categoryOrder.get(b.product.category_id) ?? 0)
      || a.product.slug.localeCompare(b.product.slug));

  const start = (filters.trang - 1) * PAGE_SIZE;
  return { products: matches.slice(start, start + PAGE_SIZE).map(({ product }) => product), total: matches.length, error: false };
}

async function loadVariants(client: NonNullable<ReturnType<typeof createCatalogClient>>, rows: ProductRow[]) {
  if (!rows.length) return [];

  const { data, error } = await client.from("product_variants").select("id,product_id,size,price_vnd")
    .in("product_id", rows.map(({ id }) => id)).eq("is_available", true).order("size");
  if (error) throw new Error("Không tải được các kích cỡ.");

  const variants = new Map<string, Variant[]>();
  for (const { product_id, ...variant } of data as (Variant & { product_id: string })[]) {
    const group = variants.get(product_id) ?? [];
    group.push(variant);
    variants.set(product_id, group);
  }
  return rows.map((row) => ({ ...row, variants: variants.get(row.id) ?? [] }));
}

export async function getMenu(filters: Filters) {
  const query = expandSearchAliases(filters.q);
  const client = createCatalogClient();
  if (!client) return filterLocalMenu(filters, query);
  if (filters.q && !query) return { products: [], total: 0, error: false };

  const start = (filters.trang - 1) * PAGE_SIZE;
  try {
    const { data, count, error } = await client.rpc("search_menu", {
      p_query: query,
      p_category: filters.danhMuc || null,
    }, { count: "exact" }).select(productColumns).range(start, start + PAGE_SIZE - 1);
    if (error && error.code !== "PGRST103") throw error;
    return { products: await loadVariants(client, (data ?? []) as ProductRow[]), total: count ?? 0, error: false };
  } catch {
    return { products: [], total: 0, error: true };
  }
}

export const getProduct = cache(async (slug: string) => {
  const client = createCatalogClient();
  if (!client) return { product: (await runtimeLocalMenu()).products.find((product) => product.slug === slug) ?? null, error: false };

  try {
    const { data, error } = await client.from("products").select(productColumns)
      .eq("is_active", true).eq("slug", slug).maybeSingle();
    if (error) throw error;
    if (!data) return { product: null, error: false };
    const [product] = await loadVariants(client, [data as ProductRow]);
    return { product, error: false };
  } catch {
    return { product: null, error: true };
  }
});
