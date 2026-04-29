import { decimal, int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, index } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
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

// Multi-chain wallet support
export const wallets = mysqlTable("wallets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  chain: mysqlEnum("chain", ["solana", "base", "bsc", "ton", "avalanche"]).notNull(),
  address: varchar("address", { length: 255 }).notNull().unique(),
  publicKey: text("publicKey"),
  encryptedPrivateKey: text("encryptedPrivateKey"),
  balance: decimal("balance", { precision: 20, scale: 8 }).default("0").notNull(),
  lastBalanceUpdate: timestamp("lastBalanceUpdate").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("idx_userId_chain").on(table.userId, table.chain)]);

export type Wallet = typeof wallets.$inferSelect;
export type InsertWallet = typeof wallets.$inferInsert;

// Token holdings per wallet
export const tokenBalances = mysqlTable("tokenBalances", {
  id: int("id").autoincrement().primaryKey(),
  walletId: int("walletId").notNull(),
  token: mysqlEnum("token", ["usdt", "usdc", "usde", "sol", "eth", "bnb", "ton", "avax"]).notNull(),
  balance: decimal("balance", { precision: 20, scale: 8 }).default("0").notNull(),
  usdValue: decimal("usdValue", { precision: 20, scale: 2 }).default("0").notNull(),
  lastUpdate: timestamp("lastUpdate").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("idx_walletId_token").on(table.walletId, table.token)]);

export type TokenBalance = typeof tokenBalances.$inferSelect;
export type InsertTokenBalance = typeof tokenBalances.$inferInsert;

// Private transactions (user-only visibility)
export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["deposit", "withdrawal", "swap", "onramp", "offramp"]).notNull(),
  status: mysqlEnum("status", ["pending", "completed", "failed", "cancelled"]).default("pending").notNull(),
  fromChain: varchar("fromChain", { length: 64 }),
  toChain: varchar("toChain", { length: 64 }),
  fromToken: varchar("fromToken", { length: 64 }),
  toToken: varchar("toToken", { length: 64 }),
  fromAmount: decimal("fromAmount", { precision: 20, scale: 8 }).notNull(),
  toAmount: decimal("toAmount", { precision: 20, scale: 8 }),
  fee: decimal("fee", { precision: 20, scale: 8 }).default("0"),
  slippage: decimal("slippage", { precision: 5, scale: 2 }).default("0"),
  txHash: varchar("txHash", { length: 255 }),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
}, (table) => [index("idx_userId").on(table.userId), index("idx_status").on(table.status)]);

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

// On-ramp/Off-ramp requests
export const fiatRequests = mysqlTable("fiatRequests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["onramp", "offramp"]).notNull(),
  amount: decimal("amount", { precision: 20, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("NGN").notNull(),
  cryptoAmount: decimal("cryptoAmount", { precision: 20, scale: 8 }),
  cryptoToken: varchar("cryptoToken", { length: 64 }),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  paymentProvider: varchar("paymentProvider", { length: 64 }),
  paymentReference: varchar("paymentReference", { length: 255 }),
  bankAccount: text("bankAccount"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
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

// Solana wallets for users (Umbra integration)
export const solanaWallets = mysqlTable("solana_wallets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  publicKey: varchar("publicKey", { length: 88 }).notNull().unique(),
  encryptedPrivateKey: text("encryptedPrivateKey").notNull(),
  x25519Key: text("x25519Key").notNull(), // for Umbra
  umbraRegistered: boolean("umbraRegistered").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SolanaWallet = typeof solanaWallets.$inferSelect;
export type InsertSolanaWallet = typeof solanaWallets.$inferInsert;

// Umbra encrypted balances
export const umbraEncryptedBalances = mysqlTable("umbra_encrypted_balances", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  token: varchar("token", { length: 50 }).notNull(), // 'USDT', 'USDC', etc
  encryptedAmount: text("encryptedAmount"), // encrypted balance reference
  lastSyncedAt: timestamp("lastSyncedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("idx_userId_token").on(table.userId, table.token)]);

export type UmbraEncryptedBalance = typeof umbraEncryptedBalances.$inferSelect;
export type InsertUmbraEncryptedBalance = typeof umbraEncryptedBalances.$inferInsert;

// Umbra UTXO mixer tracking (for anonymous transfers)
export const umbraUtxos = mysqlTable("umbra_utxos", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  transactionId: int("transactionId"),
  token: varchar("token", { length: 50 }).notNull(),
  amount: decimal("amount", { precision: 20, scale: 8 }).notNull(),
  commitment: varchar("commitment", { length: 255 }).notNull(), // Merkle tree commitment
  recipient: varchar("recipient", { length: 88 }).notNull(), // recipient's Solana address
  claimed: boolean("claimed").default(false).notNull(),
  claimProof: text("claimProof"), // ZK proof
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  claimedAt: timestamp("claimedAt"),
}, (table) => [index("idx_userId_claimed").on(table.userId, table.claimed)]);

export type UmbraUtxo = typeof umbraUtxos.$inferSelect;
export type InsertUmbraUtxo = typeof umbraUtxos.$inferInsert;

// Paj Cash transactions (NGN ↔ USDT settlement)
export const pajCashTransactions = mysqlTable("paj_cash_transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["deposit", "withdrawal"]).notNull(),
  direction: mysqlEnum("direction", ["naira_to_usdt", "usdt_to_naira"]).notNull(),
  nairaAmount: decimal("nairaAmount", { precision: 15, scale: 2 }),
  usdtAmount: decimal("usdtAmount", { precision: 20, scale: 8 }),
  userBankAccount: varchar("userBankAccount", { length: 255 }),
  pajCashReference: varchar("pajCashReference", { length: 255 }).unique(),
  status: mysqlEnum("status", ["pending", "confirmed", "failed"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  confirmedAt: timestamp("confirmedAt"),
}, (table) => [index("idx_userId_type").on(table.userId, table.type)]);

export type PajCashTransaction = typeof pajCashTransactions.$inferSelect;
export type InsertPajCashTransaction = typeof pajCashTransactions.$inferInsert;