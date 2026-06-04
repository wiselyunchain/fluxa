import { boolean, index, integer, numeric, pgEnum, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["user", "admin"]);
export const kycStatus = pgEnum("kyc_status", ["none", "pending", "verified", "rejected"]);
export const transactionType = pgEnum("transaction_type", ["deposit", "withdrawal", "swap"]);
export const transactionStatus = pgEnum("transaction_status", ["pending", "confirmed", "failed", "cancelled"]);
export const fiatRequestType = pgEnum("fiat_request_type", ["deposit", "withdrawal"]);
export const fiatRequestStatus = pgEnum("fiat_request_status", ["pending", "processing", "confirmed", "failed"]);
export const riskFlagType = pgEnum("risk_flag_type", ["suspicious_activity", "high_volume", "unusual_pattern", "kyc_mismatch", "manual_review"]);
export const riskSeverity = pgEnum("risk_severity", ["low", "medium", "high", "critical"]);
export const umbraUtxoType = pgEnum("umbra_utxo_type", ["self_claimable", "receiver_claimable"]);

/**
 * Core user table backing auth flow.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: text("name"),
  phone: varchar("phone", { length: 20 }),
  phoneVerified: boolean("phoneVerified").default(false).notNull(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRole("role").default("user").notNull(),
  kycStatus: kycStatus("kycStatus").default("none").notNull(),
  accountFrozen: boolean("accountFrozen").default(false).notNull(),
  dailyTransactionLimit: numeric("dailyTransactionLimit", { precision: 20, scale: 2 }).default("1000000"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, (table) => [index("idx_username").on(table.username)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Solana wallets for users (single wallet per user)
export const solanaWallets = pgTable("solana_wallets", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  mainAddress: varchar("mainAddress", { length: 88 }).notNull().unique(),
  mainKeypair: text("mainKeypair").notNull(),
  stealthKey: text("stealthKey").notNull(),
  claimKey: text("claimKey").notNull(),
  balance: numeric("balance", { precision: 20, scale: 8 }).default("0").notNull(),
  lastBalanceUpdate: timestamp("lastBalanceUpdate").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type SolanaWallet = typeof solanaWallets.$inferSelect;
export type InsertSolanaWallet = typeof solanaWallets.$inferInsert;

// Private transactions (user-only visibility)
export const userTransactions = pgTable("user_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  type: transactionType("type").notNull(),
  status: transactionStatus("status").default("pending").notNull(),
  fromChain: varchar("fromChain", { length: 64 }),
  toChain: varchar("toChain", { length: 64 }),
  fromToken: varchar("fromToken", { length: 64 }),
  toToken: varchar("toToken", { length: 64 }),
  fromAmount: numeric("fromAmount", { precision: 20, scale: 8 }).notNull(),
  toAmount: numeric("toAmount", { precision: 20, scale: 8 }),
  nearIntentId: varchar("nearIntentId", { length: 255 }),
  pajCashReference: varchar("pajCashReference", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  confirmedAt: timestamp("confirmedAt"),
}, (table) => [index("idx_userId").on(table.userId), index("idx_status").on(table.status)]);

export type UserTransaction = typeof userTransactions.$inferSelect;
export type InsertUserTransaction = typeof userTransactions.$inferInsert;

// Solana stealth addresses (for privacy via Umbra & Magic Block)
export const solanaStealthAddresses = pgTable("solana_stealth_addresses", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  stealthAddress: varchar("stealthAddress", { length: 88 }).notNull(),
  ephemeralKeypair: text("ephemeralKeypair").notNull(),
  transactionId: integer("transactionId"),
  claimed: boolean("claimed").default(false).notNull(),
  claimProof: text("claimProof"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  claimedAt: timestamp("claimedAt"),
}, (table) => [
  index("idx_stealth_userId_claimed").on(table.userId, table.claimed),
  index("idx_stealth_transactionId").on(table.transactionId),
]);

export type SolanaStealthAddress = typeof solanaStealthAddresses.$inferSelect;
export type InsertSolanaStealthAddress = typeof solanaStealthAddresses.$inferInsert;

// On-ramp/Off-ramp requests via Paj Cash
export const fiatRequests = pgTable("fiat_requests", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  type: fiatRequestType("type").notNull(),
  amount: numeric("amount", { precision: 20, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("NGN").notNull(),
  pajCashReference: varchar("pajCashReference", { length: 255 }).unique(),
  status: fiatRequestStatus("status").default("pending").notNull(),
  stealthAddressId: integer("stealthAddressId"),
  bankAccount: text("bankAccount"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  confirmedAt: timestamp("confirmedAt"),
}, (table) => [index("idx_userId_type").on(table.userId, table.type)]);

export type FiatRequest = typeof fiatRequests.$inferSelect;
export type InsertFiatRequest = typeof fiatRequests.$inferInsert;

// Risk management and fraud detection
export const riskFlags = pgTable("riskFlags", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  flagType: riskFlagType("flagType").notNull(),
  severity: riskSeverity("severity").default("medium").notNull(),
  description: text("description"),
  resolved: boolean("resolved").default(false).notNull(),
  resolvedBy: integer("resolvedBy"),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("idx_userId_resolved").on(table.userId, table.resolved)]);

export type RiskFlag = typeof riskFlags.$inferSelect;
export type InsertRiskFlag = typeof riskFlags.$inferInsert;

// Admin audit logs
export const auditLogs = pgTable("auditLogs", {
  id: serial("id").primaryKey(),
  adminId: integer("adminId").notNull(),
  action: varchar("action", { length: 255 }).notNull(),
  targetUserId: integer("targetUserId"),
  details: text("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("idx_adminId").on(table.adminId), index("idx_targetUserId").on(table.targetUserId)]);

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// Encrypted platform-level Paj Cash session token (single row, refreshed via admin OTP flow)
export const pajCashSessions = pgTable("paj_cash_sessions", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  encryptedToken: text("encryptedToken").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type PajCashSession = typeof pajCashSessions.$inferSelect;
export type InsertPajCashSession = typeof pajCashSessions.$inferInsert;

// Umbra encrypted balance bookkeeping (last-known shielded amount per user+mint)
export const umbraEncryptedBalances = pgTable("umbra_encrypted_balances", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  tokenMint: varchar("tokenMint", { length: 64 }).notNull(),
  lastKnownAmount: numeric("lastKnownAmount", { precision: 20, scale: 8 }).default("0").notNull(),
  lastShieldedAt: timestamp("lastShieldedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [index("idx_userId_token").on(table.userId, table.tokenMint)]);

export type UmbraEncryptedBalance = typeof umbraEncryptedBalances.$inferSelect;
export type InsertUmbraEncryptedBalance = typeof umbraEncryptedBalances.$inferInsert;

// Umbra UTXO commitments (populated by later PRs that wire the claim path)
export const umbraUtxos = pgTable("umbra_utxos", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  commitment: varchar("commitment", { length: 88 }).notNull().unique(),
  tokenMint: varchar("tokenMint", { length: 64 }).notNull(),
  amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
  type: umbraUtxoType("type").notNull(),
  claimed: boolean("claimed").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  claimedAt: timestamp("claimedAt"),
}, (table) => [index("idx_utxo_userId_claimed").on(table.userId, table.claimed)]);

export type UmbraUtxo = typeof umbraUtxos.$inferSelect;
export type InsertUmbraUtxo = typeof umbraUtxos.$inferInsert;
