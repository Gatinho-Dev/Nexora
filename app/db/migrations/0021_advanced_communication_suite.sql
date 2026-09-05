-- Nexora advanced communication suite.
-- Additive by design: no existing column or API is removed, and JSON values
-- are supplied by application writes instead of TiDB-incompatible defaults.

CREATE TABLE `channel_advanced_settings` (
  `channelId` bigint unsigned NOT NULL,
  `slowModeSeconds` int NOT NULL DEFAULT 0,
  `forumView` enum('list','cards','compact') NOT NULL DEFAULT 'list',
  `forumRequireTag` boolean NOT NULL DEFAULT false,
  `forumAutoArchiveHours` int,
  `stageTopic` varchar(180),
  `priorityAttenuation` int NOT NULL DEFAULT 50,
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE NOW(),
  CONSTRAINT `channel_advanced_settings_channelId` PRIMARY KEY(`channelId`)
);
--> statement-breakpoint
CREATE INDEX `cas_slow_mode_idx` ON `channel_advanced_settings` (`slowModeSeconds`);
--> statement-breakpoint
CREATE TABLE `forum_tags` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `channelId` bigint unsigned NOT NULL,
  `name` varchar(32) NOT NULL,
  `color` varchar(16) NOT NULL DEFAULT '#7383FF',
  `emoji` varchar(64),
  `position` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `forum_tags_id` PRIMARY KEY(`id`),
  CONSTRAINT `ft_channel_name_uniq` UNIQUE(`channelId`,`name`)
);
--> statement-breakpoint
CREATE INDEX `ft_channel_position_idx` ON `forum_tags` (`channelId`,`position`);
--> statement-breakpoint
CREATE TABLE `forum_posts` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `channelId` bigint unsigned NOT NULL,
  `messageId` bigint unsigned NOT NULL,
  `authorId` bigint unsigned NOT NULL,
  `title` varchar(120) NOT NULL,
  `status` enum('OPEN','CLOSED','LOCKED','ARCHIVED') NOT NULL DEFAULT 'OPEN',
  `pinned` boolean NOT NULL DEFAULT false,
  `replyCount` int NOT NULL DEFAULT 0,
  `lastParticipantId` bigint unsigned,
  `closedAt` timestamp NULL,
  `archivedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE NOW(),
  CONSTRAINT `forum_posts_id` PRIMARY KEY(`id`),
  CONSTRAINT `fp_message_uniq` UNIQUE(`messageId`)
);
--> statement-breakpoint
CREATE INDEX `fp_channel_activity_idx` ON `forum_posts` (`channelId`,`updatedAt`);
--> statement-breakpoint
CREATE INDEX `fp_channel_popularity_idx` ON `forum_posts` (`channelId`,`replyCount`);
--> statement-breakpoint
CREATE TABLE `forum_post_tags` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `postId` bigint unsigned NOT NULL,
  `tagId` bigint unsigned NOT NULL,
  CONSTRAINT `forum_post_tags_id` PRIMARY KEY(`id`),
  CONSTRAINT `fpt_post_tag_uniq` UNIQUE(`postId`,`tagId`)
);
--> statement-breakpoint
CREATE INDEX `fpt_tag_idx` ON `forum_post_tags` (`tagId`,`postId`);
--> statement-breakpoint
CREATE TABLE `announcement_publications` (
  `messageId` bigint unsigned NOT NULL,
  `sourceChannelId` bigint unsigned NOT NULL,
  `publishedByUserId` bigint unsigned NOT NULL,
  `propagatedCount` int NOT NULL DEFAULT 0,
  `publishedAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `announcement_publications_messageId` PRIMARY KEY(`messageId`)
);
--> statement-breakpoint
CREATE INDEX `ap_channel_idx` ON `announcement_publications` (`sourceChannelId`,`publishedAt`);
--> statement-breakpoint
CREATE TABLE `server_event_details` (
  `eventId` bigint unsigned NOT NULL,
  `imageUrl` varchar(800),
  `timezone` varchar(64) NOT NULL DEFAULT 'UTC',
  `locationType` enum('voice','stage','external','physical') NOT NULL DEFAULT 'physical',
  `location` varchar(300),
  `externalUrl` varchar(800),
  `recurrenceRule` varchar(300),
  `endedAt` timestamp NULL,
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE NOW(),
  CONSTRAINT `server_event_details_eventId` PRIMARY KEY(`eventId`)
);
--> statement-breakpoint
CREATE TABLE `server_event_interests` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `eventId` bigint unsigned NOT NULL,
  `userId` bigint unsigned NOT NULL,
  `reminderMinutes` int,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `server_event_interests_id` PRIMARY KEY(`id`),
  CONSTRAINT `sei_event_user_uniq` UNIQUE(`eventId`,`userId`)
);
--> statement-breakpoint
CREATE INDEX `sei_user_idx` ON `server_event_interests` (`userId`,`eventId`);
--> statement-breakpoint
CREATE TABLE `stage_sessions` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `serverId` bigint unsigned NOT NULL,
  `channelId` bigint unsigned NOT NULL,
  `topic` varchar(180) NOT NULL,
  `createdByUserId` bigint unsigned NOT NULL,
  `status` enum('ACTIVE','ENDED') NOT NULL DEFAULT 'ACTIVE',
  `startedAt` timestamp NOT NULL DEFAULT (now()),
  `endedAt` timestamp NULL,
  CONSTRAINT `stage_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `sts_channel_status_idx` ON `stage_sessions` (`channelId`,`status`);
--> statement-breakpoint
CREATE TABLE `stage_participants` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `sessionId` bigint unsigned NOT NULL,
  `userId` bigint unsigned NOT NULL,
  `role` enum('AUDIENCE','SPEAKER','MODERATOR') NOT NULL DEFAULT 'AUDIENCE',
  `requestState` enum('NONE','PENDING','ACCEPTED','REJECTED') NOT NULL DEFAULT 'NONE',
  `muted` boolean NOT NULL DEFAULT false,
  `requestedAt` timestamp NULL,
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE NOW(),
  CONSTRAINT `stage_participants_id` PRIMARY KEY(`id`),
  CONSTRAINT `stp_session_user_uniq` UNIQUE(`sessionId`,`userId`)
);
--> statement-breakpoint
CREATE INDEX `stp_session_request_idx` ON `stage_participants` (`sessionId`,`requestState`);
--> statement-breakpoint
CREATE TABLE `user_timeouts` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `serverId` bigint unsigned NOT NULL,
  `userId` bigint unsigned NOT NULL,
  `moderatorUserId` bigint unsigned NOT NULL,
  `reason` varchar(500),
  `startsAt` timestamp NOT NULL DEFAULT (now()),
  `endsAt` timestamp NULL,
  `clearedAt` timestamp NULL,
  CONSTRAINT `user_timeouts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ut_server_user_idx` ON `user_timeouts` (`serverId`,`userId`,`endsAt`);
--> statement-breakpoint
CREATE TABLE `invite_advanced_settings` (
  `inviteId` bigint unsigned NOT NULL,
  `defaultChannelId` bigint unsigned,
  `temporaryMembership` boolean NOT NULL DEFAULT false,
  `pausedAt` timestamp NULL,
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE NOW(),
  CONSTRAINT `invite_advanced_settings_inviteId` PRIMARY KEY(`inviteId`)
);
--> statement-breakpoint
CREATE TABLE `onboarding_configs` (
  `serverId` bigint unsigned NOT NULL,
  `enabled` boolean NOT NULL DEFAULT false,
  `welcomeTitle` varchar(120),
  `welcomeMessage` text,
  `coverImageUrl` varchar(800),
  `requireRules` boolean NOT NULL DEFAULT true,
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE NOW(),
  CONSTRAINT `onboarding_configs_serverId` PRIMARY KEY(`serverId`)
);
--> statement-breakpoint
CREATE TABLE `onboarding_questions` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `serverId` bigint unsigned NOT NULL,
  `prompt` varchar(240) NOT NULL,
  `options` json NOT NULL,
  `required` boolean NOT NULL DEFAULT false,
  `multiple` boolean NOT NULL DEFAULT false,
  `position` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `onboarding_questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `oq_server_position_idx` ON `onboarding_questions` (`serverId`,`position`);
