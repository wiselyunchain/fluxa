CREATE TYPE "public"."fiat_request_status" AS ENUM('pending', 'processing', 'confirmed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."fiat_request_type" AS ENUM('deposit', 'withdrawal');--> statement-breakpoint
CREATE TYPE "public"."kyc_status" AS ENUM('none', 'pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."risk_flag_type" AS ENUM('suspicious_activity', 'high_volume', 'unusual_pattern', 'kyc_mismatch', 'manual_review');--> statement-breakpoint
CREATE TYPE "public"."risk_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('pending', 'confirmed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('deposit', 'withdrawal', 'swap');--> statement-breakpoint
CREATE TYPE "public"."umbra_utxo_type" AS ENUM('self_claimable', 'receiver_claimable');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "auditLogs" (
	"id" serial PRIMARY KEY NOT NULL,
	"adminId" integer NOT NULL,
	"action" varchar(255) NOT NULL,
	"targetUserId" integer,
	"details" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fiat_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"type" "fiat_request_type" NOT NULL,
	"amount" numeric(20, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"pajCashReference" varchar(255),
	"status" "fiat_request_status" DEFAULT 'pending' NOT NULL,
	"stealthAddressId" integer,
	"bankAccount" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"confirmedAt" timestamp,
	CONSTRAINT "fiat_requests_pajCashReference_unique" UNIQUE("pajCashReference")
);
--> statement-breakpoint
CREATE TABLE "paj_cash_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"encryptedToken" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "riskFlags" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"flagType" "risk_flag_type" NOT NULL,
	"severity" "risk_severity" DEFAULT 'medium' NOT NULL,
	"description" text,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolvedBy" integer,
	"resolvedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "solana_stealth_addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"stealthAddress" varchar(88) NOT NULL,
	"ephemeralKeypair" text NOT NULL,
	"transactionId" integer,
	"claimed" boolean DEFAULT false NOT NULL,
	"claimProof" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"claimedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "solana_wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"mainAddress" varchar(88) NOT NULL,
	"mainKeypair" text NOT NULL,
	"stealthKey" text NOT NULL,
	"claimKey" text NOT NULL,
	"balance" numeric(20, 8) DEFAULT '0' NOT NULL,
	"lastBalanceUpdate" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "solana_wallets_userId_unique" UNIQUE("userId"),
	CONSTRAINT "solana_wallets_mainAddress_unique" UNIQUE("mainAddress")
);
--> statement-breakpoint
CREATE TABLE "umbra_encrypted_balances" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"tokenMint" varchar(64) NOT NULL,
	"lastKnownAmount" numeric(20, 8) DEFAULT '0' NOT NULL,
	"lastShieldedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "umbra_utxos" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"commitment" varchar(88) NOT NULL,
	"tokenMint" varchar(64) NOT NULL,
	"amount" numeric(20, 8) NOT NULL,
	"type" "umbra_utxo_type" NOT NULL,
	"claimed" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"claimedAt" timestamp,
	CONSTRAINT "umbra_utxos_commitment_unique" UNIQUE("commitment")
);
--> statement-breakpoint
CREATE TABLE "user_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"type" "transaction_type" NOT NULL,
	"status" "transaction_status" DEFAULT 'pending' NOT NULL,
	"fromChain" varchar(64),
	"toChain" varchar(64),
	"fromToken" varchar(64),
	"toToken" varchar(64),
	"fromAmount" numeric(20, 8) NOT NULL,
	"toAmount" numeric(20, 8),
	"nearIntentId" varchar(255),
	"pajCashReference" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"confirmedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"username" varchar(64) NOT NULL,
	"email" varchar(320) NOT NULL,
	"name" text,
	"phone" varchar(20),
	"phoneVerified" boolean DEFAULT false NOT NULL,
	"loginMethod" varchar(64),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"kycStatus" "kyc_status" DEFAULT 'none' NOT NULL,
	"accountFrozen" boolean DEFAULT false NOT NULL,
	"dailyTransactionLimit" numeric(20, 2) DEFAULT '1000000',
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId"),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "idx_adminId" ON "auditLogs" USING btree ("adminId");--> statement-breakpoint
CREATE INDEX "idx_targetUserId" ON "auditLogs" USING btree ("targetUserId");--> statement-breakpoint
CREATE INDEX "idx_userId_type" ON "fiat_requests" USING btree ("userId","type");--> statement-breakpoint
CREATE INDEX "idx_userId_resolved" ON "riskFlags" USING btree ("userId","resolved");--> statement-breakpoint
CREATE INDEX "idx_stealth_userId_claimed" ON "solana_stealth_addresses" USING btree ("userId","claimed");--> statement-breakpoint
CREATE INDEX "idx_stealth_transactionId" ON "solana_stealth_addresses" USING btree ("transactionId");--> statement-breakpoint
CREATE INDEX "idx_userId_token" ON "umbra_encrypted_balances" USING btree ("userId","tokenMint");--> statement-breakpoint
CREATE INDEX "idx_utxo_userId_claimed" ON "umbra_utxos" USING btree ("userId","claimed");--> statement-breakpoint
CREATE INDEX "idx_userId" ON "user_transactions" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_status" ON "user_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_username" ON "users" USING btree ("username");