"use client";

import { useState, type FormEvent } from "react";
import { z } from "zod";
import { formatVnd } from "@/lib/currency";
import { iceLevels, MAX_QUANTITY, sugarLevels } from "@/features/cart/model";
import { addToCart } from "@/features/cart/store";
import type { Variant } from "./types";

const MIN_QUANTITY = 1;
const quantityError = "Nhập số nguyên từ 1 đến 99.";
const quantitySchema = z.string().regex(/^[0-9]+$/).transform(Number)
  .pipe(z.int().min(MIN_QUANTITY).max(MAX_QUANTITY));

const selectionSchema = z.object({
  variant: z.string().min(1),
  quantity: quantitySchema,
  sugar: z.enum(sugarLevels).optional(),
  ice: z.enum(iceLevels).optional(),
});

function clampQuantity(value: number) {
  return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, Math.trunc(value) || MIN_QUANTITY));
}

export function ProductOptions({ productName, variants, allowSugar, allowIce, available }: {
  productName: string;
  variants: Variant[];
  allowSugar: boolean;
  allowIce: boolean;
  available: boolean;
}) {
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [quantity, setQuantity] = useState(String(MIN_QUANTITY));
  const [message, setMessage] = useState("");
  const variant = variants.find(({ id }) => id === variantId);
  const parsedQuantity = quantitySchema.safeParse(quantity);
  const previewQuantity = parsedQuantity.success ? parsedQuantity.data : clampQuantity(Number(quantity));

  if (!available || !variant) return <p className="sold-out">Món này đang tạm hết.</p>;

  function stepQuantity(step: number) {
    setQuantity((current) => String(clampQuantity(clampQuantity(Number(current)) + step)));
    setMessage("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const selection = selectionSchema.safeParse({
      variant: fields.get("variant"),
      quantity: fields.get("quantity"),
      sugar: allowSugar ? fields.get("sugar") : undefined,
      ice: allowIce ? fields.get("ice") : undefined,
    });
    const selected = selection.success && variants.find(({ id }) => id === selection.data.variant);
    if (!selection.success || !selected) {
      setMessage("Vui lòng kiểm tra lại lựa chọn và nhập số lượng từ 1 đến 99.");
      return;
    }
    const added = addToCart({
      variantId: selected.id, name: productName, size: selected.size, price: selected.price_vnd,
      sugar: selection.data.sugar ?? null, ice: selection.data.ice ?? null,
      quantity: selection.data.quantity,
    });
    setMessage(added ? "Đã thêm vào giỏ hàng." : "Giỏ hàng đã đạt số lựa chọn tối đa.");
  }

  return (
    <form noValidate onSubmit={submit} onChange={() => setMessage("")} className="product-options">
      <fieldset>
        <legend>Kích cỡ</legend>
        <div className="size-options">
          {variants.map((option) => (
            <label key={option.id} className="size-option">
              <input type="radio" name="variant" value={option.id} checked={variantId === option.id}
                onChange={() => setVariantId(option.id)} />
              <span>{option.size} <small>{formatVnd(option.price_vnd)}</small></span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="options-grid">
        {allowSugar && (
          <label>Mức đường
            <select name="sugar" defaultValue="100%">
              {sugarLevels.map((level) => <option key={level}>{level}</option>)}
            </select>
          </label>
        )}
        {allowIce && (
          <label>Mức đá
            <select name="ice" defaultValue="Đá thường">
              {iceLevels.map((level) => <option key={level}>{level}</option>)}
            </select>
          </label>
        )}
        <div className="quantity-field">
          <label htmlFor="product-quantity">Số lượng</label>
          <div className="quantity-stepper">
            <button type="button" aria-label="Giảm số lượng"
              disabled={parsedQuantity.success && previewQuantity === MIN_QUANTITY}
              onClick={() => stepQuantity(-1)}>−</button>
            <input id="product-quantity" name="quantity" type="number" inputMode="numeric"
              min={MIN_QUANTITY} max={MAX_QUANTITY} step={1} required value={quantity}
              aria-invalid={!parsedQuantity.success} aria-describedby="quantity-error"
              onChange={(event) => setQuantity(event.target.value)}
              onBlur={() => setQuantity(String(previewQuantity))} />
            <button type="button" aria-label="Tăng số lượng"
              disabled={parsedQuantity.success && previewQuantity === MAX_QUANTITY}
              onClick={() => stepQuantity(1)}>+</button>
          </div>
        </div>
      </div>
      <p id="quantity-error" className="quantity-error" aria-live="polite">{parsedQuantity.success ? "" : quantityError}</p>
      <p className="detail-price" aria-live="polite">
        {formatVnd(variant.price_vnd * previewQuantity)}
      </p>
      <button type="submit" className="button button-primary">Thêm vào giỏ</button>
      <p role="status" className="options-status">{message}</p>
    </form>
  );
}
