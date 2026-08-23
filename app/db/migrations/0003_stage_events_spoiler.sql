CREATE TABLE `server_events` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`serverId` bigint unsigned NOT NULL,
	`channelId` bigint unsigned,
	`createdByUserId` bigint unsigned NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	`startsAt` timestamp NOT NULL,
	`endsAt` timestamp,
	`status` enum('SCHEDULED','ACTIVE','CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `server_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stage_speakers` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`channelId` bigint unsigned NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`grantedByUserId` bigint unsigned,
	`grantedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stage_speakers_id` PRIMARY KEY(`id`),
	CONSTRAINT `ss_channel_user_idx` UNIQUE(`channelId`,`userId`)
);
--> statement-breakpoint
ALTER TABLE `attachments` ADD `spoiler` boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `se_server_idx` ON `server_events` (`serverId`);--> statement-breakpoint
CREATE INDEX `ss_user_idx` ON `stage_speakers` (`userId`);