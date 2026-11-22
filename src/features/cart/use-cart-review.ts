"use client";

import { useEffect, useRef, useState } from "react";
import { checkCart } from "../checkout/actions";
import type { CartReview } from "../checkout/model";
import { cartPriceSnapshot, lineKey, type CartLine, type Selection } from "./model";
import { syncReviewedPrices } from "./store";

export function useCartReview(lines: CartLine[]) {
  const snapshot = cartPriceSnapshot(lines);
  const [retry, setRetry] = useState(0);
  const synced = useRef<{ snapshot: string; retry: number } | undefined>(undefined);
  const [result, setResult] = useState<{
    snapshot: string; retry: number; review?: CartReview; error?: string;
    previousPrices?: Map<string, number>;
  }>();

  useEffect(() => {
    if (synced.current?.snapshot === snapshot && synced.current.retry === retry) return;
    synced.current = undefined;
    if (snapshot === "[]") return;
    let active = true;
    const selections: (Selection & { price: number })[] = JSON.parse(snapshot);
    void checkCart(selections).then(
      (data) => {
        if (!active) return;
        if (!data.review) {
          setResult({ snapshot, retry, error: data.error });
          return;
        }

        const prices = new Map<string, number>();
        for (const { key, price, changed } of data.review.lines) {
          if (changed && price !== null) prices.set(key, price);
        }
        const updatedSnapshot = syncReviewedPrices(snapshot, prices);
        if (updatedSnapshot === undefined) return;
        // Keep the old prices only for this page visit, including the render after saving.
        synced.current = { snapshot: updatedSnapshot, retry };
        const previousPrices = new Map<string, number>();
        for (const selection of selections) {
          const key = lineKey(selection);
          if (prices.has(key)) previousPrices.set(key, selection.price);
        }
        setResult({ snapshot: updatedSnapshot, retry, review: data.review, previousPrices });
      },
      () => {
        if (active) setResult({ snapshot, retry, error: "Chưa kiểm tra được giỏ hàng. Vui lòng thử lại." });
      },
    );
    return () => { active = false; };
  }, [snapshot, retry]);

  const current = result?.snapshot === snapshot && result.retry === retry ? result : undefined;
  const review = current?.review;
  const reviewedLines = review?.lines ?? [];
  const byKey = new Map(reviewedLines.map((line) => [line.key, line]));
  const subtotal = lines.reduce((sum, line) => sum + (byKey.get(lineKey(line))?.price ?? 0) * line.quantity, 0);
  return {
    review, byKey, subtotal, error: current?.error,
    unavailable: reviewedLines.some(({ price }) => price === null),
    changed: Boolean(current?.previousPrices?.size),
    previousPrices: current?.previousPrices,
    refresh: () => setRetry((count) => count + 1),
  };
}
