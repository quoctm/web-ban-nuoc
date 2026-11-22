import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fileTransaction } from "./json-store";

vi.mock("node:fs/promises", async (importOriginal) => {
  const fs = await importOriginal<typeof import("node:fs/promises")>();
  return { ...fs, rename: vi.fn(fs.rename) };
});
vi.mock("node:timers/promises", async (importOriginal) => ({
  ...await importOriginal<typeof import("node:timers/promises")>(),
  setTimeout: vi.fn(async () => {}),
}));

const renameMock = vi.mocked(rename);
const delayMock = vi.mocked(delay);
const filename = "catalog.json";
let directory: string;
let file: string;

beforeEach(async () => {
  const tests = resolve(".local-tools", "test-data");
  await mkdir(tests, { recursive: true });
  directory = await mkdtemp(join(tests, "json-rename-"));
  file = join(directory, filename);
  await writeFile(file, '{"count":1}');
  vi.stubEnv("DATA_DIR", directory);
});

afterEach(async () => {
  renameMock.mockReset();
  delayMock.mockClear();
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});

function writeCount(count: number) {
  return fileTransaction(filename, () => ({ count: 0 }), (data) => { data.count = count; }, true);
}

function fileError(code: string) {
  return Object.assign(new Error(code), { code });
}

it("thử lại khi Windows tạm khóa cả bản sao và tệp chính", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  const errors = ["EPERM", "EBUSY", "EACCES"];
  const failures = new Map<string, number>();
  renameMock.mockImplementation(async (source, destination) => {
    const target = String(destination);
    const attempt = failures.get(target) ?? 0;
    if (attempt < errors.length) {
      failures.set(target, attempt + 1);
      throw fileError(errors[attempt]);
    }
    await actual.rename(source, destination);
  });

  await writeCount(2);

  expect(delayMock.mock.calls.flat()).toEqual([20, 40, 80, 20, 40, 80]);
  expect(await readFile(file, "utf8")).toBe('{"count":2}');
  expect(await readFile(file + ".bak", "utf8")).toBe('{"count":1}');
  expect((await readdir(directory)).sort()).toEqual([filename, filename + ".bak"]);
});

it.each([
  { code: "EBUSY", waits: [20, 40, 80, 160, 320] },
  { code: "ENOSPC", waits: [] },
])("giữ nguyên tệp chính khi rename thất bại với $code", async ({ code, waits }) => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  renameMock.mockImplementation(async (source, destination) => {
    if (destination === file) throw fileError(code);
    await actual.rename(source, destination);
  });

  await expect(writeCount(2)).rejects.toMatchObject({ code });
  expect(delayMock.mock.calls.flat()).toEqual(waits);
  expect(renameMock.mock.calls.filter(([, destination]) => destination === file)).toHaveLength(waits.length + 1);
  expect(await readFile(file, "utf8")).toBe('{"count":1}');
  expect(await readFile(file + ".bak", "utf8")).toBe('{"count":1}');
  expect((await readdir(directory)).sort()).toEqual([filename, filename + ".bak"]);
});
