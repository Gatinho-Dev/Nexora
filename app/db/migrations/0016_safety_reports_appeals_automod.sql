-- Nova camada de segurança: denúncias, casos de moderação, apelações,
-- AutoMod por servidor e auditoria de segurança.
-- Também estende `violations` para cobrir mensagens de texto e política.

ALTER TABLE `violations`
  ADD COLUMN `messageId` bigint unsigned AFTER `fileId`,
  ADD COLUMN `targetType` varchar(32) AFTER `messageId`,
  ADD COLUMN `policyVersion` varchar(40) AFTER `moderationModel`;
--> statement-breakpoint
ALTER TABLE `violations`
  MODIFY COLUMN `source` enum('automatic_ai','moderator','user_report','automod') NOT NULL DEFAULT 'automatic_ai';
--> statement-breakpoint
CREATE UNIQUE INDEX `vio_msg_cat_uniq` ON `violations` (`messageId`,`category`);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`reporterId` bigint unsigned NOT NULL,
	`targetType` enum('message','user','media','server','channel') NOT NULL,
	`targetId` bigint unsigned NOT NULL,
	`reportedUserId` bigint unsigned,
	`category` varchar(64) NOT NULL,
	`subcategory` varchar(64),
	`description` varchar(1000),
	`status` enum('submitted','triaged','under_review','action_taken','no_violation','closed') NOT NULL DEFAULT 'submitted',
	`priority` enum('low','normal','high','critical') NOT NULL DEFAULT 'normal',
	`caseId` bigint unsigned,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`reviewedAt` timestamp,
	CONSTRAINT `reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `rep_reporter_idx` ON `reports` (`reporterId`,`id`);
--> statement-breakpoint
CREATE INDEX `rep_target_idx` ON `reports` (`targetType`,`targetId`);
--> statement-breakpoint
CREATE INDEX `rep_reported_user_idx` ON `reports` (`reportedUserId`);
--> statement-breakpoint
CREATE INDEX `rep_case_idx` ON `reports` (`caseId`);
--> statement-breakpoint
CREATE TABLE `moderation_cases` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`targetType` varchar(32) NOT NULL,
	`targetId` bigint unsigned,
	`reportedUserId` bigint unsigned,
	`category` varchar(64) NOT NULL,
	`priority` enum('low','normal','high','critical') NOT NULL DEFAULT 'normal',
	`status` enum('open','under_review','confirmed','false_positive','closed') NOT NULL DEFAULT 'open',
	`aiAssessment` json,
	`reportsCount` int NOT NULL DEFAULT 0,
	`internalContext` varchar(500),
	`linkedViolationId` bigint unsigned,
	`assignedModeratorId` bigint unsigned,
	`policyVersion` varchar(40),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE NOW(),
	CONSTRAINT `moderation_cases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `mc_status_idx` ON `moderation_cases` (`status`,`createdAt`);
--> statement-breakpoint
CREATE INDEX `mc_priority_idx` ON `moderation_cases` (`priority`);
--> statement-breakpoint
CREATE INDEX `mc_reported_user_idx` ON `moderation_cases` (`reportedUserId`);
--> statement-breakpoint
CREATE INDEX `mc_target_idx` ON `moderation_cases` (`targetType`,`targetId`);
--> statement-breakpoint
CREATE TABLE `moderation_case_reports` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`caseId` bigint unsigned NOT NULL,
	`reportId` bigint unsigned NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `moderation_case_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mcr_report_uniq` ON `moderation_case_reports` (`reportId`);
--> statement-breakpoint
CREATE INDEX `mcr_case_idx` ON `moderation_case_reports` (`caseId`);
--> statement-breakpoint
CREATE TABLE `appeals` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`violationId` bigint unsigned NOT NULL,
	`reason` varchar(2000),
	`status` enum('submitted','under_review','approved','denied') NOT NULL DEFAULT 'submitted',
	`reviewNote` varchar(1000),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`reviewedAt` timestamp,
	`reviewedByUserId` bigint unsigned,
	CONSTRAINT `appeals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `app_user_idx` ON `appeals` (`userId`,`id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_violation_uniq` ON `appeals` (`violationId`);
--> statement-breakpoint
CREATE TABLE `automod_rules` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`serverId` bigint unsigned NOT NULL,
	`ruleType` varchar(32) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`config` json,
	`updatedByUserId` bigint unsigned,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE NOW(),
	CONSTRAINT `automod_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `amr_server_type_uniq` ON `automod_rules` (`serverId`,`ruleType`);
--> statement-breakpoint
CREATE TABLE `safety_audit_events` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`event` varchar(64) NOT NULL,
	`actorUserId` bigint unsigned,
	`targetUserId` bigint unsigned,
	`caseId` bigint unsigned,
	`violationId` bigint unsigned,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `safety_audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `sae_event_idx` ON `safety_audit_events` (`event`,`createdAt`);
--> statement-breakpoint
CREATE INDEX `sae_target_idx` ON `safety_audit_events` (`targetUserId`);
