import { createClient } from "@supabase/supabase-js";
import { uploadContentType } from "../upload-name";

export function getCatalogConfig() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    if (!key || !["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    return { url: url.origin, key };
  } catch {
    return null;
  }
}

export function createCatalogClient(cached = true) {
  const config = getCatalogConfig();
  return config && createClient(config.url, config.key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, cached
      ? { ...init, next: { revalidate: 60 } } : { ...init, cache: "no-store" }) },
  });
}

export function productImageUrl(path: string | null) {
  const config = getCatalogConfig();
  if (!path) return null;
  if (!config) {
    const name = path.startsWith("uploads/") ? path.slice("uploads/".length) : "";
    return uploadContentType(name) ? "/api/anh/" + name : null;
  }
  const segments = path.split("/");
  if (segments.some((part) => !part || part === "." || part === "..")) return null;
  return `${config.url}/storage/v1/object/public/product-images/${segments.map(encodeURIComponent).join("/")}`;
}
