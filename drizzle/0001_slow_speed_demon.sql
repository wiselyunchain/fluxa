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
CREATE TABLE `fiatRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('onramp','offramp') NOT NULL,
	`amount` decimal(20,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'NGN',
	`cryptoAmount` decimal(20,8),
	`cryptoToken` varchar(64),
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`paymentProvider` varchar(64),
	`paymentReference` varchar(255),
	`bankAccount` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `fiatRequests_id` PRIMARY KEY(`id`)
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
CREATE TABLE `tokenBalances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`walletId` int NOT NULL,
	`token` enum('usdt','usdc','usde','sol','eth','bnb','ton','avax') NOT NULL,
	`balance` decimal(20,8) NOT NULL DEFAULT '0',
	`usdValue` decimal(20,2) NOT NULL DEFAULT '0',
	`lastUpdate` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tokenBalances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('deposit','withdrawal','swap','onramp','offramp') NOT NULL,
	`status` enum('pending','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
	`fromChain` varchar(64),
	`toChain` varchar(64),
	`fromToken` varchar(64),
	`toToken` varchar(64),
	`fromAmount` decimal(20,8) NOT NULL,
	`toAmount` decimal(20,8),
	`fee` decimal(20,8) DEFAULT '0',
	`slippage` decimal(5,2) DEFAULT '0',
	`txHash` varchar(255),
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wallets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`chain` enum('solana','base','bsc','ton','avalanche') NOT NULL,
	`address` varchar(255) NOT NULL,
	`publicKey` text,
	`encryptedPrivateKey` text,
	`balance` decimal(20,8) NOT NULL DEFAULT '0',
	`lastBalanceUpdate` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wallets_id` PRIMARY KEY(`id`),
	CONSTRAINT `wallets_address_unique` UNIQUE(`address`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `email` varchar(320) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `username` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `phoneVerified` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `kycStatus` enum('none','pending','verified','rejected') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `accountFrozen` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `dailyTransactionLimit` decimal(20,2) DEFAULT '1000000';--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_username_unique` UNIQUE(`username`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);--> statement-breakpoint
CREATE INDEX `idx_adminId` ON `auditLogs` (`adminId`);--> statement-breakpoint
CREATE INDEX `idx_targetUserId` ON `auditLogs` (`targetUserId`);--> statement-breakpoint
CREATE INDEX `idx_userId_type` ON `fiatRequests` (`userId`,`type`);--> statement-breakpoint
CREATE INDEX `idx_userId_resolved` ON `riskFlags` (`userId`,`resolved`);--> statement-breakpoint
CREATE INDEX `idx_walletId_token` ON `tokenBalances` (`walletId`,`token`);--> statement-breakpoint
CREATE INDEX `idx_userId` ON `transactions` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_status` ON `transactions` (`status`);--> statement-breakpoint
CREATE INDEX `idx_userId_chain` ON `wallets` (`userId`,`chain`);--> statement-breakpoint
CREATE INDEX `idx_username` ON `users` (`username`);