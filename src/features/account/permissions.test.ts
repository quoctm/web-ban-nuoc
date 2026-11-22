import { expect, it } from "vitest";
import { canViewContact, isAdmin, type Actor } from "./permissions";

const owner: Actor = { id: "owner", email: "owner@matnha.test", role: "customer" };
const other: Actor = { ...owner, id: "other" };
const admin: Actor = { ...owner, id: "admin", role: "admin" };

it("chỉ cho phép tài khoản có vai trò admin quản trị", () => {
  expect(isAdmin(null)).toBe(false);
  expect(isAdmin(owner)).toBe(false);
  expect(isAdmin(admin)).toBe(true);
});

it("giới hạn thông tin liên hệ cho chủ đơn, admin và phiên vừa đặt", () => {
  expect(canViewContact(null, owner.id)).toBe(false);
  expect(canViewContact(other, owner.id)).toBe(false);
  expect(canViewContact(null, null)).toBe(false);
  expect(canViewContact(owner, owner.id)).toBe(true);
  expect(canViewContact(admin, owner.id)).toBe(true);
  expect(canViewContact(null, null, true)).toBe(true);
});
