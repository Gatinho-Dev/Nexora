CREATE TABLE `conversation_preferences` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`conversationId` bigint unsigned NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`pinnedAt` timestamp,
	`hiddenAt` timestamp,
	`mutedUntil` timestamp,
	`mutedForever` boolean NOT NULL DEFAULT false,
	`requestState` enum('pending','accepted','ignored','spam'),
	`privateNote` text,
	`friendNickname` varchar(64),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE NOW(),
	CONSTRAINT `conversation_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `cp_user_conversation_uniq` UNIQUE(`userId`,`conversationId`)
);
--> statement-breakpoint
CREATE INDEX `cp_user_pinned_idx` ON `conversation_preferences` (`userId`,`pinnedAt`);
--> statement-breakpoint
DELETE older FROM `channel_reads` older
INNER JOIN `channel_reads` newer
	ON older.`userId` = newer.`userId`
	AND (
		(older.`channelId` IS NOT NULL AND older.`channelId` = newer.`channelId`)
		OR
		(older.`conversationId` IS NOT NULL AND older.`conversationId` = newer.`conversationId`)
	)
	AND (
		older.`lastReadMessageId` < newer.`lastReadMessageId`
		OR (older.`lastReadMessageId` = newer.`lastReadMessageId` AND older.`id` < newer.`id`)
	);
--> statement-breakpoint
CREATE UNIQUE INDEX `cr_user_channel_uniq` ON `channel_reads` (`userId`,`channelId`);
--> statement-breakpoint
CREATE UNIQUE INDEX `cr_user_conversation_uniq` ON `channel_reads` (`userId`,`conversationId`);
