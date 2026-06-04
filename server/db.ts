import { eq, and } from "drizzle-orm";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { InsertUser, users, solanaWallets, userTransactions, fiatRequests, riskFlags, SolanaWallet, UserTransaction, FiatRequest, RiskFlag } from "../drizzle/schema";
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
