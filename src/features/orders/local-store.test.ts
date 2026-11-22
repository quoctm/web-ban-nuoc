import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fileTransaction } from "../../lib/json-store";
import type { CheckoutInput } from "../checkout/model";
import { localTransaction } from "./local-store";
import { createOrder } from "./server";

let directory: string;
beforeEach(async () => {
  const tests = resolve(".local-tools", "test-data");
  await mkdir(tests, { recursive: true });
  directory = await mkdtemp(join(tests, "local-orders-"));
  vi.stubEnv("DATA_DIR", directory);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});

it("tạo và lưu đủ 20 đơn đặt song song, không nhân đôi khi gửi lại", async () => {
  const backend = { mode: "local", hmac: undefined } as const;
  const inputs = Array.from({ length: 20 }, (_, index): CheckoutInput => ({
    customerName: "Khách " + index, phone: "0901234567", fulfillment: "pickup", address: "",
    note: "", payment: "cod", idempotencyKey: randomUUID(), expectedFee: 0,
    items: [{ variantId: "nuoc-khoang-M", quantity: 1, sugar: null, ice: null, expectedPrice: 12000 }],
  }));
  const codes = await Promise.all(inputs.map((input) => createOrder(backend, input, null)));
  expect(new Set(codes).size).toBe(20);
  expect(await createOrder(backend, inputs[0], null)).toBe(codes[0]);
  expect(await localTransaction(({ orders }) => orders.map(({ code }) => code))).toEqual(codes);
});

it("phục hồi từ bản sao và giữ nguyên tệp lỗi khi cả hai đều hỏng", async () => {
  const file = join(directory, "catalog.json");
  const counter = (value?: number) => fileTransaction("catalog.json", () => ({ count: 1 }), (data) => {
    if (value !== undefined) data.count = value;
    return data.count;
  }, value !== undefined);
  expect(await counter()).toBe(1);
  expect(await counter(2)).toBe(2);
  await writeFile(file, "not json");
  expect(await counter()).toBe(1);
  expect(JSON.parse(await readFile(file, "utf8"))).toEqual({ count: 1 });
  await writeFile(file, "invalid primary");
  await writeFile(file + ".bak", "invalid backup");
  await expect(counter(3)).rejects.toThrow("Không đọc được dữ liệu cục bộ");
  expect(await readFile(file, "utf8")).toBe("invalid primary");
  expect(await readFile(file + ".bak", "utf8")).toBe("invalid backup");
});
