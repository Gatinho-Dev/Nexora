ALTER TABLE `servers`
  ADD COLUMN `tags` json,
  ADD COLUMN `verificationLevel` enum('none','low','medium','high','maximum') NOT NULL DEFAULT 'none',
  ADD COLUMN `defaultNotifications` enum('all','mentions') NOT NULL DEFAULT 'all',
  ADD COLUMN `invitesPaused` boolean NOT NULL DEFAULT false,
  ADD COLUMN `rulesEnabled` boolean NOT NULL DEFAULT false,
  ADD COLUMN `rules` json,
  ADD COLUMN `communityEnabled` boolean NOT NULL DEFAULT false;
--> statement-breakpoint
UPDATE `servers`
  SET `tags` = JSON_ARRAY(), `rules` = JSON_ARRAY()
  WHERE `tags` IS NULL OR `rules` IS NULL;
--> statement-breakpoint
ALTER TABLE `servers`
  MODIFY COLUMN `tags` json NOT NULL,
  MODIFY COLUMN `rules` json NOT NULL;
--> statement-breakpoint
ALTER TABLE `server_members`
  ADD COLUMN `timeoutUntil` timestamp NULL,
  ADD COLUMN `rulesAcceptedAt` timestamp NULL,
  ADD COLUMN `lastActiveAt` timestamp NULL;
--> statement-breakpoint
ALTER TABLE `roles`
  ADD COLUMN `hoistMembers` boolean NOT NULL DEFAULT false,
  ADD COLUMN `mentionable` boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE `invites`
  ADD COLUMN `revokedAt` timestamp NULL;
--> statement-breakpoint
CREATE TABLE `server_notification_preferences` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `serverId` bigint unsigned NOT NULL,
  `userId` bigint unsigned NOT NULL,
  `level` enum('all','mentions','none') NOT NULL DEFAULT 'mentions',
  `mutedUntil` timestamp NULL,
  `suppressEveryone` boolean NOT NULL DEFAULT false,
  `suppressRoles` boolean NOT NULL DEFAULT false,
  `updatedAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `server_notification_preferences_id` PRIMARY KEY(`id`),
  CONSTRAINT `snp_server_user_uniq` UNIQUE(`serverId`,`userId`)
);
--> statement-breakpoint
CREATE INDEX `snp_user_idx` ON `server_notification_preferences` (`userId`);
--> statement-breakpoint
CREATE TABLE `server_audit_logs` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `serverId` bigint unsigned NOT NULL,
  `actorUserId` bigint unsigned NOT NULL,
  `action` varchar(64) NOT NULL,
  `targetType` varchar(48) NOT NULL,
  `targetId` bigint unsigned,
  `targetUserId` bigint unsigned,
  `reason` varchar(500),
  `metadata` json,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `server_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `sal_server_idx` ON `server_audit_logs` (`serverId`,`id`);
--> statement-breakpoint
CREATE INDEX `sal_actor_idx` ON `server_audit_logs` (`actorUserId`,`id`);
--> statement-breakpoint
CREATE INDEX `sal_target_idx` ON `server_audit_logs` (`targetUserId`,`id`);
