-- server_onboarding table
CREATE TABLE `server_onboarding` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`serverId` bigint unsigned NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`rules` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE now(),
	CONSTRAINT `server_onboarding_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `onb_server_idx` ON `server_onboarding` (`serverId`);

-- server_emojis table
CREATE TABLE `server_emojis` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`serverId` bigint unsigned NOT NULL,
	`name` varchar(64) NOT NULL,
	`url` text NOT NULL,
	`createdBy` bigint unsigned NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `server_emojis_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `emoji_server_idx` ON `server_emojis` (`serverId`);
--> statement-breakpoint
CREATE UNIQUE INDEX `emoji_server_name_unique` ON `server_emojis` (`serverId`, `name`);

-- server_stickers table
CREATE TABLE `server_stickers` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`serverId` bigint unsigned NOT NULL,
	`name` varchar(64) NOT NULL,
	`url` text NOT NULL,
	`createdBy` bigint unsigned NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `server_stickers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `sticker_server_idx` ON `server_stickers` (`serverId`);
--> statement-breakpoint
CREATE UNIQUE INDEX `sticker_server_name_unique` ON `server_stickers` (`serverId`, `name`);

-- server_apps table (installed apps per server)
CREATE TABLE `server_apps` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`serverId` bigint unsigned NOT NULL,
	`appId` varchar(64) NOT NULL, -- reference to a global apps table or slug
	`installedBy` bigint unsigned NOT NULL,
	`installedAt` timestamp NOT NULL DEFAULT (now()),
	`settings` json, -- per-instance configuration
	CONSTRAINT `server_apps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `app_server_idx` ON `server_apps` (`serverId`);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_server_unique` ON `server_apps` (`serverId`, `appId`);

-- Add memberId column to permission_overrides for per-member overrides
ALTER TABLE `permission_overrides`
	ADD COLUMN `memberId` bigint unsigned,
	ADD INDEX `po_member_idx` (`memberId`);
--> statement-breakpoint
-- If memberId is set, roleId must be null (and vice versa). We'll enforce via application logic.
-- Add revokedAt column to invites
ALTER TABLE `invites`
	ADD COLUMN `revokedAt` timestamp NULL;
--> statement-breakpoint
CREATE INDEX `invites_revoked_idx` ON `invites` (`revokedAt`);

-- Add ignoredRoleIds and ignoredChannelIds to automod_rules for AutoMod exceptions
ALTER TABLE `automod_rules`
	ADD COLUMN `ignoredRoleIds` json NULL,
	ADD COLUMN `ignoredChannelIds` json NULL;