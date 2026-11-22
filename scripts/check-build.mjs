import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function newer(path, builtAt) {
  const info = statSync(path);
  return info.mtimeMs > builtAt
    || (info.isDirectory() && readdirSync(path).some((name) => newer(join(path, name), builtAt)));
}

const marker = ".next/BUILD_ID";
const inputs = ["src", "public", "next.config.ts", "postcss.config.mjs", "tsconfig.json",
  "package.json", "package-lock.json", ".env", ".env.local", ".env.production", ".env.production.local"];

if (!existsSync(marker) || !existsSync(".next/required-server-files.json")
  || inputs.some((path) => existsSync(path) && newer(path, statSync(marker).mtimeMs))) {
  process.exitCode = 1;
}
