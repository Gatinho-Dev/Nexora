CREATE TABLE `group_invites` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`conversationId` bigint unsigned NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`createdByUserId` bigint unsigned NOT NULL,
	`expiresAt` timestamp,
	`maxUses` int,
	`uses` int NOT NULL DEFAULT 0,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `group_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `gi_token_uniq` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `pinned_messages` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`conversationId` bigint unsigned NOT NULL,
	`messageId` bigint unsigned NOT NULL,
	`pinnedByUserId` bigint unsigned NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pinned_messages_id` PRIMARY KEY(`id`),
	CONSTRAINT `pm_conv_msg_uniq` UNIQUE(`conversationId`,`messageId`)
);
--> statement-breakpoint
ALTER TABLE `conversation_members` ADD `role` enum('owner','admin','member') DEFAULT 'member' NOT NULL;--> statement-breakpoint
ALTER TABLE `conversation_members` ADD `nickname` varchar(64);--> statement-breakpoint
ALTER TABLE `conversation_members` ADD `mutedUntil` timestamp;--> statement-breakpoint
ALTER TABLE `conversation_members` ADD `notificationLevel` enum('all','mentions','muted') DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE `conversations` ADD `name` varchar(100);--> statement-breakpoint
ALTER TABLE `conversations` ADD `avatarUrl` text;--> statement-breakpoint
ALTER TABLE `conversations` ADD `description` varchar(500);--> statement-breakpoint
ALTER TABLE `conversations` ADD `ownerId` bigint unsigned;--> statement-breakpoint
ALTER TABLE `conversations` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
CREATE INDEX `gi_conv_idx` ON `group_invites` (`conversationId`);--> statement-breakpoint
CREATE INDEX `pm_conv_idx` ON `pinned_messages` (`conversationId`);