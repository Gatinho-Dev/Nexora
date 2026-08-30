CREATE TABLE IF NOT EXISTS `media_deep_reviews` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `fileId` bigint unsigned NOT NULL,
  `caseId` bigint unsigned NOT NULL,
  `reportId` bigint unsigned NOT NULL,
  `status` enum('queued','processing','completed','failed') NOT NULL DEFAULT 'queued',
  `attempts` int NOT NULL DEFAULT 0,
  `lastError` varchar(500),
  `result` json,
  `model` varchar(160),
  `startedAt` timestamp NULL,
  `completedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `media_deep_reviews_id` PRIMARY KEY(`id`),
  CONSTRAINT `mdr_report_file_uniq` UNIQUE(`reportId`,`fileId`),
  INDEX `mdr_status_created_idx` (`status`,`createdAt`),
  INDEX `mdr_case_idx` (`caseId`)
);
