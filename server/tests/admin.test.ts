import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TrpcContext } from "../_core/context";

vi.hoisted(() => {
  process.env.WALLET_ENCRYPTION_KEY = "0".repeat(64);
});

type SelectResult = unknown[];

interface FakeDbCaptures {
  inserts: Array<{ tableName: string; values: unknown }>;
  updates: Array<{ tableName: string; set: unknown }>;
}

function inferTableName(table: unknown): string {
  const sym = Object.getOwnPropertySymbols(table as object).find(
    (s) => s.description === "drizzle:Name",
  );
  if (sym) return String((table as Record<symbol, unknown>)[sym]);
  return "unknown";
}

function createFakeDb(selectResults: SelectResult[] = []) {
  const captures: FakeDbCaptures = { inserts: [], updates: [] };
  let selectIndex = 0;

  const makeSelectChain = (): any => {
    const chain: any = {
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      offset: () => chain,
      then: (resolve: (value: unknown) => void) => {
        const value = selectResults[selectIndex] ?? [];
        selectIndex += 1;
        resolve(value);
      },
    };
    return chain;
  };

  const db = {
    select: (_cols?: unknown) => makeSelectChain(),
    insert: (table: unknown) => ({
      values: async (vals: unknown) => {
        captures.inserts.push({ tableName: inferTableName(table), values: vals });
      },
    }),
    update: (table: unknown) => ({
      set: (set: unknown) => ({
        where: async (_where: unknown) => {
          captures.updates.push({ tableName: inferTableName(table), set });
        },
      }),
    }),
  };

  return { db, captures };
}

const dbModule = vi.hoisted(() => ({
  getDbImpl: vi.fn(async (): Promise<unknown> => null),
}));

vi.mock("../db", () => ({
  getDb: () => dbModule.getDbImpl(),
  // The webhook + flows code may import other helpers; provide harmless stubs
  // so any incidental import path resolves.
  getUserByOpenId: vi.fn(async () => undefined),
  getUserWallets: vi.fn(async () => []),
  insertUserTransaction: vi.fn(async () => ({})),
  insertFiatRequest: vi.fn(async () => ({})),
  getFiatRequestByReference: vi.fn(async () => undefined),
  updateFiatRequestStatus: vi.fn(async () => {}),
  upsertUmbraEncryptedBalance: vi.fn(async () => {}),
  upsertPajCashSession: vi.fn(async () => {}),
  getActivePajCashSession: vi.fn(async () => undefined),
  getUserTransactions: vi.fn(async () => []),
  getUserFiatRequests: vi.fn(async () => []),
  getUserRiskFlags: vi.fn(async () => []),
  getWalletByAddress: vi.fn(async () => undefined),
  upsertUser: vi.fn(async () => {}),
}));

import { appRouter } from "../routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(role: "user" | "admin" = "user", overrides?: Partial<AuthenticatedUser>): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    username: "testuser",
    email: "test@fluxa.local",
    name: "Test User",
    phone: null,
    phoneVerified: false,
    loginMethod: "manus",
    role,
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
    res: {} as TrpcContext["res"],
  };

  return ctx;
}

beforeEach(() => {
  dbModule.getDbImpl.mockReset();
  dbModule.getDbImpl.mockResolvedValue(null);
});

