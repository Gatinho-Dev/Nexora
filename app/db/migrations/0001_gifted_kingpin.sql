CREATE TABLE `admin_audit_log` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`actorUserId` bigint unsigned NOT NULL,
	`action` varchar(64) NOT NULL,
	`entityType` varchar(48) NOT NULL,
	`entityId` bigint unsigned,
	`targetUserId` bigint unsigned,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `official_announcement_reads` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`announcementId` bigint unsigned NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`readAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `official_announcement_reads_id` PRIMARY KEY(`id`),
	CONSTRAINT `oar_announcement_user_idx` UNIQUE(`announcementId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `official_announcements` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`title` varchar(120) NOT NULL,
	`content` text NOT NULL,
	`kind` enum('GENERAL','UPDATE','SECURITY','MAINTENANCE') NOT NULL DEFAULT 'GENERAL',
	`publishedByUserId` bigint unsigned NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`publishedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `official_announcements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `platform_badges` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`slug` varchar(48) NOT NULL,
	`label` varchar(64) NOT NULL,
	`description` varchar(255),
	`icon` varchar(64),
	`color` varchar(16) NOT NULL DEFAULT '#4654D8',
	`isStaff` boolean NOT NULL DEFAULT false,
	`createdByUserId` bigint unsigned NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `platform_badges_id` PRIMARY KEY(`id`),
	CONSTRAINT `platform_badges_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `user_badges` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`badgeId` bigint unsigned NOT NULL,
	`assignedByUserId` bigint unsigned NOT NULL,
	`assignedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_badges_id` PRIMARY KEY(`id`),
	CONSTRAINT `ub_user_badge_idx` UNIQUE(`userId`,`badgeId`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `banner` text;--> statement-breakpoint
CREATE INDEX `aal_actor_idx` ON `admin_audit_log` (`actorUserId`,`id`);--> statement-breakpoint
CREATE INDEX `aal_target_idx` ON `admin_audit_log` (`targetUserId`,`id`);--> statement-breakpoint
CREATE INDEX `oar_user_idx` ON `official_announcement_reads` (`userId`,`announcementId`);--> statement-breakpoint
CREATE INDEX `oa_active_idx` ON `official_announcements` (`isActive`,`publishedAt`);--> statement-breakpoint
CREATE INDEX `pb_staff_idx` ON `platform_badges` (`isStaff`);--> statement-breakpoint
CREATE INDEX `ub_badge_idx` ON `user_badges` (`badgeId`,`userId`);
