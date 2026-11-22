import { z } from "zod";

export const sugarLevels = ["0%", "30%", "50%", "70%", "100%"] as const;
export const iceLevels = ["Không đá", "Ít đá", "Đá thường"] as const;
export const MAX_QUANTITY = 99;
export const MAX_CART_LINES = 100;

export const selectionSchema = z.object({
  variantId: z.string().regex(/^[a-zA-Z0-9-]{1,80}$/),
  sugar: z.enum(sugarLevels).nullable(),
  ice: z.enum(iceLevels).nullable(),
});

export const priceSchema = z.int().min(0).max(2_147_483_647);
export const quantitySchema = z.int().min(1).max(MAX_QUANTITY);
export const cartLineSchema = selectionSchema.extend({
  quantity: quantitySchema,
  name: z.string().min(1),
  size: z.enum(["M", "L"]),
  price: priceSchema,
});

export type Selection = z.infer<typeof selectionSchema>;
export type CartLine = z.infer<typeof cartLineSchema>;

export function lineKey({ variantId, sugar, ice }: Selection) {
  return JSON.stringify([variantId, sugar, ice]);
}

export function mergeLine(lines: CartLine[], line: CartLine) {
  const key = lineKey(line);
  if (lines.some((current) => lineKey(current) === key)) {
    return lines.map((current) => lineKey(current) === key
      ? { ...current, quantity: Math.min(MAX_QUANTITY, current.quantity + line.quantity) }
      : current);
  }
  return lines.length < MAX_CART_LINES ? [...lines, line] : lines;
}

export function parseStoredCart(raw: string): CartLine[] {
  let stored: unknown;
  try {
    stored = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(stored)) return [];

  return stored.reduce<CartLine[]>((lines, row) => {
    const parsed = cartLineSchema.safeParse(row);
    return parsed.success ? mergeLine(lines, parsed.data) : lines;
  }, []);
}

export function cartPriceSnapshot(lines: CartLine[]) {
  return JSON.stringify(lines.map(({ variantId, sugar, ice, price }) => ({ variantId, sugar, ice, price })));
}

export function selectionLabel({ size, sugar, ice }: Pick<CartLine, "size" | "sugar" | "ice">) {
  return [`Size ${size}`, sugar && `Đường ${sugar}`, ice].filter(Boolean).join(" · ");
}