describe("admin authorization", () => {
  it("requires admin role for admin operations", async () => {
    const caller = appRouter.createCaller(createAuthContext("user"));
    await expect(caller.admin.getUsers({ limit: 50 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows admin to get users list (no DB → empty array)", async () => {
    const caller = appRouter.createCaller(createAuthContext("admin"));
    await expect(caller.admin.getUsers({ limit: 50 })).resolves.toEqual([]);
  });

  it("prevents non-admin from freezing accounts", async () => {
    const caller = appRouter.createCaller(createAuthContext("user"));
    await expect(
      caller.admin.toggleAccountFreeze({ userId: 2, frozen: true }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("prevents non-admin from reading risk alerts", async () => {
    const caller = appRouter.createCaller(createAuthContext("user"));
    await expect(caller.admin.getRiskAlerts({ limit: 50, offset: 0 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("prevents non-admin from flagging transactions", async () => {
    const caller = appRouter.createCaller(createAuthContext("user"));
    await expect(
      caller.admin.flagTransaction({ transactionId: 1, reason: "x", severity: "low" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("admin no-DB safe defaults", () => {
  it("getDashboardStats returns zeroed shape", async () => {
    const caller = appRouter.createCaller(createAuthContext("admin"));
    const stats = await caller.admin.getDashboardStats();
    expect(stats).toEqual({
      totalUsers: 0,
      activeUsers: 0,
      totalTransactions: 0,
      totalVolume: "0",
      pendingTransactions: 0,
      flaggedTransactions: 0,
    });
  });

  it("getRiskAlerts returns empty array", async () => {
    const caller = appRouter.createCaller(createAuthContext("admin"));
    await expect(caller.admin.getRiskAlerts({ limit: 50, offset: 0 })).resolves.toEqual([]);
  });

  it("getTransactions returns empty array", async () => {
    const caller = appRouter.createCaller(createAuthContext("admin"));
    await expect(caller.admin.getTransactions({ limit: 50, offset: 0 })).resolves.toEqual([]);
  });
});

describe("admin input validation", () => {
  it("getTransactions rejects status outside the schema enum (e.g. 'completed')", async () => {
    const caller = appRouter.createCaller(createAuthContext("admin"));
    await expect(
      caller.admin.getTransactions({ limit: 10, offset: 0, status: "completed" as any }),
    ).rejects.toBeDefined();
  });

  it("getTransactions accepts 'confirmed' status", async () => {
    const caller = appRouter.createCaller(createAuthContext("admin"));
    await expect(
      caller.admin.getTransactions({ limit: 10, offset: 0, status: "confirmed" }),
    ).resolves.toEqual([]);
  });
});

describe("admin persistence behavior (with mock DB)", () => {
  it("toggleAccountFreeze writes to users and auditLogs", async () => {
    const { db, captures } = createFakeDb();
    dbModule.getDbImpl.mockResolvedValueOnce(db);

    const caller = appRouter.createCaller(createAuthContext("admin"));
    const result = await caller.admin.toggleAccountFreeze({
      userId: 42,
      frozen: true,
      reason: "Suspicious activity",
    });

    expect(result.success).toBe(true);
    expect(captures.updates).toHaveLength(1);
    expect(captures.updates[0].tableName).toBe("users");
    expect(captures.updates[0].set).toMatchObject({ accountFrozen: true });

    expect(captures.inserts).toHaveLength(1);
    expect(captures.inserts[0].tableName).toBe("auditLogs");
    expect(captures.inserts[0].values).toMatchObject({
      adminId: 1,
      action: "freeze_account",
      targetUserId: 42,
      details: "Suspicious activity",
    });
  });

  it("updateKycStatus writes to users and auditLogs with JSON details", async () => {
    const { db, captures } = createFakeDb();
    dbModule.getDbImpl.mockResolvedValueOnce(db);

    const caller = appRouter.createCaller(createAuthContext("admin"));
    await caller.admin.updateKycStatus({
      userId: 99,
      status: "verified",
      notes: "Passed manual review",
    });

    expect(captures.updates[0].tableName).toBe("users");
    expect(captures.updates[0].set).toMatchObject({ kycStatus: "verified" });

    expect(captures.inserts[0].tableName).toBe("auditLogs");
    const details = JSON.parse((captures.inserts[0].values as { details: string }).details);
    expect(details).toEqual({ status: "verified", notes: "Passed manual review" });
  });

  it("flagTransaction looks up the txn, inserts into riskFlags and auditLogs", async () => {
    const { db, captures } = createFakeDb([[{ id: 5, userId: 77 }]]);
    dbModule.getDbImpl.mockResolvedValueOnce(db);

    const caller = appRouter.createCaller(createAuthContext("admin"));
    const result = await caller.admin.flagTransaction({
      transactionId: 5,
      reason: "Unusual size",
      severity: "high",
    });

    expect(result.success).toBe(true);
    expect(captures.inserts).toHaveLength(2);

    const riskFlag = captures.inserts.find((i) => i.tableName === "riskFlags");
    expect(riskFlag?.values).toMatchObject({
      userId: 77,
      flagType: "manual_review",
      severity: "high",
    });
    expect((riskFlag?.values as { description: string }).description).toContain("Transaction #5");

    const audit = captures.inserts.find((i) => i.tableName === "auditLogs");
    expect(audit?.values).toMatchObject({
      adminId: 1,
      action: "flag_transaction",
      targetUserId: 77,
    });
  });

  it("flagTransaction throws NOT_FOUND when the transaction does not exist", async () => {
    const { db } = createFakeDb([[]]);
    dbModule.getDbImpl.mockResolvedValueOnce(db);

    const caller = appRouter.createCaller(createAuthContext("admin"));
    await expect(
      caller.admin.flagTransaction({ transactionId: 999, reason: "x", severity: "low" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("getDashboardStats aggregates real counts when DB is present", async () => {
    const { db } = createFakeDb([
      [{ value: 12 }],     // totalUsers
      [{ value: 4 }],      // activeUsers
      [{ value: 30 }],     // totalTransactions
      [{ value: "5500" }], // totalVolume
      [{ value: 2 }],      // pendingTransactions
      [{ value: 1 }],      // flaggedTransactions
    ]);
    dbModule.getDbImpl.mockResolvedValueOnce(db);

    const caller = appRouter.createCaller(createAuthContext("admin"));
    const stats = await caller.admin.getDashboardStats();

    expect(stats).toEqual({
      totalUsers: 12,
      activeUsers: 4,
      totalTransactions: 30,
      totalVolume: "5500",
      pendingTransactions: 2,
      flaggedTransactions: 1,
    });
  });
});
