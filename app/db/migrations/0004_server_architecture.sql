CREATE TABLE `channel_follows` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`sourceChannelId` bigint unsigned NOT NULL,
	`followerServerId` bigint unsigned NOT NULL,
	`targetChannelId` bigint unsigned NOT NULL,
	`createdByUserId` bigint unsigned NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `channel_follows_id` PRIMARY KEY(`id`),
	CONSTRAINT `cf_source_target_uniq` UNIQUE(`sourceChannelId`,`targetChannelId`)
);
--> statement-breakpoint
CREATE TABLE `permission_overrides` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`targetType` enum('category','channel') NOT NULL,
	`targetId` bigint unsigned NOT NULL,
	`roleId` bigint unsigned,
	`allow` json NOT NULL,
	`deny` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `permission_overrides_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `threads` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`channelId` bigint unsigned NOT NULL,
	`name` varchar(100) NOT NULL,
	`createdById` bigint unsigned NOT NULL,
	`private` boolean NOT NULL DEFAULT false,
	`archivedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `threads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `channels` MODIFY COLUMN `type` enum('TEXT','VOICE','ANNOUNCEMENT','FORUM','STAGE','MEDIA') NOT NULL DEFAULT 'TEXT';--> statement-breakpoint
ALTER TABLE `channels` ADD `topic` varchar(500);--> statement-breakpoint
ALTER TABLE `channels` ADD `syncedWithCategory` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `channels` ADD `tags` json;--> statement-breakpoint
ALTER TABLE `messages` ADD `threadId` bigint unsigned;--> statement-breakpoint
ALTER TABLE `servers` ADD `bannerUrl` text;--> statement-breakpoint
ALTER TABLE `servers` ADD `vanitySlug` varchar(32);--> statement-breakpoint
ALTER TABLE `servers` ADD CONSTRAINT `srv_vanity_uniq` UNIQUE(`vanitySlug`);--> statement-breakpoint
CREATE INDEX `cf_source_idx` ON `channel_follows` (`sourceChannelId`);--> statement-breakpoint
CREATE INDEX `po_target_idx` ON `permission_overrides` (`targetType`,`targetId`);--> statement-breakpoint
CREATE INDEX `th_channel_idx` ON `threads` (`channelId`);