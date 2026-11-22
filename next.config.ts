import type { NextConfig } from "next";

function storageImagePattern() {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    if (url.protocol !== "https:" && url.protocol !== "http:") return [];
    return [new URL("/storage/v1/object/public/product-images/**", url)];
  } catch {
    return [];
  }
}

const config: NextConfig = {
  agentRules: false,
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  images: { remotePatterns: storageImagePattern() },
};

export default config;
