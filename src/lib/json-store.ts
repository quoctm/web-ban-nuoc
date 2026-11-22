import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const state = globalThis as typeof globalThis & { matNhaFileQueues?: Map<string, Promise<unknown>> };
const renameRetryDelays = [20, 40, 80, 160, 320];
const retryableRenameErrors = new Set(["EPERM", "EBUSY", "EACCES"]);

export function dataDirectory() {
  return resolve(/* turbopackIgnore: true */ process.env.DATA_DIR?.trim() || ".data");
}

export class LocalDataError extends Error {
  constructor(filename: string, cause: unknown) {
    super(`Không đọc được dữ liệu cục bộ (${filename}). Hãy liên hệ quản trị viên để kiểm tra bản sao lưu.`,
      { cause: cause instanceof SyntaxError ? undefined : cause });
  }
}

function missing(error: unknown) {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}

async function renameWithRetry(source: string, destination: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(source, destination);
      return;
    } catch (error) {
      const wait = renameRetryDelays[attempt];
      const code = (error as NodeJS.ErrnoException).code;
      if (wait === undefined || !code || !retryableRenameErrors.has(code)) throw error;
      await delay(wait);
    }
  }
}

async function replaceFile(path: string, contents: string) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = path + "." + randomUUID() + ".tmp";
  try {
    await writeFile(temporary, contents, { mode: 0o600, flag: "wx", flush: true });
    await renameWithRetry(temporary, path);
  } finally {
    await unlink(temporary).catch(() => {});
  }
}

export function fileTransaction<T, R>(
  filename: string, initial: () => T, operation: (data: T, markChanged: () => void) => R | Promise<R>, write = false,
): Promise<R> {
  const path = resolve(dataDirectory(), filename);
  const backup = path + ".bak";
  const queues = state.matNhaFileQueues ??= new Map();
  const task = (queues.get(path) ?? Promise.resolve()).then(async () => {
    let data: T;
    let previous: string | undefined;
    let changed = write;
    try {
      previous = await readFile(/* turbopackIgnore: true */ path, "utf8");
      data = JSON.parse(previous);
    } catch (error) {
      if (!missing(error) && !(error instanceof SyntaxError)) throw new LocalDataError(filename, error);
      try {
        previous = await readFile(backup, "utf8");
        data = JSON.parse(previous);
        await replaceFile(path, previous);
      } catch (backupError) {
        if (!missing(error) || !missing(backupError)) throw new LocalDataError(filename, backupError);
        data = initial();
        changed = true;
      }
    }

    const result = await operation(data, () => { changed = true; });
    if (changed) {
      const next = JSON.stringify(data);
      await replaceFile(backup, previous ?? next);
      await replaceFile(path, next);
    }
    return result;
  });
  queues.set(path, task.catch(() => {}));
  return task;
}
