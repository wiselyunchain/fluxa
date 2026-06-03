CREATE TABLE `paj_cash_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`encryptedToken` text NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `paj_cash_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `umbra_encrypted_balances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tokenMint` varchar(64) NOT NULL,
	`lastKnownAmount` decimal(20,8) NOT NULL DEFAULT '0',
	`lastShieldedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `umbra_encrypted_balances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `umbra_utxos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`commitment` varchar(88) NOT NULL,
	`tokenMint` varchar(64) NOT NULL,
	`amount` decimal(20,8) NOT NULL,
	`type` enum('self_claimable','receiver_claimable') NOT NULL,
	`claimed` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`claimedAt` timestamp,
	CONSTRAINT `umbra_utxos_id` PRIMARY KEY(`id`),
	CONSTRAINT `umbra_utxos_commitment_unique` UNIQUE(`commitment`)
);
--> statement-breakpoint
CREATE INDEX `idx_userId_token` ON `umbra_encrypted_balances` (`userId`,`tokenMint`);--> statement-breakpoint
CREATE INDEX `idx_userId_claimed` ON `umbra_utxos` (`userId`,`claimed`);