--> statement-breakpoint
CREATE TABLE `onboarding_answers` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `serverId` bigint unsigned NOT NULL,
  `userId` bigint unsigned NOT NULL,
  `answers` json NOT NULL,
  `interests` json NOT NULL,
  `completedAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE NOW(),
  CONSTRAINT `onboarding_answers_id` PRIMARY KEY(`id`),
  CONSTRAINT `oa_server_user_uniq` UNIQUE(`serverId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `server_guides` (
  `serverId` bigint unsigned NOT NULL,
  `welcomeMessage` text,
  `rules` json NOT NULL,
  `resources` json NOT NULL,
  `recommendedChannelIds` json NOT NULL,
  `tasks` json NOT NULL,
  `faq` json NOT NULL,
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE NOW(),
  CONSTRAINT `server_guides_serverId` PRIMARY KEY(`serverId`)
);
--> statement-breakpoint
CREATE TABLE `user_custom_status` (
  `userId` bigint unsigned NOT NULL,
  `text` varchar(128),
  `emoji` varchar(64),
  `presence` enum('online','idle','dnd','invisible') NOT NULL DEFAULT 'online',
  `expiresAt` timestamp NULL,
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE NOW(),
  CONSTRAINT `user_custom_status_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
CREATE TABLE `soundboard_sounds` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `serverId` bigint unsigned NOT NULL,
  `fileId` bigint unsigned NOT NULL,
  `createdByUserId` bigint unsigned NOT NULL,
  `name` varchar(64) NOT NULL,
  `emoji` varchar(64),
  `volume` int NOT NULL DEFAULT 100,
  `durationMs` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `soundboard_sounds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `sbs_server_idx` ON `soundboard_sounds` (`serverId`,`id`);
--> statement-breakpoint
CREATE TABLE `soundboard_favorites` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `userId` bigint unsigned NOT NULL,
  `soundId` bigint unsigned NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `soundboard_favorites_id` PRIMARY KEY(`id`),
  CONSTRAINT `sbf_user_sound_uniq` UNIQUE(`userId`,`soundId`)
);
--> statement-breakpoint
CREATE TABLE `audio_clips` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `userId` bigint unsigned NOT NULL,
  `fileId` bigint unsigned NOT NULL,
  `name` varchar(64) NOT NULL,
  `startMs` int NOT NULL DEFAULT 0,
  `endMs` int NOT NULL,
  `volume` int NOT NULL DEFAULT 100,
  `waveform` json NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `audio_clips_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ac_user_idx` ON `audio_clips` (`userId`,`id`);
