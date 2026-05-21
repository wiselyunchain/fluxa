import { decimal, int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, index } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: text("name"),
  phone: varchar("phone", { length: 20 }),
  phoneVerified: boolean("phoneVerified").default(false).notNull(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  kycStatus: mysqlEnum("kycStatus", ["none", "pending", "verified", "rejected"]).default("none").notNull(),
  accountFrozen: boolean("accountFrozen").default(false).notNull(),
  dailyTransactionLimit: decimal("dailyTransactionLimit", { precision: 20, scale: 2 }).default("1000000"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, (table) => [index("idx_username").on(table.username)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Solana wallets for users (Single wallet per user)
export const solanaWallets = mysqlTable("solana_wallets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  mainAddress: varchar("mainAddress", { length: 88 }).notNull().unique(),
  mainKeypair: text("mainKeypair").notNull(), // encrypted
  stealthKey: text("stealthKey").notNull(), // encrypted
  claimKey: text("claimKey").notNull(), // encrypted
  balance: decimal("balance", { precision: 20, scale: 8 }).default("0").notNull(),
  lastBalanceUpdate: timestamp("lastBalanceUpdate").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SolanaWallet = typeof solanaWallets.$inferSelect;
export type InsertSolanaWallet = typeof solanaWallets.$inferInsert;

// Private transactions (user-only visibility)
export const userTransactions = mysqlTable("user_transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["deposit", "withdrawal", "swap"]).notNull(),
  status: mysqlEnum("status", ["pending", "confirmed", "failed", "cancelled"]).default("pending").notNull(),
  fromChain: varchar("fromChain", { length: 64 }),
  toChain: varchar("toChain", { length: 64 }),
  fromToken: varchar("fromToken", { length: 64 }),
  toToken: varchar("toToken", { length: 64 }),
  fromAmount: decimal("fromAmount", { precision: 20, scale: 8 }).notNull(),
  toAmount: decimal("toAmount", { precision: 20, scale: 8 }),
  nearIntentId: varchar("nearIntentId", { length: 255 }), // NEAR Intent transaction ID
  pajCashReference: varchar("pajCashReference", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  confirmedAt: timestamp("confirmedAt"),
}, (table) => [index("idx_userId").on(table.userId), index("idx_status").on(table.status)]);

export type UserTransaction = typeof userTransactions.$inferSelect;
export type InsertUserTransaction = typeof userTransactions.$inferInsert;

// Solana stealth addresses (for privacy via Umbra & Magic Block)
export const solanaStealthAddresses = mysqlTable("solana_stealth_addresses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  stealthAddress: varchar("stealthAddress", { length: 88 }).notNull(),
  ephemeralKeypair: text("ephemeralKeypair").notNull(), // encrypted
  transactionId: int("transactionId"),
  claimed: boolean("claimed").default(false).notNull(),
  claimProof: text("claimProof"), // ZK proof
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  claimedAt: timestamp("claimedAt"),
}, (table) => [
  index("idx_userId_claimed").on(table.userId, table.claimed),
  index("idx_transactionId").on(table.transactionId)
]);

export type SolanaStealthAddress = typeof solanaStealthAddresses.$inferSelect;
export type InsertSolanaStealthAddress = typeof solanaStealthAddresses.$inferInsert;

// On-ramp/Off-ramp requests via Paj Cash
export const fiatRequests = mysqlTable("fiat_requests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["deposit", "withdrawal"]).notNull(),
  amount: decimal("amount", { precision: 20, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("NGN").notNull(),
  pajCashReference: varchar("pajCashReference", { length: 255 }).unique(),
  status: mysqlEnum("status", ["pending", "processing", "confirmed", "failed"]).default("pending").notNull(),
  stealthAddressId: int("stealthAddressId"), // For deposits (Solana)
  bankAccount: text("bankAccount"), // For withdrawals
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  confirmedAt: timestamp("confirmedAt"),
}, (table) => [index("idx_userId_type").on(table.userId, table.type)]);

export type FiatRequest = typeof fiatRequests.$inferSelect;
export type InsertFiatRequest = typeof fiatRequests.$inferInsert;

// Risk management and fraud detection
export const riskFlags = mysqlTable("riskFlags", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  flagType: mysqlEnum("flagType", ["suspicious_activity", "high_volume", "unusual_pattern", "kyc_mismatch", "manual_review"]).notNull(),
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  description: text("description"),
  resolved: boolean("resolved").default(false).notNull(),
  resolvedBy: int("resolvedBy"),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("idx_userId_resolved").on(table.userId, table.resolved)]);

export type RiskFlag = typeof riskFlags.$inferSelect;
export type InsertRiskFlag = typeof riskFlags.$inferInsert;

// Admin audit logs
export const auditLogs = mysqlTable("auditLogs", {
  id: int("id").autoincrement().primaryKey(),
  adminId: int("adminId").notNull(),
  action: varchar("action", { length: 255 }).notNull(),
  targetUserId: int("targetUserId"),
  details: text("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("idx_adminId").on(table.adminId), index("idx_targetUserId").on(table.targetUserId)]);

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;