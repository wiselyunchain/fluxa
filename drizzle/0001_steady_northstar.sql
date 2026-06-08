ALTER TABLE "user_transactions" ADD COLUMN "nearIntentDepositAddress" varchar(88);--> statement-breakpoint
ALTER TABLE "user_transactions" ADD COLUMN "nearIntentDepositMemo" varchar(255);--> statement-breakpoint
CREATE INDEX "idx_pending_swaps" ON "user_transactions" USING btree ("type","status","nearIntentDepositAddress");