--> statement-breakpoint
CREATE TABLE `voice_priority_settings` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `serverId` bigint unsigned NOT NULL,
  `userId` bigint unsigned NOT NULL,
  `enabled` boolean NOT NULL DEFAULT true,
  `attenuation` int NOT NULL DEFAULT 50,
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE NOW(),
  CONSTRAINT `voice_priority_settings_id` PRIMARY KEY(`id`),
  CONSTRAINT `vps_server_user_uniq` UNIQUE(`serverId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `channel_pinned_messages` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `channelId` bigint unsigned NOT NULL,
  `messageId` bigint unsigned NOT NULL,
  `pinnedByUserId` bigint unsigned NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `channel_pinned_messages_id` PRIMARY KEY(`id`),
  CONSTRAINT `cpm_channel_message_uniq` UNIQUE(`channelId`,`messageId`)
);
--> statement-breakpoint
CREATE INDEX `cpm_channel_idx` ON `channel_pinned_messages` (`channelId`,`id`);
--> statement-breakpoint
CREATE TABLE `saved_message_folders` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `userId` bigint unsigned NOT NULL,
  `name` varchar(64) NOT NULL,
  `color` varchar(16) NOT NULL DEFAULT '#7383FF',
  `position` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `saved_message_folders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `smf_user_position_idx` ON `saved_message_folders` (`userId`,`position`);
--> statement-breakpoint
CREATE TABLE `saved_messages` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `userId` bigint unsigned NOT NULL,
  `messageId` bigint unsigned NOT NULL,
  `folderId` bigint unsigned,
  `tags` json NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `saved_messages_id` PRIMARY KEY(`id`),
  CONSTRAINT `sm_user_message_uniq` UNIQUE(`userId`,`messageId`)
);
--> statement-breakpoint
CREATE INDEX `sm_user_folder_idx` ON `saved_messages` (`userId`,`folderId`,`id`);
--> statement-breakpoint
CREATE TABLE `thread_subscriptions` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `threadId` bigint unsigned NOT NULL,
  `userId` bigint unsigned NOT NULL,
  `level` enum('all','mentions','none') NOT NULL DEFAULT 'all',
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE NOW(),
  CONSTRAINT `thread_subscriptions_id` PRIMARY KEY(`id`),
  CONSTRAINT `ts_thread_user_uniq` UNIQUE(`threadId`,`userId`)
);
--> statement-breakpoint
CREATE INDEX `ts_user_idx` ON `thread_subscriptions` (`userId`,`threadId`);
--> statement-breakpoint
CREATE TABLE `message_forwards` (
  `messageId` bigint unsigned NOT NULL,
  `sourceMessageId` bigint unsigned,
  `forwardedByUserId` bigint unsigned NOT NULL,
  `sourceSnapshot` json NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `message_forwards_messageId` PRIMARY KEY(`messageId`)
);
--> statement-breakpoint
CREATE TABLE `scheduled_messages` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `userId` bigint unsigned NOT NULL,
  `channelId` bigint unsigned,
  `conversationId` bigint unsigned,
  `content` text NOT NULL,
  `attachmentIds` json NOT NULL,
  `scheduledFor` timestamp NOT NULL,
  `timezone` varchar(64) NOT NULL DEFAULT 'UTC',
  `state` enum('PENDING','PROCESSING','SENT','FAILED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  `sentMessageId` bigint unsigned,
  `failureReason` varchar(500),
  `attempts` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE NOW(),
  CONSTRAINT `scheduled_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `sched_state_due_idx` ON `scheduled_messages` (`state`,`scheduledFor`);
--> statement-breakpoint
CREATE INDEX `sched_user_idx` ON `scheduled_messages` (`userId`,`id`);
--> statement-breakpoint
CREATE TABLE `user_profile_details` (
  `userId` bigint unsigned NOT NULL,
  `displayName` varchar(64),
  `pronouns` varchar(64),
  `location` varchar(120),
  `website` varchar(500),
  `about` text,
  `privacy` json NOT NULL,
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE NOW(),
  CONSTRAINT `user_profile_details_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
CREATE TABLE `profile_fields` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `userId` bigint unsigned NOT NULL,
  `label` varchar(40) NOT NULL,
  `value` varchar(300) NOT NULL,
  `visibility` enum('everyone','friends','mutual_servers','nobody') NOT NULL DEFAULT 'everyone',
  `position` int NOT NULL DEFAULT 0,
  CONSTRAINT `profile_fields_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `pf_user_position_idx` ON `profile_fields` (`userId`,`position`);
--> statement-breakpoint
CREATE TABLE `user_notes` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `authorUserId` bigint unsigned NOT NULL,
  `targetUserId` bigint unsigned NOT NULL,
  `encryptedContent` text NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE NOW(),
  CONSTRAINT `user_notes_id` PRIMARY KEY(`id`),
  CONSTRAINT `un_author_target_uniq` UNIQUE(`authorUserId`,`targetUserId`)
);
--> statement-breakpoint
CREATE TABLE `user_favorites` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `userId` bigint unsigned NOT NULL,
  `targetType` enum('server','channel','dm','thread') NOT NULL,
  `targetId` bigint unsigned NOT NULL,
  `position` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `user_favorites_id` PRIMARY KEY(`id`),
  CONSTRAINT `uf_user_target_uniq` UNIQUE(`userId`,`targetType`,`targetId`)
);
--> statement-breakpoint
CREATE INDEX `uf_user_position_idx` ON `user_favorites` (`userId`,`position`);
--> statement-breakpoint
CREATE TABLE `server_folders` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `userId` bigint unsigned NOT NULL,
  `name` varchar(64) NOT NULL,
  `color` varchar(16) NOT NULL DEFAULT '#7383FF',
  `position` int NOT NULL DEFAULT 0,
  `collapsed` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `server_folders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `sf_user_position_idx` ON `server_folders` (`userId`,`position`);
--> statement-breakpoint
CREATE TABLE `server_folder_items` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `folderId` bigint unsigned NOT NULL,
  `serverId` bigint unsigned NOT NULL,
  `position` int NOT NULL DEFAULT 0,
  CONSTRAINT `server_folder_items_id` PRIMARY KEY(`id`),
  CONSTRAINT `sfi_folder_server_uniq` UNIQUE(`folderId`,`serverId`)
);
--> statement-breakpoint
CREATE INDEX `sfi_folder_position_idx` ON `server_folder_items` (`folderId`,`position`);
--> statement-breakpoint
CREATE TABLE `server_order` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `userId` bigint unsigned NOT NULL,
  `serverId` bigint unsigned NOT NULL,
  `position` int NOT NULL DEFAULT 0,
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE NOW(),
  CONSTRAINT `server_order_id` PRIMARY KEY(`id`),
  CONSTRAINT `uso_user_server_uniq` UNIQUE(`userId`,`serverId`)
);
--> statement-breakpoint
CREATE INDEX `uso_user_position_idx` ON `server_order` (`userId`,`position`);
--> statement-breakpoint
CREATE TABLE `server_insights` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `serverId` bigint unsigned NOT NULL,
  `day` timestamp NOT NULL,
  `membersTotal` int NOT NULL DEFAULT 0,
  `activeMembers` int NOT NULL DEFAULT 0,
  `newMembers` int NOT NULL DEFAULT 0,
  `returningMembers` int NOT NULL DEFAULT 0,
  `messages` int NOT NULL DEFAULT 0,
  `activeChannels` int NOT NULL DEFAULT 0,
  `voiceParticipants` int NOT NULL DEFAULT 0,
  `events` int NOT NULL DEFAULT 0,
  `inviteSources` json NOT NULL,
  `hourlyActivity` json NOT NULL,
  CONSTRAINT `server_insights_id` PRIMARY KEY(`id`),
  CONSTRAINT `si_server_day_uniq` UNIQUE(`serverId`,`day`)
);
--> statement-breakpoint
CREATE TABLE `community_settings` (
  `serverId` bigint unsigned NOT NULL,
  `rulesChannelId` bigint unsigned,
  `announcementChannelId` bigint unsigned,
  `spamProtectionEnabled` boolean NOT NULL DEFAULT true,
  `minimumModerationEnabled` boolean NOT NULL DEFAULT true,
  `enabledAt` timestamp NULL,
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE NOW(),
  CONSTRAINT `community_settings_serverId` PRIMARY KEY(`serverId`)
);
--> statement-breakpoint
CREATE TABLE `qr_login_sessions` (
  `id` char(36) NOT NULL,
  `tokenHash` char(64) NOT NULL,
  `desktopSessionId` varchar(32),
  `approvedByUserId` bigint unsigned,
  `status` enum('PENDING','APPROVED','CONSUMED','EXPIRED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `deviceSummary` varchar(160) NOT NULL,
  `browser` varchar(40) NOT NULL,
  `approximateLocation` varchar(120),
  `partialIp` varchar(64),
  `expiresAt` timestamp NOT NULL,
  `approvedAt` timestamp NULL,
  `consumedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `qr_login_sessions_id` PRIMARY KEY(`id`),
  CONSTRAINT `qls_token_uniq` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE INDEX `qls_expiry_idx` ON `qr_login_sessions` (`expiresAt`,`status`);
--> statement-breakpoint
CREATE TABLE `passkeys` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `userId` bigint unsigned NOT NULL,
  `credentialId` varchar(512) NOT NULL,
  `publicKey` text NOT NULL,
  `counter` bigint unsigned NOT NULL DEFAULT 0,
  `transports` json NOT NULL,
  `name` varchar(80) NOT NULL,
  `deviceType` varchar(32),
  `backedUp` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `lastUsedAt` timestamp NULL,
  CONSTRAINT `passkeys_id` PRIMARY KEY(`id`),
  CONSTRAINT `pk_credential_uniq` UNIQUE(`credentialId`)
);
--> statement-breakpoint
CREATE INDEX `pk_user_idx` ON `passkeys` (`userId`,`id`);
--> statement-breakpoint
CREATE TABLE `webauthn_challenges` (
  `id` char(36) NOT NULL,
  `userId` bigint unsigned,
  `challengeHash` char(64) NOT NULL,
  `purpose` enum('register','authenticate') NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `consumedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `webauthn_challenges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `wc_expiry_idx` ON `webauthn_challenges` (`expiresAt`,`purpose`);
--> statement-breakpoint
CREATE TABLE `totp_settings` (
  `userId` bigint unsigned NOT NULL,
  `encryptedSecret` text NOT NULL,
  `enabled` boolean NOT NULL DEFAULT false,
  `verifiedAt` timestamp NULL,
  `lastUsedStep` bigint,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE NOW(),
  CONSTRAINT `totp_settings_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
CREATE TABLE `backup_codes` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `userId` bigint unsigned NOT NULL,
  `codeHash` varchar(180) NOT NULL,
  `usedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `backup_codes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `bc_user_idx` ON `backup_codes` (`userId`,`usedAt`);
--> statement-breakpoint
CREATE TABLE `trusted_devices` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `userId` bigint unsigned NOT NULL,
  `sessionId` varchar(32) NOT NULL,
  `trustedAt` timestamp NOT NULL DEFAULT (now()),
  `expiresAt` timestamp NULL,
  CONSTRAINT `trusted_devices_id` PRIMARY KEY(`id`),
  CONSTRAINT `td_session_uniq` UNIQUE(`sessionId`)
);
--> statement-breakpoint
CREATE INDEX `td_user_idx` ON `trusted_devices` (`userId`,`trustedAt`);
--> statement-breakpoint
CREATE TABLE `user_blocks` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `userId` bigint unsigned NOT NULL,
  `blockedUserId` bigint unsigned NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `user_blocks_id` PRIMARY KEY(`id`),
  CONSTRAINT `ub_pair_uniq` UNIQUE(`userId`,`blockedUserId`)
);
--> statement-breakpoint
CREATE INDEX `ub_blocked_idx` ON `user_blocks` (`blockedUserId`,`userId`);
--> statement-breakpoint
CREATE TABLE `user_restrictions` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `userId` bigint unsigned NOT NULL,
  `restrictedUserId` bigint unsigned NOT NULL,
  `filterMessages` boolean NOT NULL DEFAULT true,
  `muteCalls` boolean NOT NULL DEFAULT true,
  `muteNotifications` boolean NOT NULL DEFAULT true,
  `hidePresence` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE NOW(),
  CONSTRAINT `user_restrictions_id` PRIMARY KEY(`id`),
  CONSTRAINT `ur_pair_uniq` UNIQUE(`userId`,`restrictedUserId`)
);
--> statement-breakpoint
CREATE TABLE `message_requests` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `ownerUserId` bigint unsigned NOT NULL,
  `conversationId` bigint unsigned NOT NULL,
  `category` enum('friends','mutual_servers','unknown','suspicious') NOT NULL,
  `riskScore` int NOT NULL DEFAULT 0,
  `reasons` json NOT NULL,
  `state` enum('PENDING','ACCEPTED','IGNORED','SPAM') NOT NULL DEFAULT 'PENDING',
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE NOW(),
  CONSTRAINT `message_requests_id` PRIMARY KEY(`id`),
  CONSTRAINT `mr_owner_conversation_uniq` UNIQUE(`ownerUserId`,`conversationId`)
);
--> statement-breakpoint
CREATE TABLE `security_events` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `userId` bigint unsigned NOT NULL,
  `type` varchar(64) NOT NULL,
  `severity` enum('info','warning','critical') NOT NULL DEFAULT 'info',
  `device` varchar(120),
  `browser` varchar(40),
  `os` varchar(40),
  `approximateLocation` varchar(120),
  `partialIp` varchar(64),
  `metadata` json,
  `acknowledgedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `security_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `sec_user_idx` ON `security_events` (`userId`,`id`);
