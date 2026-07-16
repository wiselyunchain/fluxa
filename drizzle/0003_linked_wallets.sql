CREATE TYPE "public"."chain_type" AS ENUM('solana', 'evm', 'ton', 'near', 'bitcoin');
--> statement-breakpoint
CREATE TABLE "linked_wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"chain" "chain_type" NOT NULL,
	"address" varchar(88) NOT NULL,
	"privateKey" text,
	"isExternal" boolean DEFAULT false NOT NULL,
	"isDefault" boolean DEFAULT false NOT NULL,
	"stealthKey" text,
	"claimKey" text,
	"umbraScanIndex" integer DEFAULT 0,
	"balance" numeric(20, 8) DEFAULT '0' NOT NULL,
	"lastBalanceUpdate" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "solana_stealth_addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"transactionId" integer NOT NULL,
	"stealthAddress" varchar(88) NOT NULL,
	"ephemeralKeypair" text NOT NULL,
	"claimed" boolean DEFAULT false NOT NULL,
	"claimedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "solanaPrivacyKeypair" text;
--> statement-breakpoint
DROP TABLE "solana_wallets";
--> statement-breakpoint
CREATE INDEX "idx_linked_userId" ON "linked_wallets" ("userId");
--> statement-breakpoint
CREATE INDEX "idx_linked_chain" ON "linked_wallets" ("chain");
