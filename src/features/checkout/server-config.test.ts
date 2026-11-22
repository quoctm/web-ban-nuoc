import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { headers } from "next/headers";
import { localTransaction } from "../orders/local-store";
import { allowAccountRequest, sign, type AvailableBackend } from "./server-config";

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("../orders/local-store", () => ({ localTransaction: vi.fn() }));

const key = "test-rate-key";
const email = "buyer@matnha.test";
let remoteIp = "192.0.2.1";
const store = { limits: {} as Record<string, { count: number; expires: number }> };
const rpc = vi.fn();
const localBackend = { mode: "local", hmac: key } satisfies AvailableBackend;
const supabaseBackend = { mode: "supabase", hmac: key, client: { rpc } } as unknown as AvailableBackend;
const counters = new Map<string, number>();

beforeEach(() => {
  remoteIp = "192.0.2.1";
  store.limits = {};
  counters.clear();
  vi.stubEnv("VERCEL", "1");
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-22T13:30:00Z"));
  vi.mocked(headers).mockImplementation(async () => new Headers({
    "x-vercel-forwarded-for": remoteIp,
    "x-forwarded-for": "192.0.2.99",
  }));
  vi.mocked(localTransaction).mockImplementation(async (operation) => operation({
    ...store, key, orders: [],
  }));
  rpc.mockReset().mockImplementation(async (_name: string, args: { p_subject_hash: string; p_max: number }) => {
    const count = counters.get(args.p_subject_hash) ?? 0;
    if (count >= args.p_max) return { data: false, error: null };
    counters.set(args.p_subject_hash, count + 1);
    return { data: true, error: null };
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe.each([localBackend, supabaseBackend])("giới hạn tài khoản ($mode)", (backend) => {
  it("giới hạn cùng email qua IP khác nhau và chuẩn hóa chữ hoa, khoảng trắng", async () => {
    for (let attempt = 1; attempt <= 5; attempt++) {
      remoteIp = "192.0.2." + attempt;
      expect(await allowAccountRequest(backend, key, email)).toBe(true);
    }
    remoteIp = "192.0.2.6";
    expect(await allowAccountRequest(backend, key, " BUYER@MATNHA.TEST ")).toBe(false);
    expect(await allowAccountRequest(backend, key, "other@matnha.test")).toBe(true);
  });

  it("giới hạn cùng IP ngay cả khi dùng nhiều email khác nhau", async () => {
    for (let attempt = 0; attempt < 30; attempt++) {
      expect(await allowAccountRequest(backend, key, `buyer${attempt}@matnha.test`)).toBe(true);
    }
    expect(await allowAccountRequest(backend, key, email)).toBe(false);
    remoteIp = "192.0.2.2";
    expect(await allowAccountRequest(backend, key, email)).toBe(true);
  });
});

it("dev không tin header IP do trình duyệt gửi và hết hạn sau 10 phút", async () => {
  vi.stubEnv("VERCEL", undefined);
  for (let attempt = 0; attempt < 30; attempt++) {
    remoteIp = "192.0.2." + (attempt + 1);
    expect(await allowAccountRequest(localBackend, key, `buyer${attempt}@matnha.test`)).toBe(true);
  }
  expect(await allowAccountRequest(localBackend, key, email)).toBe(false);
  vi.advanceTimersByTime(600_000);
  expect(await allowAccountRequest(localBackend, key, email)).toBe(true);
});

it("Supabase dùng RPC nguyên tử với hai khóa HMAC và từ chối khi RPC lỗi", async () => {
  expect(await allowAccountRequest(supabaseBackend, key, email)).toBe(true);
  expect(rpc.mock.calls).toEqual([
    ["consume_checkout_rate_limit", { p_subject_hash: sign(key, "rate:auth:ip", remoteIp), p_max: 30, p_window_seconds: 600 }],
    ["consume_checkout_rate_limit", { p_subject_hash: sign(key, "rate:auth:email", email), p_max: 5, p_window_seconds: 600 }],
  ]);
  rpc.mockResolvedValueOnce({ data: null, error: new Error("offline") });
  await expect(allowAccountRequest(supabaseBackend, key, email)).rejects.toThrow("offline");
});
