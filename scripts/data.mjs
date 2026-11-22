import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, cp, lstat, mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { dataDirectory } from "../src/lib/json-store.ts";
import { uploadContentType } from "../src/lib/upload-name.ts";
import { loadLocalEnvironment, requireStoppedServer } from "./local-environment.mjs";

const [command, ...args] = process.argv.slice(2);
if (command === "prepare" && args[0] === "dev") process.env.NODE_ENV = "development";
loadLocalEnvironment();

const directory = dataDirectory();
const backupRoot = resolve("backups");

function contains(parent, child) {
  const difference = relative(parent, child);
  return !difference || (!isAbsolute(difference) && !difference.split(/[\\/]/).includes(".."));
}

async function pathExists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function snapshot() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const destination = join(backupRoot, stamp);
  const staging = join(backupRoot, ".staging-" + randomUUID());
  await mkdir(backupRoot, { recursive: true });
  await cp(directory, staging, { recursive: true, force: false, errorOnExist: true });
  await rename(staging, destination);
  console.log("Đã sao lưu vào " + destination);
}

async function replaceDirectory(staging) {
  const previous = directory + ".previous-" + randomUUID();
  const hadData = await pathExists(directory);
  if (hadData) await rename(directory, previous);
  try {
    await rename(staging, directory);
  } catch (error) {
    if (hadData) await rename(previous, directory);
    throw error;
  }
  if (hadData) console.log("Dữ liệu trước thao tác được giữ tại " + previous);
}

async function migrateImages() {
  const legacy = resolve("public", "uploads");
  if (!await pathExists(legacy)) return;
  const uploads = join(directory, "uploads");
  await mkdir(uploads, { recursive: true });
  for (const entry of await readdir(legacy, { withFileTypes: true })) {
    if (!entry.isFile() || !uploadContentType(entry.name)) continue;
    const source = join(legacy, entry.name);
    const destination = join(uploads, entry.name);
    try {
      await copyFile(source, destination, constants.COPYFILE_EXCL);
    } catch (error) {
      if (error.code !== "EEXIST" || !(await readFile(source)).equals(await readFile(destination))) throw error;
    }
    await unlink(source);
  }
}

async function main() {
  if (contains(directory, process.cwd()) || contains(directory, backupRoot) || contains(backupRoot, directory)) {
    throw new Error("DATA_DIR cần trỏ tới thư mục dữ liệu riêng, ngoài thư mục backups.");
  }
  if (command === "prepare") return migrateImages();
  if (command === "restore" && (args.length !== 2 || args[1] !== "--yes")) {
    throw new Error("Xác nhận bằng npm run restore -- <thư mục sao lưu> --yes");
  }
  if (command === "reset" && (args.length !== 1 || args[0] !== "--yes")) {
    throw new Error("Xác nhận bằng npm run reset-data -- --yes");
  }
  await requireStoppedServer();
  if (command === "backup") return snapshot();

  const staging = directory + ".staging-" + randomUUID();
  await mkdir(dirname(directory), { recursive: true });
  if (command === "restore") {
    const source = resolve(args[0]);
    if (contains(directory, source) || contains(source, directory)) {
      throw new Error("Bản sao lưu phải nằm ngoài DATA_DIR.");
    }
    if (!(await lstat(source)).isDirectory()) throw new Error("Đường dẫn phải là một thư mục sao lưu.");
    const entries = await readdir(source);
    const stores = ["catalog.json", "orders.json", "users.json"];
    if (!stores.some((file) => entries.includes(file) || entries.includes(file + ".bak"))) {
      throw new Error("Thư mục này không có dữ liệu của Mát Nhà.");
    }
    await cp(source, staging, { recursive: true, force: false, errorOnExist: true });
  } else if (command === "reset") {
    const { usersTransaction } = await import("../src/features/account/local-users.ts");
    const { initialCatalog } = await import("../src/features/catalog/local-catalog.ts");
    const admins = await usersTransaction((users) => users.filter(({ role }) => role === "admin"));
    await mkdir(staging);
    for (const [filename, data] of [["users.json", admins], ["catalog.json", initialCatalog()]]) {
      const contents = JSON.stringify(data);
      await writeFile(join(staging, filename), contents, { mode: 0o600 });
      await writeFile(join(staging, filename + ".bak"), contents, { mode: 0o600 });
    }
  } else {
    throw new Error("Lệnh thao tác dữ liệu không hợp lệ.");
  }
  await replaceDirectory(staging);
  console.log(command === "reset" ? "Đã xóa dữ liệu thử và khôi phục thực đơn mẫu." : "Đã khôi phục dữ liệu.");
}

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
