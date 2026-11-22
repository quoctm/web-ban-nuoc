"use client";

import { useSyncExternalStore } from "react";
import { cartPriceSnapshot, lineKey, mergeLine, parseStoredCart, quantitySchema, type CartLine } from "./model";

const storageKey = "mat-nha.cart.v1";
const initial = { lines: [] as CartLine[], ready: false, storageAvailable: true };
let cart = initial;
let hasUnsavedChanges = false;
const listeners = new Set<() => void>();

function publish(next: typeof cart) {
  cart = next;
  listeners.forEach((listener) => listener());
}

function readCart() {
  try {
    const raw = localStorage.getItem(storageKey);
    const lines = raw === null ? [] : parseStoredCart(raw);
    if (raw !== null && raw !== JSON.stringify(lines)) {
      saveCart(lines);
      return;
    }
    publish({ ready: true, storageAvailable: true, lines });
  } catch {
    publish({ ...cart, ready: true, storageAvailable: false });
  }
}

function onStorage(event: StorageEvent) {
  if (!hasUnsavedChanges && (event.key === storageKey || event.key === null)) readCart();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener("storage", onStorage);
    if (!hasUnsavedChanges) readCart();
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.removeEventListener("storage", onStorage);
  };
}

export function useCart() {
  return useSyncExternalStore(subscribe, () => cart, () => initial);
}

function update(transform: (lines: CartLine[]) => CartLine[]) {
  if (!cart.ready) readCart();
  const lines = transform(cart.lines);
  if (lines === cart.lines) return false;
  saveCart(lines);
  return true;
}

function saveCart(lines: CartLine[]) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(lines));
    hasUnsavedChanges = false;
  } catch {
    hasUnsavedChanges = true;
  }
  publish({ ready: true, lines, storageAvailable: !hasUnsavedChanges });
}

export function syncReviewedPrices(snapshot: string, prices: ReadonlyMap<string, number>) {
  // A response for an older cart must not overwrite later edits.
  if (cartPriceSnapshot(cart.lines) !== snapshot) return;
  if (!prices.size) return snapshot;

  const updated = cart.lines.map((line) => {
    const price = prices.get(lineKey(line));
    return price === undefined ? line : { ...line, price };
  });
  saveCart(updated);
  return cartPriceSnapshot(updated);
}

export function addToCart(line: CartLine) {
  return update((lines) => mergeLine(lines, line));
}

export function changeQuantity(key: string, quantity: number) {
  if (!quantitySchema.safeParse(quantity).success) return;
  update((lines) => lines.map((line) => lineKey(line) === key ? { ...line, quantity } : line));
}

export function removeLine(key: string) {
  update((lines) => lines.filter((line) => lineKey(line) !== key));
}

export function clearCart() {
  update(() => []);
}
