import { randomInt } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { availableVariants, validOptions } from "../checkout/catalog-review";
import { deliveryFee, type CheckoutInput } from "../checkout/model";
import { sign, type AvailableBackend } from "../checkout/server-config";
import { localTransaction, sameHash } from "./local-store";
import { orderAlphabet, orderCodeLength, orderPath, type Order, type OrderItem, type OrderStatus } from "./model";
import { withLocalMenu } from "../catalog/local-catalog";
import { hasBank, paymentWindowMs } from "../payments/vietqr";
import { expireOrder } from "./workflow";

const accessCookie = "mat-nha-order";
const accessSeconds = 30 * 60;
// Cookies signed by the old lookup flow must never authorize a full view.
const checkoutAccessScope = "order-checkout";

export class ChangedCartError extends Error {}

export class VietQrUnavailableError extends Error {}

export async function createOrder(backend: AvailableBackend, input: CheckoutInput, userId: string | null) {
  if (backend.mode === "supabase") {
    const items = input.items.map(({ variantId, quantity, sugar, ice, expectedPrice }) => ({
      variant_id: z.uuid().parse(variantId), quantity,
      sugar_level: sugar, ice_level: ice, expected_price: expectedPrice,
    }));
    const { data, error } = await backend.client.rpc("create_order", {
      p_idempotency_key: input.idempotencyKey,
      p_customer_name: input.customerName,
      p_phone: input.phone,
      p_fulfillment: input.fulfillment,
      p_address: input.address,
      p_note: input.note,
      p_items: items,
      p_expected_fee: input.expectedFee,
      p_user_id: userId,
      p_method: input.payment,
    });
    if (error?.message === "vietqr_unavailable") throw new VietQrUnavailableError();
    if (error?.message === "cart_changed") throw new ChangedCartError();
    if (error || typeof data !== "string") throw new Error("Không tạo được đơn.");
    return data;
  }

  return withLocalMenu(({ products, settings }) => localTransaction(({ orders }) => {
    const existing = orders.find((order) => order.idempotencyKey === input.idempotencyKey);
    if (existing) {
      if ((existing.userId ?? null) !== userId) throw new Error("Không tạo được đơn.");
      return existing.code;
    }
    const variants = availableVariants(products);
    const items = input.items.map(({ expectedPrice, ...item }) => {
      const variant = variants.get(item.variantId);
      if (!variant || !validOptions(variant, item) || variant.price !== expectedPrice) throw new ChangedCartError();
      return { ...item, name: variant.name, size: variant.size, price: variant.price };
    });
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const fee = deliveryFee(subtotal, input.fulfillment, settings);
    if (fee !== input.expectedFee) throw new ChangedCartError();

    if (subtotal + fee > 2147483647) throw new Error("Tổng tiền vượt giới hạn.");
    const vietqr = input.payment === "vietqr";
    if (vietqr && (!hasBank(settings) || subtotal + fee <= 0)) throw new VietQrUnavailableError();
    const now = Date.now();
    let code: string;
    do {
      code = "MN-" + Array.from({ length: orderCodeLength }, () => orderAlphabet[randomInt(orderAlphabet.length)]).join("");
    } while (orders.some((order) => order.code === code));

    orders.push({
      code, idempotencyKey: input.idempotencyKey,
      customerName: input.customerName, phone: input.phone, note: input.note,
      userId, createdAt: new Date(now).toISOString(),
      status: vietqr ? "awaiting_payment" : "confirmed", fulfillment: input.fulfillment,
      expiresAt: vietqr ? new Date(now + paymentWindowMs).toISOString() : null,
      payment: {
        method: input.payment, status: "pending",
        ...(vietqr ? { bank: {
          bank_bin: settings.bank_bin, bank_account_number: settings.bank_account_number,
          bank_account_name: settings.bank_account_name,
        }, reference: code.replace("-", "") } : {}),
      },
      address: input.fulfillment === "delivery" ? input.address : settings.pickup_address,
      subtotal, fee, total: subtotal + fee, items,
    });
    return code;
  }, true));
}

