import { randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { fileTransaction } from "../../lib/json-store.ts";

const derive = promisify(scrypt);
export type LocalUser = {
  id: string;
  email: string;
  role: "admin" | "customer";
  passwordHash: string;
  createdAt?: string;
  temporaryUntil?: number;
};
export function usersTransaction<T>(operation: (users: LocalUser[]) => T | Promise<T>, write = false) {
  return fileTransaction("users.json", (): LocalUser[] => [], operation, write);
}
export async function passwordHash(password: string, salt = randomBytes(16).toString("hex")) {
  return salt + ":" + (await derive(password, salt, 64) as Buffer).toString("hex");
}
export async function verifiesPassword(password: string, stored: string) {
  const hash = await passwordHash(password, stored.split(":")[0]);
  return hash.length === stored.length && timingSafeEqual(Buffer.from(hash), Buffer.from(stored));
}
export async function createLocalUser(email: string, password: string, role: LocalUser["role"]) {
  const hash = await passwordHash(password);
  return usersTransaction((users) => {
    if (users.some((user) => user.email === email)) return null;
    const user: LocalUser = { id: randomUUID(), email, role, passwordHash: hash, createdAt: new Date().toISOString() };
    users.push(user);
    return user;
  }, true);
}
