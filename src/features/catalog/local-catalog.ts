import { fileTransaction } from "../../lib/json-store.ts";
import { defaultSettings, type DeliverySettings } from "../checkout/model.ts";
import type { BankDetails } from "../payments/vietqr";
import { sampleCategories, sampleProducts } from "./sample-data.ts";
import type { Category, Product } from "./types";

export type ManagedCategory = Category & { is_active: boolean };
export type ManagedProduct = Product & { is_active: boolean };
export type ShopSettings = DeliverySettings & BankDetails;
const emptyBank: BankDetails = { bank_bin: "", bank_account_number: "", bank_account_name: "" };
export const initialSettings: ShopSettings = { ...defaultSettings, ...emptyBank };

type LocalCatalog = { categories: ManagedCategory[]; products: ManagedProduct[]; settings: ShopSettings };
export function initialCatalog(): LocalCatalog {
  return {
    categories: structuredClone(sampleCategories).map((category) => ({ ...category, is_active: true })),
    products: structuredClone(sampleProducts).map((product) => ({ ...product, is_active: true })),
    settings: { ...initialSettings },
  };
}

export function catalogTransaction<T>(operation: (data: LocalCatalog) => T | Promise<T>, write = false) {
  return fileTransaction("catalog.json", initialCatalog, operation, write);
}

function publishedMenu({ categories, products, settings }: LocalCatalog) {
  const active = categories.filter((category) => category.is_active);
  const ids = new Set(active.map(({ id }) => id));
  return {
    categories: active.sort((a, b) => a.sort_order - b.sort_order || a.slug.localeCompare(b.slug)),
    products: products.filter((product) => product.is_active && ids.has(product.category_id)),
    settings,
  };
}

export function localMenu() {
  return catalogTransaction(publishedMenu);
}

export function withLocalMenu<T>(operation: (menu: ReturnType<typeof publishedMenu>) => T | Promise<T>) {
  return catalogTransaction((data) => operation(publishedMenu(data)));
}
