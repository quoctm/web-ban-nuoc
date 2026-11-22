import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getCatalogConfig } from "./server";

export async function sessionClient() {
  const config = getCatalogConfig();
  if (!config) return null;
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll(entries) {
        try {
          for (const { name, value, options } of entries) jar.set(name, value, options);
        } catch {
          // Server Components get refreshed cookies from the proxy.
        }
      },
    },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}

export function siteUrl() {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const url = new URL(site);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("NEXT_PUBLIC_SITE_URL không hợp lệ.");
  return url.origin;
}
