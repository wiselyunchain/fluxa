CREATE TABLE `paj_cash_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('deposit','withdrawal') NOT NULL,
	`direction` enum('naira_to_usdt','usdt_to_naira') NOT NULL,
	`nairaAmount` decimal(15,2),
	`usdtAmount` decimal(20,8),
	`userBankAccount` varchar(255),
	`pajCashReference` varchar(255),
	`status` enum('pending','confirmed','failed') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`confirmedAt` timestamp,
	CONSTRAINT `paj_cash_transactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `paj_cash_transactions_pajCashReference_unique` UNIQUE(`pajCashReference`)
);
--> statement-breakpoint
CREATE TABLE `solana_wallets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`publicKey` varchar(88) NOT NULL,
	`encryptedPrivateKey` text NOT NULL,
	`x25519Key` text NOT NULL,
	`umbraRegistered` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `solana_wallets_id` PRIMARY KEY(`id`),
	CONSTRAINT `solana_wallets_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `solana_wallets_publicKey_unique` UNIQUE(`publicKey`)
);
--> statement-breakpoint
CREATE TABLE `umbra_encrypted_balances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`token` varchar(50) NOT NULL,
	`encryptedAmount` text,
	`lastSyncedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `umbra_encrypted_balances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `umbra_utxos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`transactionId` int,
	`token` varchar(50) NOT NULL,
	`amount` decimal(20,8) NOT NULL,
	`commitment` varchar(255) NOT NULL,
	`recipient` varchar(88) NOT NULL,
	`claimed` boolean NOT NULL DEFAULT false,
	`claimProof` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`claimedAt` timestamp,
	CONSTRAINT `umbra_utxos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_userId_type` ON `paj_cash_transactions` (`userId`,`type`);--> statement-breakpoint
CREATE INDEX `idx_userId_token` ON `umbra_encrypted_balances` (`userId`,`token`);--> statement-breakpoint
CREATE INDEX `idx_userId_claimed` ON `umbra_utxos` (`userId`,`claimed`);