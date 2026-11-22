import { randomBytes, timingSafeEqual } from "node:crypto";
import { fileTransaction } from "../../lib/json-store.ts";
import type { Order } from "./model";
import { expireOrder } from "./workflow";

type StoredOrder = Order & { idempotencyKey: string };
type LocalData = {
  key: string;
  orders: StoredOrder[];
  limits: Record<string, { count: number; expires: number }>;
};

export function localTransaction<T>(operation: (data: LocalData) => T, write = false): Promise<T> {
  return fileTransaction("orders.json", () => ({ key: randomBytes(32).toString("hex"), orders: [], limits: {} }),
    (data: LocalData, markChanged) => {
      const now = Date.now();
      for (const order of data.orders) {
        if (expireOrder(order, now)) markChanged();
      }
      return operation(data);
    }, write);
}

export function sameHash(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
