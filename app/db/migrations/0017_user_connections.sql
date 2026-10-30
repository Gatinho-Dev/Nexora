-- Conexões externas (integrações): Roblox primeiro.
-- Tokens são armazenados criptografados em repouso (AES-256-GCM).

CREATE TABLE `user_connections` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`provider` varchar(32) NOT NULL,
	`providerUserId` varchar(64) NOT NULL,
	`username` varchar(100),
	`displayName` varchar(100),
	`avatarUrl` varchar(500),
	`profileUrl` varchar(300),
	`accessTokenEnc` varchar(600),
	`refreshTokenEnc` varchar(600),
	`tokenExpiresAt` timestamp,
	`needsReauth` boolean NOT NULL DEFAULT false,
	`showOnProfile` boolean NOT NULL DEFAULT true,
	`showActivity` boolean NOT NULL DEFAULT true,
	`allowJoin` boolean NOT NULL DEFAULT true,
	`connectedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE NOW(),
	CONSTRAINT `user_connections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uc_provider_user_uniq` ON `user_connections` (`provider`,`providerUserId`);
--> statement-breakpoint
CREATE INDEX `uc_user_idx` ON `user_connections` (`userId`,`provider`);
--> statement-breakpoint
CREATE TABLE `roblox_activity` (
	`userId` bigint unsigned NOT NULL,
	`status` varchar(20) NOT NULL,
	`universeId` bigint,
	`placeId` bigint,
	`name` varchar(200),
	`creatorName` varchar(100),
	`thumbnailUrl` varchar(600),
	`playUrl` varchar(300),
	`startedAt` timestamp,
	`stale` boolean NOT NULL DEFAULT false,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE NOW(),
	CONSTRAINT `roblox_activity_userId` PRIMARY KEY(`userId`)
);
