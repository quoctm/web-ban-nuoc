import { createCatalogClient } from "../../lib/supabase/server";
import { localMenu, initialSettings, type ShopSettings } from "../catalog/local-catalog";
import { hasBank } from "../payments/vietqr";
import type { Product } from "../catalog/types";
import { lineKey, type Selection } from "../cart/model";
import { type CartReview } from "./model";
import { checkoutBackend, type CheckoutBackend } from "./server-config";
import { z } from "zod";

type CurrentVariant = { name: string; size: "M" | "L"; price: number; sugar: boolean; ice: boolean };

export function availableVariants(products: Product[]) {
  const variants = new Map<string, CurrentVariant>();
  for (const product of products) {
    if (!product.is_available) continue;
    for (const variant of product.variants) {
      variants.set(variant.id, {
        name: product.name, size: variant.size, price: variant.price_vnd,
        sugar: product.allow_sugar, ice: product.allow_ice,
      });
    }
  }
  return variants;
}

export function validOptions(variant: CurrentVariant, { sugar, ice }: Selection) {
  return variant.sugar === (sugar !== null) && variant.ice === (ice !== null);
}

async function currentVariants(selections: Selection[]) {
  const client = createCatalogClient(false);
  if (!client) return availableVariants((await localMenu()).products);
  const ids = [...new Set(selections.map(({ variantId }) => variantId).filter((id) => z.uuid().safeParse(id).success))];
  const result = new Map<string, CurrentVariant>();
  if (!ids.length) return result;
  const { data, error } = await client.from("product_variants")
    .select("id,size,price_vnd,products!inner(name,allow_sugar,allow_ice)")
    .eq("is_available", true).eq("products.is_active", true).eq("products.is_available", true)
    .in("id", ids);
  if (error) throw error;
  for (const row of data as unknown as {
    id: string; size: "M" | "L"; price_vnd: number;
    products: { name: string; allow_sugar: boolean; allow_ice: boolean };
  }[]) {
    result.set(row.id, {
      name: row.products.name, size: row.size, price: row.price_vnd,
      sugar: row.products.allow_sugar, ice: row.products.allow_ice,
    });
  }
  return result;
}

export async function getSettings(backend: CheckoutBackend): Promise<ShopSettings> {
  if (backend.mode === "local") return (await localMenu()).settings;
  if (backend.mode !== "supabase") return initialSettings;
  const { data, error } = await backend.client.from("settings")
    .select("delivery_fee_vnd,free_delivery_threshold_vnd,pickup_address,bank_bin,bank_account_number,bank_account_name").eq("id", 1).maybeSingle();
  if (error) throw error;
  return data ?? initialSettings;
}

export async function reviewCart(lines: (Selection & { price: number })[]): Promise<CartReview> {
  const backend = checkoutBackend();
  const [variants, settings] = await Promise.all([currentVariants(lines), getSettings(backend)]);
  return {
    settings: { delivery_fee_vnd: settings.delivery_fee_vnd,
      free_delivery_threshold_vnd: settings.free_delivery_threshold_vnd, pickup_address: settings.pickup_address },
    vietqrAvailable: backend.mode !== "unavailable" && hasBank(settings),
    checkoutAvailable: backend.mode !== "unavailable",
    lines: lines.map((line) => {
      const variant = variants.get(line.variantId);
      const price = variant && validOptions(variant, line) ? variant.price : null;
      return { key: lineKey(line), price, changed: price !== null && price !== line.price };
    }),
  };
}
