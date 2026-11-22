import { z } from "zod";

export const PAGE_SIZE = 8;
export const slugSchema = z.string().max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const searchSchema = z.string().trim().max(80).catch("");
const pageSchema = z.string().regex(/^[0-9]+$/).transform(Number)
  .pipe(z.int().min(1).max(100_000)).catch(1);

export const menuFilters = z.object({
  q: searchSchema,
  danhMuc: slugSchema.catch(""),
  trang: pageSchema,
});

export type Filters = z.output<typeof menuFilters>;

export function menuHref({ q = "", danhMuc = "", trang = 1 }: Partial<Filters> = {}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (danhMuc) params.set("danhMuc", danhMuc);
  if (trang > 1) params.set("trang", String(trang));
  const query = params.toString();
  return query ? `/san-pham?${query}` : "/san-pham";
}

export function normalizeVietnamese(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "")
    .replaceAll("đ", "d").trim().replace(/\s+/g, " ");
}

const searchAliases: Record<string, string> = {
  cafe: "ca phe",
  coffee: "ca phe",
  "milk tea": "tra sua",
};
const aliasPattern = new RegExp(`\\b(?:${Object.keys(searchAliases).join("|")})\\b`, "g");

export function searchWords(value: string): string[] {
  return normalizeVietnamese(value).match(/[a-z0-9]+/g) ?? [];
}

export function expandSearchAliases(value: string) {
  return searchWords(value).join(" ").replace(aliasPattern, (alias) => searchAliases[alias]);
}
