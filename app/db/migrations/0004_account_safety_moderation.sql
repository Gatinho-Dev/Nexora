CREATE TABLE `account_safety` (
	`userId` bigint unsigned NOT NULL,
	`status` enum('good_standing','limited','very_limited','at_risk','suspended','permanently_banned') NOT NULL DEFAULT 'good_standing',
	`severeStrikes` int NOT NULL DEFAULT 0,
	`maxSevereStrikes` int NOT NULL DEFAULT 3,
	`suspendedUntil` timestamp,
	`suspendedByViolationId` bigint unsigned,
	`permanentBan` boolean NOT NULL DEFAULT false,
	`sensitiveMediaPref` enum('hide','warn','auto') NOT NULL DEFAULT 'warn',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `account_safety_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
CREATE TABLE `media_moderation` (
	`fileId` bigint unsigned NOT NULL,
	`uploaderId` bigint unsigned NOT NULL,
	`status` enum('processing','approved','sensitive','blocked','review_required') NOT NULL DEFAULT 'processing',
	`safety` enum('safe','unsafe','unknown') NOT NULL DEFAULT 'unknown',
	`categories` json NOT NULL,
	`sensitive` boolean NOT NULL DEFAULT false,
	`adultOnly` boolean NOT NULL DEFAULT false,
	`allowReveal` boolean NOT NULL DEFAULT true,
	`attempts` int NOT NULL DEFAULT 0,
	`lastError` varchar(500),
	`moderationModel` varchar(160),
	`moderatedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `media_moderation_fileId` PRIMARY KEY(`fileId`)
);
--> statement-breakpoint
CREATE TABLE `violations` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`fileId` bigint unsigned,
	`category` varchar(120) NOT NULL,
	`severity` enum('warning','moderate','severe') NOT NULL DEFAULT 'severe',
	`source` enum('automatic_ai','moderator','user_report') NOT NULL DEFAULT 'automatic_ai',
	`moderationModel` varchar(160),
	`status` enum('pending_review','confirmed','false_positive','resolved') NOT NULL DEFAULT 'pending_review',
	`action` enum('none','warning','limited','content_blocked','three_day_suspension','temporary_suspension','permanent_ban') NOT NULL DEFAULT 'none',
	`strikeApplied` boolean NOT NULL DEFAULT false,
	`internalNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`reviewedAt` timestamp,
	`reviewedByUserId` bigint unsigned,
	CONSTRAINT `violations_id` PRIMARY KEY(`id`),
	CONSTRAINT `vio_file_cat_uniq` UNIQUE(`fileId`,`category`)
);
--> statement-breakpoint
CREATE INDEX `vio_user_idx` ON `violations` (`userId`,`id`);--> statement-breakpoint
CREATE INDEX `vio_status_idx` ON `violations` (`status`,`createdAt`);