--> statement-breakpoint
CREATE TABLE `tickets` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `requesterUserId` bigint unsigned NOT NULL,
  `assigneeUserId` bigint unsigned,
  `category` enum('account','moderation','report','bug','billing','security','ban') NOT NULL,
  `priority` enum('LOW','NORMAL','HIGH','URGENT') NOT NULL DEFAULT 'NORMAL',
  `status` enum('OPEN','IN_PROGRESS','WAITING_USER','RESOLVED','CLOSED') NOT NULL DEFAULT 'OPEN',
  `subject` varchar(160) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE NOW(),
  CONSTRAINT `tickets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ticket_requester_idx` ON `tickets` (`requesterUserId`,`id`);
--> statement-breakpoint
CREATE INDEX `ticket_queue_idx` ON `tickets` (`status`,`priority`,`id`);
--> statement-breakpoint
CREATE TABLE `ticket_messages` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `ticketId` bigint unsigned NOT NULL,
  `authorUserId` bigint unsigned NOT NULL,
  `content` text NOT NULL,
  `attachmentIds` json NOT NULL,
  `internal` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `ticket_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `tm_ticket_idx` ON `ticket_messages` (`ticketId`,`id`);
--> statement-breakpoint
CREATE TABLE `ban_appeals` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `serverId` bigint unsigned NOT NULL,
  `userId` bigint unsigned NOT NULL,
  `banId` bigint unsigned NOT NULL,
  `reason` varchar(240) NOT NULL,
  `explanation` text NOT NULL,
  `evidence` json NOT NULL,
  `status` enum('PENDING','UPHELD','REDUCED','REMOVED') NOT NULL DEFAULT 'PENDING',
  `reviewedByUserId` bigint unsigned,
  `resolution` varchar(500),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `reviewedAt` timestamp NULL,
  CONSTRAINT `ban_appeals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ba_user_idx` ON `ban_appeals` (`userId`,`id`);
--> statement-breakpoint
CREATE INDEX `ba_server_status_idx` ON `ban_appeals` (`serverId`,`status`,`id`);
--> statement-breakpoint
CREATE TABLE `user_preferences` (
  `userId` bigint unsigned NOT NULL,
  `data` json NOT NULL,
  `version` int NOT NULL DEFAULT 1,
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE NOW(),
  CONSTRAINT `user_preferences_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
CREATE TABLE `device_preferences` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `userId` bigint unsigned NOT NULL,
  `deviceId` varchar(96) NOT NULL,
  `data` json NOT NULL,
  `version` int NOT NULL DEFAULT 1,
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE NOW(),
  CONSTRAINT `device_preferences_id` PRIMARY KEY(`id`),
  CONSTRAINT `dp_user_device_uniq` UNIQUE(`userId`,`deviceId`)
);
--> statement-breakpoint
CREATE TABLE `cached_sync_state` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `userId` bigint unsigned NOT NULL,
  `scope` varchar(64) NOT NULL,
  `version` int NOT NULL DEFAULT 1,
  `checksum` char(64) NOT NULL,
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE NOW(),
  CONSTRAINT `cached_sync_state_id` PRIMARY KEY(`id`),
  CONSTRAINT `css_user_scope_uniq` UNIQUE(`userId`,`scope`)
);
