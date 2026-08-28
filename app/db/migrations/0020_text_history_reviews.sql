ALTER TABLE `messages`
  ADD INDEX `msg_channel_author_idx` (`channelId`, `authorId`, `id`),
  ADD INDEX `msg_conversation_author_idx` (`conversationId`, `authorId`, `id`);
--> statement-breakpoint

ALTER TABLE `violations`
  ADD COLUMN `publicReason` varchar(500) NULL,
  ADD COLUMN `affectedContentCount` int NOT NULL DEFAULT 1,
  ADD COLUMN `suspensionDays` int NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `text_history_reviews` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `reportId` bigint unsigned NOT NULL,
  `caseId` bigint unsigned NOT NULL,
  `anchorMessageId` bigint unsigned NOT NULL,
  `reportedUserId` bigint unsigned NOT NULL,
  `scopeType` enum('channel','conversation') NOT NULL,
  `scopeId` bigint unsigned NOT NULL,
  `status` enum('queued','processing','completed','failed') NOT NULL DEFAULT 'queued',
  `attempts` int NOT NULL DEFAULT 0,
  `snapshotMaxMessageId` bigint unsigned NOT NULL,
  `cursorMessageId` bigint unsigned NOT NULL DEFAULT 0,
  `scannedCount` int NOT NULL DEFAULT 0,
  `removedCount` int NOT NULL DEFAULT 0,
  `categories` json NOT NULL,
  `violationIds` json NOT NULL,
  `enforcementViolationId` bigint unsigned NULL,
  `sanction` enum('none','warning','temporary_suspension') NOT NULL DEFAULT 'none',
  `suspensionDays` int NULL,
  `publicReason` varchar(500) NULL,
  `model` varchar(160) NULL,
  `lastError` varchar(500) NULL,
  `startedAt` timestamp NULL,
  `completedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `text_history_reviews_id` PRIMARY KEY(`id`),
  CONSTRAINT `thr_report_uniq` UNIQUE(`reportId`),
  INDEX `thr_status_created_idx` (`status`,`createdAt`),
  INDEX `thr_scope_author_idx` (`scopeType`,`scopeId`,`reportedUserId`)
);
