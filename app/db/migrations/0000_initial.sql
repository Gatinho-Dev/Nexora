CREATE TABLE `attachments` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`messageId` bigint unsigned NOT NULL,
	`fileId` bigint unsigned NOT NULL,
	`filename` varchar(255) NOT NULL,
	`mimeType` varchar(128) NOT NULL,
	`size` int NOT NULL,
	CONSTRAINT `attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bans` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`serverId` bigint unsigned NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`reason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bans_id` PRIMARY KEY(`id`),
	CONSTRAINT `ban_uniq_idx` UNIQUE(`serverId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`serverId` bigint unsigned NOT NULL,
	`name` varchar(64) NOT NULL,
	`kind` enum('text','voice') NOT NULL DEFAULT 'text',
	`position` int NOT NULL DEFAULT 0,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `channel_reads` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`channelId` bigint unsigned,
	`conversationId` bigint unsigned,
	`lastReadMessageId` bigint unsigned NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `channel_reads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `channels` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`serverId` bigint unsigned NOT NULL,
	`categoryId` bigint unsigned,
	`name` varchar(64) NOT NULL,
	`type` enum('TEXT','VOICE','ANNOUNCEMENT','FORUM','STAGE') NOT NULL DEFAULT 'TEXT',
	`position` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `channels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversation_members` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`conversationId` bigint unsigned NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `conversation_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `cm_uniq_idx` UNIQUE(`conversationId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`isGroup` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `files` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`uploaderId` bigint unsigned NOT NULL,
	`filename` varchar(255) NOT NULL,
	`mimeType` varchar(128) NOT NULL,
	`size` int NOT NULL,
	`data` longblob NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `friendships` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`requesterId` bigint unsigned NOT NULL,
	`addresseeId` bigint unsigned NOT NULL,
	`status` enum('PENDING','ACCEPTED','BLOCKED') NOT NULL DEFAULT 'PENDING',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `friendships_id` PRIMARY KEY(`id`),
	CONSTRAINT `fs_uniq_idx` UNIQUE(`requesterId`,`addresseeId`)
);
--> statement-breakpoint
CREATE TABLE `invites` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`serverId` bigint unsigned NOT NULL,
	`code` varchar(32) NOT NULL,
	`creatorId` bigint unsigned NOT NULL,
	`expiresAt` timestamp,
	`maxUses` int,
	`uses` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `invites_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `member_roles` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`serverId` bigint unsigned NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`roleId` bigint unsigned NOT NULL,
	CONSTRAINT `member_roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `mr_uniq_idx` UNIQUE(`serverId`,`userId`,`roleId`)
);
--> statement-breakpoint
CREATE TABLE `message_reactions` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`messageId` bigint unsigned NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`emoji` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `message_reactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `react_uniq_idx` UNIQUE(`messageId`,`userId`,`emoji`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`channelId` bigint unsigned,
	`conversationId` bigint unsigned,
	`authorId` bigint unsigned NOT NULL,
	`content` text NOT NULL,
	`replyToId` bigint unsigned,
	`editedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`type` varchar(32) NOT NULL,
	`actorId` bigint unsigned,
	`serverId` bigint unsigned,
	`channelId` bigint unsigned,
	`conversationId` bigint unsigned,
	`messageId` bigint unsigned,
	`content` text,
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`serverId` bigint unsigned NOT NULL,
	`name` varchar(64) NOT NULL,
	`color` varchar(16) NOT NULL DEFAULT '#94a3b8',
	`position` int NOT NULL DEFAULT 0,
	`permissions` json NOT NULL,
	`isDefault` boolean NOT NULL DEFAULT false,
	CONSTRAINT `roles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `server_members` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`serverId` bigint unsigned NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`nickname` varchar(64),
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `server_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `sm_server_user_idx` UNIQUE(`serverId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `servers` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`iconUrl` text,
	`description` text,
	`ownerId` bigint unsigned NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `servers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`unionId` varchar(255) NOT NULL,
	`username` varchar(32),
	`passwordHash` varchar(255),
	`name` varchar(255),
	`email` varchar(320),
	`avatar` text,
	`bio` text,
	`status` enum('online','idle','dnd','invisible','offline') NOT NULL DEFAULT 'offline',
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`lastSignInAt` timestamp NOT NULL DEFAULT (now()),
	`lastSeenAt` timestamp,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_unionId_unique` UNIQUE(`unionId`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `voice_sessions` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`channelId` bigint unsigned NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	`leftAt` timestamp,
	CONSTRAINT `voice_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `att_message_idx` ON `attachments` (`messageId`);--> statement-breakpoint
CREATE INDEX `cat_server_idx` ON `categories` (`serverId`);--> statement-breakpoint
CREATE INDEX `cr_user_idx` ON `channel_reads` (`userId`);--> statement-breakpoint
CREATE INDEX `ch_server_idx` ON `channels` (`serverId`);--> statement-breakpoint
CREATE INDEX `cm_user_idx` ON `conversation_members` (`userId`);--> statement-breakpoint
CREATE INDEX `fs_addressee_idx` ON `friendships` (`addresseeId`);--> statement-breakpoint
CREATE INDEX `inv_server_idx` ON `invites` (`serverId`);--> statement-breakpoint
CREATE INDEX `mr_user_idx` ON `member_roles` (`userId`);--> statement-breakpoint
CREATE INDEX `react_message_idx` ON `message_reactions` (`messageId`);--> statement-breakpoint
CREATE INDEX `msg_channel_idx` ON `messages` (`channelId`,`id`);--> statement-breakpoint
CREATE INDEX `msg_conversation_idx` ON `messages` (`conversationId`,`id`);--> statement-breakpoint
CREATE INDEX `notif_user_idx` ON `notifications` (`userId`,`isRead`);--> statement-breakpoint
CREATE INDEX `role_server_idx` ON `roles` (`serverId`);--> statement-breakpoint
CREATE INDEX `sm_user_idx` ON `server_members` (`userId`);--> statement-breakpoint
CREATE INDEX `vs_channel_idx` ON `voice_sessions` (`channelId`);