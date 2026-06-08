import { eq, and, desc, gt, isNotNull } from "drizzle-orm";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  InsertUser,
  users,
  solanaWallets,
  userTransactions,
  fiatRequests,
  riskFlags,
  pajCashSessions,
  umbraEncryptedBalances,
  umbraUtxos,
  SolanaWallet,
  UserTransaction,
  FiatRequest,
  RiskFlag,
  PajCashSession,
  UmbraEncryptedBalance,
  UmbraUtxo,
  InsertFiatRequest,
  InsertUserTransaction,
  InsertPajCashSession,
  InsertUmbraUtxo,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _pool: Pool | null = null;
let _db: NodePgDatabase | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _pool = new Pool({ connectionString: process.env.DATABASE_URL });
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _pool = null;
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const defaultUsername = `user_${user.openId.substring(0, 8)}`;
    const defaultEmail = `${user.openId}@fluxa.local`;

    const values: InsertUser = {
      openId: user.openId,
      username: user.username || defaultUsername,
      email: user.email || defaultEmail,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "phone", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserWallets(userId: number): Promise<SolanaWallet[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(solanaWallets).where(eq(solanaWallets.userId, userId));
}

export async function getWalletByAddress(address: string): Promise<SolanaWallet | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(solanaWallets).where(eq(solanaWallets.mainAddress, address)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserTransactions(userId: number, limit: number = 50): Promise<UserTransaction[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(userTransactions).where(eq(userTransactions.userId, userId)).limit(limit);
}

export async function getUserFiatRequests(userId: number): Promise<FiatRequest[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(fiatRequests).where(eq(fiatRequests.userId, userId));
}

export async function getUserRiskFlags(userId: number): Promise<RiskFlag[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(riskFlags).where(and(eq(riskFlags.userId, userId), eq(riskFlags.resolved, false)));
}

// ---------- Paj Cash session (single platform-level row, latest non-expired) ----------

export async function getActivePajCashSession(): Promise<PajCashSession | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(pajCashSessions)
    .where(gt(pajCashSessions.expiresAt, new Date()))
    .orderBy(desc(pajCashSessions.expiresAt))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertPajCashSession(input: {
  email: string;
  encryptedToken: string;
  expiresAt: Date;
}): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert paj-cash session: database not available");
    return;
  }

  const existing = await db.select().from(pajCashSessions).limit(1);
  const values: InsertPajCashSession = {
    email: input.email,
    encryptedToken: input.encryptedToken,
    expiresAt: input.expiresAt,
  };

  if (existing.length === 0) {
    await db.insert(pajCashSessions).values(values);
    return;
  }

  await db
    .update(pajCashSessions)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(pajCashSessions.id, existing[0].id));
}

// ---------- Umbra encrypted balance bookkeeping ----------

export async function upsertUmbraEncryptedBalance(input: {
  userId: number;
  tokenMint: string;
  amountDelta: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert umbra balance: database not available");
    return;
  }

  const existing = await db
    .select()
    .from(umbraEncryptedBalances)
    .where(
      and(
        eq(umbraEncryptedBalances.userId, input.userId),
        eq(umbraEncryptedBalances.tokenMint, input.tokenMint),
      ),
    )
    .limit(1);

  const now = new Date();
  if (existing.length === 0) {
    await db.insert(umbraEncryptedBalances).values({
      userId: input.userId,
      tokenMint: input.tokenMint,
      lastKnownAmount: input.amountDelta,
      lastShieldedAt: now,
    });
    return;
  }

  const prev = Number(existing[0].lastKnownAmount ?? "0");
  const next = (prev + Number(input.amountDelta)).toString();
  await db
    .update(umbraEncryptedBalances)
    .set({ lastKnownAmount: next, lastShieldedAt: now, updatedAt: now })
    .where(eq(umbraEncryptedBalances.id, existing[0].id));
}

export async function getUmbraEncryptedBalance(
  userId: number,
  tokenMint: string,
): Promise<UmbraEncryptedBalance | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(umbraEncryptedBalances)
    .where(
      and(
        eq(umbraEncryptedBalances.userId, userId),
        eq(umbraEncryptedBalances.tokenMint, tokenMint),
      ),
    )
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ---------- Fiat requests (deposits/withdrawals via Paj Cash) ----------

export async function insertFiatRequest(input: InsertFiatRequest): Promise<FiatRequest> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  const inserted = await db.insert(fiatRequests).values(input).returning();
  return inserted[0];
}

export async function getFiatRequestByReference(
  pajCashReference: string,
): Promise<FiatRequest | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(fiatRequests)
    .where(eq(fiatRequests.pajCashReference, pajCashReference))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateFiatRequestStatus(
  pajCashReference: string,
  status: FiatRequest["status"],
  confirmedAt?: Date,
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(fiatRequests)
    .set({ status, ...(confirmedAt ? { confirmedAt } : {}) })
    .where(eq(fiatRequests.pajCashReference, pajCashReference));
}

// ---------- User transactions (private ledger) ----------

export async function insertUserTransaction(
  input: InsertUserTransaction,
): Promise<UserTransaction> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  const inserted = await db.insert(userTransactions).values(input).returning();
  return inserted[0];
}

export async function getPendingSwapTransactions(limit: number = 100): Promise<UserTransaction[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(userTransactions)
    .where(
      and(
        eq(userTransactions.type, "swap"),
        eq(userTransactions.status, "pending"),
        isNotNull(userTransactions.nearIntentDepositAddress),
      ),
    )
    .orderBy(userTransactions.createdAt)
    .limit(limit);
}

// ---------- Umbra UTXOs (discovered by scanner, claimed by user later) ----------

export async function insertUmbraUtxoIfNew(input: InsertUmbraUtxo): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.insert(umbraUtxos).values(input).onConflictDoNothing({ target: umbraUtxos.commitment });
}

export async function getClaimableUmbraUtxos(userId: number): Promise<UmbraUtxo[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(umbraUtxos)
    .where(and(eq(umbraUtxos.userId, userId), eq(umbraUtxos.claimed, false)))
    .orderBy(desc(umbraUtxos.createdAt));
}

export async function markUmbraUtxoClaimed(commitment: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(umbraUtxos)
    .set({ claimed: true, claimedAt: new Date() })
    .where(eq(umbraUtxos.commitment, commitment));
}

export async function updateUserTransactionStatus(input: {
  id: number;
  status: UserTransaction["status"];
  confirmedAt?: Date;
  toAmount?: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const patch: Partial<UserTransaction> = { status: input.status };
  if (input.confirmedAt !== undefined) patch.confirmedAt = input.confirmedAt;
  if (input.toAmount !== undefined) patch.toAmount = input.toAmount;

  await db.update(userTransactions).set(patch).where(eq(userTransactions.id, input.id));
}
