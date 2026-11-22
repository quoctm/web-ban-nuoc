import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { checkoutBackend, sign, signingKey } from "../checkout/server-config";
import { sameHash } from "../orders/local-store";
import { sessionClient } from "@/lib/supabase/session";
import { isAdmin, type Actor } from "./permissions";
import { usersTransaction, type LocalUser } from "./local-users";

const sessionCookie = "mat-nha-session";
const sessionSeconds = 7 * 24 * 60 * 60;

async function sessionSignature(user: LocalUser, expires: string | number) {
  const backend = checkoutBackend();
  if (backend.mode !== "local") throw new Error("Phiên cục bộ chưa sẵn sàng.");
  return sign(await signingKey(backend), "local-session", [user.id, expires, user.passwordHash].join(":"));
}

export async function setLocalSession(user: LocalUser) {
  const expires = Math.floor(Date.now() / 1000) + sessionSeconds;
  (await cookies()).set(sessionCookie, [user.id, expires, await sessionSignature(user, expires)].join("."), {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: sessionSeconds,
  });
}
export async function clearLocalSession() {
  (await cookies()).delete(sessionCookie);
}

export const currentActor = cache(async (): Promise<Actor | null> => {
  if (checkoutBackend().mode === "local") {
    const value = (await cookies()).get(sessionCookie)?.value;
    const match = value?.match(/^([0-9a-f-]{36})\.([0-9]{1,12})\.([0-9a-f]{64})$/);
    if (!match || Number(match[2]) <= Date.now() / 1000) return null;
    const user = await usersTransaction((users) => users.find(({ id }) => id === match[1]));
    if (!user || !sameHash(match[3], await sessionSignature(user, match[2]))) return null;
    return { id: user.id, email: user.email, role: user.role };
  }
  const client = await sessionClient();
  if (!client) return null;
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const { data } = await client.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return { id: user.id, email: user.email ?? "", role: data?.role === "admin" ? "admin" : "customer" };
});

export async function requireAdmin() {
  const actor = await currentActor();
  if (!actor) redirect("/dang-nhap");
  if (!isAdmin(actor)) redirect("/");
  return actor;
}
