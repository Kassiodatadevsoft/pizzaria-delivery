import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCtx(role: "user" | "admin" | null = null): TrpcContext {
  const user =
    role === null
      ? null
      : {
          id: role === "admin" ? 1 : 2,
          openId: role === "admin" ? "admin-open-id" : "user-open-id",
          name: role === "admin" ? "Admin" : "Cliente Teste",
          email: `${role}@prime.com`,
          loginMethod: "manus",
          role,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe("auth.me", () => {
  it("returns null for unauthenticated user", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user for authenticated user", async () => {
    const caller = appRouter.createCaller(makeCtx("user"));
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.role).toBe("user");
  });
});

// ─── Categories ───────────────────────────────────────────────────────────────

describe("categories.list", () => {
  it("returns a list of categories (public access)", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    const result = await caller.categories.list({ onlyActive: true });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("categories.create", () => {
  it("throws FORBIDDEN for non-admin users", async () => {
    const caller = appRouter.createCaller(makeCtx("user"));
    await expect(
      caller.categories.create({ name: "Test", slug: "test" })
    ).rejects.toThrow("Acesso restrito ao administrador.");
  });
});

// ─── Pizzas ───────────────────────────────────────────────────────────────────

describe("pizzas.list", () => {
  it("returns a list of pizzas (public access)", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    const result = await caller.pizzas.list({ onlyActive: true });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("pizzas.featured", () => {
  it("returns featured pizzas (public access)", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    const result = await caller.pizzas.featured();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("pizzas.create", () => {
  it("throws FORBIDDEN for non-admin users", async () => {
    const caller = appRouter.createCaller(makeCtx("user"));
    await expect(
      caller.pizzas.create({
        categoryId: 1,
        name: "Test Pizza",
        prices: { unico: 25 },
        availableSizes: ["unico"],
        sortOrder: 0,
      })
    ).rejects.toThrow("Acesso restrito ao administrador.");
  });
});

// ─── Orders ───────────────────────────────────────────────────────────────────

describe("orders.byToken", () => {
  it("throws NOT_FOUND for invalid token", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(
      caller.orders.byToken({ token: "invalid-token-xyz-123" })
    ).rejects.toThrow("Pedido não encontrado.");
  });
});

describe("orders.all (admin)", () => {
  it("throws FORBIDDEN for non-admin users", async () => {
    const caller = appRouter.createCaller(makeCtx("user"));
    await expect(caller.orders.all()).rejects.toThrow("Acesso restrito ao administrador.");
  });

  it("throws UNAUTHORIZED for unauthenticated users", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(caller.orders.all()).rejects.toThrow();
  });
});

describe("orders.updateStatus (admin)", () => {
  it("throws FORBIDDEN for non-admin users", async () => {
    const caller = appRouter.createCaller(makeCtx("user"));
    await expect(
      caller.orders.updateStatus({ id: 1, status: "preparing" })
    ).rejects.toThrow("Acesso restrito ao administrador.");
  });
});
