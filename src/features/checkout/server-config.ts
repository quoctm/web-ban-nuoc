import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { headers } from "next/headers";
import { getCatalogConfig } from "../../lib/supabase/server";
import { localTransaction } from "../orders/local-store";

export function checkoutBackend() {
  const catalog = getCatalogConfig();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  const hmac = process.env.RATE_LIMIT_HMAC_SECRET?.trim();
  if (catalog && secretKey && hmac && Buffer.byteLength(hmac) >= 32) {
    const client = createClient(catalog.url, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
    });
    return { mode: "supabase", client, hmac } as const;
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    && !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() && !secretKey) {
    return { mode: "local", hmac } as const;
  }
  return { mode: "unavailable" } as const;
}

export type CheckoutBackend = ReturnType<typeof checkoutBackend>;
export type AvailableBackend = Exclude<CheckoutBackend, { mode: "unavailable" }>;

export async function signingKey(backend: AvailableBackend) {
  return backend.hmac || localTransaction(({ key }) => key);
}

export function sign(key: string, purpose: string, value: string) {
  return createHmac("sha256", key).update(purpose).update("\0").update(value).digest("hex");
}

function positiveSetting(value: string | undefined, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number <= 86_400 ? number : fallback;
}

async function clientIp() {
  // Only accept the client IP set by the hosting proxy. Local development shares the localhost bucket.
  const requestHeaders = await headers();
  const forwarded = process.env.VERCEL === "1" ? requestHeaders.get("x-vercel-forwarded-for")?.trim() : null;
  return forwarded && isIP(forwarded) ? forwarded : "unknown";
}

const authWindow = 600;
const authIpLimit = 30;
const authEmailLimit = 5;

export async function allowAccountRequest(backend: AvailableBackend, key: string, email: string) {
  const ip = sign(key, "rate:auth:ip", await clientIp());
  if (!await consumeLimit(backend, ip, authIpLimit, authWindow)) return false;
  const account = sign(key, "rate:auth:email", email.trim().toLowerCase());
  return consumeLimit(backend, account, authEmailLimit, authWindow);
}

export async function allowRequest(backend: AvailableBackend, key: string, scope: "checkout" | "lookup" | "auth", userId?: string) {
  const ip = await clientIp();
  const subject = sign(key, `rate:${scope}`, userId ? `user:${userId}` : ip);
  const limit = scope === "checkout" ? process.env.CHECKOUT_RATE_LIMIT_MAX : process.env.ORDER_LOOKUP_RATE_LIMIT_MAX;
  const window = scope === "checkout"
    ? process.env.CHECKOUT_RATE_LIMIT_WINDOW_SECONDS : process.env.ORDER_LOOKUP_RATE_LIMIT_WINDOW_SECONDS;
  const max = scope === "auth" ? authIpLimit : positiveSetting(limit, scope === "checkout" ? 5 : 15);
  const seconds = scope === "auth" ? authWindow : positiveSetting(window, 600);
  return consumeLimit(backend, subject, max, seconds);
}

async function consumeLimit(backend: AvailableBackend, subject: string, max: number, seconds: number) {
  if (backend.mode === "supabase") {
    const { data, error } = await backend.client.rpc("consume_checkout_rate_limit", {
      p_subject_hash: subject, p_max: max, p_window_seconds: seconds,
    });
    if (error) throw error;
    return data === true;
  }

  return localTransaction(({ limits }) => {
    const now = Date.now();
    for (const [bucket, entry] of Object.entries(limits)) {
      if (entry.expires <= now) delete limits[bucket];
    }
    const start = Math.floor(now / (seconds * 1000)) * seconds * 1000;
    const bucket = `${subject}:${start}`;
    const entry = limits[bucket] ??= { count: 0, expires: start + seconds * 1000 };
    if (entry.count >= max) return false;
    entry.count += 1;
    return true;
  }, true);
}