export async function grantCheckoutAccess(key: string, code: string) {
  const expires = Math.floor(Date.now() / 1000) + accessSeconds;
  (await cookies()).set(accessCookie, `${expires}.${sign(key, checkoutAccessScope, `${code}:${expires}`)}`, {
    httpOnly: true,
    secure: Boolean(process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https:")),
    sameSite: "lax",
    path: orderPath(code),
    maxAge: accessSeconds,
  });
}

export async function hasCheckoutAccess(key: string, code: string) {
  const cookie = (await cookies()).get(accessCookie)?.value;
  const match = cookie?.match(/^([0-9]{1,12})\.([0-9a-f]{64})$/);
  if (!match || Number(match[1]) <= Math.floor(Date.now() / 1000)) return false;
  return sameHash(match[2], sign(key, checkoutAccessScope, `${code}:${match[1]}`));
}

export async function readOrder(backend: AvailableBackend, code: string, owner?: string): Promise<Order | null> {
  if (backend.mode === "local") {
    return localTransaction(({ orders }) => orders.find((order) => order.code === code && (!owner || order.userId === owner)) ?? null);
  }
  let query = backend.client.from("orders")
    .select(`${summaryColumns},user_id,customer_name,phone,delivery_address,pickup_address,customer_note,subtotal_vnd,delivery_fee_vnd,cancel_reason,
      order_items(variant_id,product_name,size,unit_price_vnd,quantity,sugar_level,ice_level),
      payments(method,status,bank_bin,bank_account_number,bank_account_name,transfer_reference,paid_at)`)
    .eq("code", code);
  if (owner) query = query.eq("user_id", owner);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const payment = Array.isArray(data.payments) ? data.payments[0] : data.payments;
  const order: Order = {
    ...summaryFromRow(data),
    userId: data.user_id,
    cancelReason: data.cancel_reason,
    payment: payment ? {
      method: payment.method, status: payment.status, reference: payment.transfer_reference ?? undefined,
      paidAt: payment.paid_at ?? undefined,
      bank: payment.method === "vietqr" ? {
        bank_bin: payment.bank_bin, bank_account_number: payment.bank_account_number, bank_account_name: payment.bank_account_name,
      } : undefined,
    } : undefined,
    customerName: data.customer_name,
    phone: data.phone,
    address: data.delivery_address ?? data.pickup_address,
    note: data.customer_note,
    subtotal: data.subtotal_vnd,
    fee: data.delivery_fee_vnd,
    total: data.total_vnd,
    items: (data.order_items as OrderItemRow[]).map((item): OrderItem => ({
      variantId: item.variant_id, name: item.product_name, size: item.size,
      price: item.unit_price_vnd, quantity: item.quantity, sugar: item.sugar_level, ice: item.ice_level,
    })),
  };
  expireOrder(order, Date.now());
  return order;
}

type OrderItemRow = {
  variant_id: string; product_name: string; size: OrderItem["size"]; unit_price_vnd: number;
  quantity: number; sugar_level: OrderItem["sugar"]; ice_level: OrderItem["ice"];
};

type Summary = Pick<Order, "code" | "status" | "fulfillment" | "total" | "createdAt" | "expiresAt">;
type SummaryRow = {
  code: string; status: OrderStatus; fulfillment_method: Order["fulfillment"];
  total_vnd: number; created_at: string; payment_expires_at: string | null;
};
const summaryColumns = "code,status,fulfillment_method,total_vnd,created_at,payment_expires_at";
export const orderPageSize = 20;

function summaryFromRow(row: SummaryRow): Summary {
  return { code: row.code, status: row.status, fulfillment: row.fulfillment_method,
    total: row.total_vnd, createdAt: row.created_at, expiresAt: row.payment_expires_at };
}

type OrderListQuery = { page: number; owner: string } | { page: number; status?: OrderStatus };
export async function listOrders(backend: AvailableBackend, query: OrderListQuery): Promise<{ orders: Summary[]; more: boolean }> {
  const start = (query.page - 1) * orderPageSize;
  if (backend.mode === "local") {
    return localTransaction(({ orders }) => {
      const filtered = orders.slice().reverse().filter((order) =>
        "owner" in query ? order.userId === query.owner : !query.status || order.status === query.status);
      return { orders: filtered.slice(start, start + orderPageSize).map(({ code, status, fulfillment, total, createdAt, expiresAt }) =>
        ({ code, status, fulfillment, total, createdAt, expiresAt })), more: filtered.length > start + orderPageSize };
    });
  }
  const now = new Date().toISOString();
  let rows = backend.client.from("orders").select(summaryColumns)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).range(start, start + orderPageSize);
  if ("owner" in query) rows = rows.eq("user_id", query.owner);
  else if (query.status === "cancelled") rows = rows.or(`status.eq.cancelled,and(status.eq.awaiting_payment,payment_expires_at.lte.${now})`);
  else if (query.status === "awaiting_payment") rows = rows.eq("status", query.status).gt("payment_expires_at", now);
  else if (query.status) rows = rows.eq("status", query.status);
  const { data, error } = await rows;
  if (error) throw error;
  return {
    orders: data.slice(0, orderPageSize).map((row) => {
      const summary = summaryFromRow(row);
      if (summary.status === "awaiting_payment" && summary.expiresAt && Date.parse(summary.expiresAt) <= Date.parse(now)) summary.status = "cancelled";
      return summary;
    }),
    more: data.length > orderPageSize,
  };
}

export async function latestContact(backend: AvailableBackend, userId: string) {
  if (backend.mode === "local") {
    return localTransaction(({ orders }) => {
      const match = orders.findLast((order) => order.userId === userId);
      return match ? { customerName: match.customerName, phone: match.phone } : undefined;
    });
  }
  const { data, error } = await backend.client.from("orders").select("customer_name,phone")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data ? { customerName: data.customer_name, phone: data.phone } : undefined;
}
