CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adminId` int NOT NULL,
	`action` varchar(255) NOT NULL,
	`targetUserId` int,
	`details` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fiat_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('deposit','withdrawal') NOT NULL,
	`amount` decimal(20,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'NGN',
	`pajCashReference` varchar(255),
	`status` enum('pending','processing','confirmed','failed') NOT NULL DEFAULT 'pending',
	`stealthAddressId` int,
	`bankAccount` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`confirmedAt` timestamp,
	CONSTRAINT `fiat_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `fiat_requests_pajCashReference_unique` UNIQUE(`pajCashReference`)
);
--> statement-breakpoint
CREATE TABLE `riskFlags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`flagType` enum('suspicious_activity','high_volume','unusual_pattern','kyc_mismatch','manual_review') NOT NULL,
	`severity` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`description` text,
	`resolved` boolean NOT NULL DEFAULT false,
	`resolvedBy` int,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `riskFlags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `solana_stealth_addresses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`stealthAddress` varchar(88) NOT NULL,
	`ephemeralKeypair` text NOT NULL,
	`transactionId` int,
	`claimed` boolean NOT NULL DEFAULT false,
	`claimProof` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`claimedAt` timestamp,
	CONSTRAINT `solana_stealth_addresses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `solana_wallets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`mainAddress` varchar(88) NOT NULL,
	`mainKeypair` text NOT NULL,
	`stealthKey` text NOT NULL,
	`claimKey` text NOT NULL,
	`balance` decimal(20,8) NOT NULL DEFAULT '0',
	`lastBalanceUpdate` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `solana_wallets_id` PRIMARY KEY(`id`),
	CONSTRAINT `solana_wallets_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `solana_wallets_mainAddress_unique` UNIQUE(`mainAddress`)
);
--> statement-breakpoint
CREATE TABLE `user_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('deposit','withdrawal','swap') NOT NULL,
	`status` enum('pending','confirmed','failed','cancelled') NOT NULL DEFAULT 'pending',
	`fromChain` varchar(64),
	`toChain` varchar(64),
	`fromToken` varchar(64),
	`toToken` varchar(64),
	`fromAmount` decimal(20,8) NOT NULL,
	`toAmount` decimal(20,8),
	`nearIntentId` varchar(255),
	`pajCashReference` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`confirmedAt` timestamp,
	CONSTRAINT `user_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`username` varchar(64) NOT NULL,
	`email` varchar(320) NOT NULL,
	`name` text,
	`phone` varchar(20),
	`phoneVerified` boolean NOT NULL DEFAULT false,
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`kycStatus` enum('none','pending','verified','rejected') NOT NULL DEFAULT 'none',
	`accountFrozen` boolean NOT NULL DEFAULT false,
	`dailyTransactionLimit` decimal(20,2) DEFAULT '1000000',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE INDEX `idx_adminId` ON `auditLogs` (`adminId`);--> statement-breakpoint
CREATE INDEX `idx_targetUserId` ON `auditLogs` (`targetUserId`);--> statement-breakpoint
CREATE INDEX `idx_userId_type` ON `fiat_requests` (`userId`,`type`);--> statement-breakpoint
CREATE INDEX `idx_userId_resolved` ON `riskFlags` (`userId`,`resolved`);--> statement-breakpoint
CREATE INDEX `idx_userId_claimed` ON `solana_stealth_addresses` (`userId`,`claimed`);--> statement-breakpoint
CREATE INDEX `idx_transactionId` ON `solana_stealth_addresses` (`transactionId`);--> statement-breakpoint
CREATE INDEX `idx_userId` ON `user_transactions` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_status` ON `user_transactions` (`status`);--> statement-breakpoint
CREATE INDEX `idx_username` ON `users` (`username`);