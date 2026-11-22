export type Actor = { id: string; email: string; role: "admin" | "customer" };

export function isAdmin(actor: Actor | null): actor is Actor & { role: "admin" } {
  return actor?.role === "admin";
}
export function canViewContact(actor: Actor | null, owner: string | null | undefined, checkoutAccess = false) {
  return checkoutAccess || isAdmin(actor) || Boolean(actor && actor.id === owner);
}
