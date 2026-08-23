CREATE TABLE `webhooks` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`channelId` bigint unsigned NOT NULL,
	`serverId` bigint unsigned NOT NULL,
	`name` varchar(80) NOT NULL,
	`avatarUrl` varchar(500),
	`tokenHash` varchar(64) NOT NULL,
	`createdById` bigint unsigned NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webhooks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `channels` ADD `forcedTags` boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `wh_channel_idx` ON `webhooks` (`channelId`);