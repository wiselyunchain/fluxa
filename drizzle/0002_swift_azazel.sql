ALTER TYPE "public"."transaction_type" ADD VALUE 'transfer';--> statement-breakpoint
ALTER TYPE "public"."transaction_type" ADD VALUE 'receive';--> statement-breakpoint
ALTER TABLE "user_transactions" ADD COLUMN "toAddress" varchar(88);--> statement-breakpoint
ALTER TABLE "user_transactions" ADD COLUMN "isPrivate" boolean DEFAULT false NOT NULL;