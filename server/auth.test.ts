import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(overrides?: Partial<AuthenticatedUser>): { ctx: TrpcContext; clearedCookies: Array<{ name: string; options: Record<string, unknown> }> } {
  const clearedCookies: Array<{ name: string; options: Record<string, unknown> }> = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    username: "testuser",
    email: "test@fluxa.local",
    name: "Test User",
    phone: null,
    phoneVerified: false,
    loginMethod: "manus",
    role: "user",
    kycStatus: "none",
    accountFrozen: false,
    dailyTransactionLimit: "1000000",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

describe("auth procedures", () => {
  it("returns current user with me query", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const user = await caller.auth.me();

    expect(user).toBeDefined();
    expect(user?.id).toBe(1);
    expect(user?.username).toBe("testuser");
    expect(user?.email).toBe("test@fluxa.local");
  });

  it("clears session cookie on logout", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: -1,
      secure: true,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });
  });

  it("requires authentication for protected procedures", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: {
        protocol: "https",
        headers: {},
      } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };

    const caller = appRouter.createCaller(ctx);

    try {
      await caller.auth.getWallets();
      expect.fail("Should have thrown unauthorized error");
    } catch (error: any) {
      expect(error.code).toBe("UNAUTHORIZED");
    }
  });

  it("requires admin role for admin procedures", async () => {
    const { ctx } = createAuthContext({ role: "user" });
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.admin.getUsers({ limit: 50, offset: 0 });
      expect.fail("Should have thrown forbidden error");
    } catch (error: any) {
      expect(error.code).toBe("FORBIDDEN");
    }
  });

  it("allows admin to list users", async () => {
    const { ctx } = createAuthContext({ role: "admin" });
    const caller = appRouter.createCaller(ctx);

    // This will fail in test environment without a real database,
    // but we're testing that the procedure is accessible to admins
    try {
      await caller.admin.getUsers({ limit: 50, offset: 0 });
    } catch (error: any) {
      // Expected to fail due to no database, but not due to auth
      expect(error.code).not.toBe("FORBIDDEN");
    }
  });
});
