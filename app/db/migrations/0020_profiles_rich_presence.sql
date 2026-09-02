ALTER TABLE `users`
  ADD COLUMN `customStatus` varchar(128),
  ADD COLUMN `profileTheme` varchar(24) NOT NULL DEFAULT 'cobalt',
  ADD COLUMN `profileAccent` varchar(16) NOT NULL DEFAULT '#7383FF',
  ADD COLUMN `nameFont` varchar(32) NOT NULL DEFAULT 'sans',
  ADD COLUMN `nameEffect` varchar(32) NOT NULL DEFAULT 'solid',
  ADD COLUMN `nameColorA` varchar(16) NOT NULL DEFAULT '#F4F7FB',
  ADD COLUMN `nameColorB` varchar(16) NOT NULL DEFAULT '#7383FF',
  ADD COLUMN `avatarDecoration` varchar(32) NOT NULL DEFAULT 'none',
  ADD COLUMN `profileEffect` varchar(32) NOT NULL DEFAULT 'none',
  ADD COLUMN `profileGames` json,
  ADD COLUMN `profileWishlist` json,
  ADD COLUMN `profileWidgets` json,
  ADD COLUMN `favoriteGameId` varchar(64),
  ADD COLUMN `favoriteGameNote` varchar(240);
--> statement-breakpoint
UPDATE `users`
SET `profileGames` = JSON_ARRAY(),
    `profileWishlist` = JSON_ARRAY(),
    `profileWidgets` = JSON_ARRAY('games', 'favorite')
WHERE `profileGames` IS NULL OR `profileWishlist` IS NULL OR `profileWidgets` IS NULL;
--> statement-breakpoint
ALTER TABLE `users`
  MODIFY COLUMN `profileGames` json NOT NULL,
  MODIFY COLUMN `profileWishlist` json NOT NULL,
  MODIFY COLUMN `profileWidgets` json NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_connections`
  ADD COLUMN `scopes` json,
  ADD COLUMN `showDetails` boolean NOT NULL DEFAULT true,
  ADD COLUMN `activityVisibility` varchar(16) NOT NULL DEFAULT 'everyone',
  ADD COLUMN `errorCode` varchar(64),
  ADD COLUMN `lastSyncedAt` timestamp NULL;
--> statement-breakpoint
UPDATE `user_connections` SET `scopes` = JSON_ARRAY() WHERE `scopes` IS NULL;
--> statement-breakpoint
ALTER TABLE `user_connections` MODIFY COLUMN `scopes` json NOT NULL;
--> statement-breakpoint
DELETE older
FROM `user_connections` older
INNER JOIN `user_connections` newer
  ON newer.`userId` = older.`userId`
 AND newer.`provider` = older.`provider`
 AND newer.`id` > older.`id`;
--> statement-breakpoint
CREATE UNIQUE INDEX `uc_user_provider_uniq` ON `user_connections` (`userId`,`provider`);
--> statement-breakpoint
CREATE TABLE `external_oauth_states` (
  `state` varchar(96) NOT NULL,
  `userId` bigint unsigned NOT NULL,
  `provider` varchar(32) NOT NULL,
  `codeVerifierEnc` varchar(600),
  `nonce` varchar(96),
  `returnPath` varchar(180) NOT NULL DEFAULT '/',
  `expiresAt` timestamp NOT NULL,
  `consumedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `external_oauth_states_state` PRIMARY KEY(`state`),
  INDEX `eos_user_provider_idx` (`userId`,`provider`),
  INDEX `eos_expires_idx` (`expiresAt`)
);
--> statement-breakpoint
CREATE TABLE `rich_presence_activities` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `userId` bigint unsigned NOT NULL,
  `provider` varchar(32) NOT NULL,
  `type` varchar(24) NOT NULL,
  `title` varchar(200) NOT NULL,
  `details` varchar(240),
  `state` varchar(240),
  `largeImageUrl` varchar(600),
  `largeImageText` varchar(200),
  `smallImageUrl` varchar(600),
  `smallImageText` varchar(200),
  `startedAt` timestamp NULL,
  `endsAt` timestamp NULL,
  `externalUrl` varchar(500),
  `isLive` boolean NOT NULL DEFAULT false,
  `fingerprint` char(64) NOT NULL,
  `fetchedAt` timestamp NOT NULL DEFAULT (now()),
  `expiresAt` timestamp NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE NOW(),
  CONSTRAINT `rich_presence_activities_id` PRIMARY KEY(`id`),
  CONSTRAINT `rpa_user_provider_uniq` UNIQUE(`userId`,`provider`),
  INDEX `rpa_expires_idx` (`expiresAt`)
);
--> statement-breakpoint
INSERT INTO `rich_presence_activities`
  (`userId`,`provider`,`type`,`title`,`details`,`state`,`largeImageUrl`,`startedAt`,`externalUrl`,`isLive`,`fingerprint`,`fetchedAt`,`expiresAt`)
SELECT
  `userId`, 'roblox', 'gaming', COALESCE(`name`, 'Roblox'), 'Jogando Roblox', `creatorName`,
  `thumbnailUrl`, `startedAt`, `playUrl`, false,
  SHA2(CONCAT_WS('|', `status`, COALESCE(`name`, ''), COALESCE(`placeId`, 0)), 256),
  `updatedAt`, DATE_ADD(`updatedAt`, INTERVAL 3 MINUTE)
FROM `roblox_activity`
WHERE `stale` = false AND `status` = 'IN_GAME'
ON DUPLICATE KEY UPDATE
  `title` = VALUES(`title`),
  `details` = VALUES(`details`),
  `state` = VALUES(`state`),
  `largeImageUrl` = VALUES(`largeImageUrl`),
  `startedAt` = VALUES(`startedAt`),
  `externalUrl` = VALUES(`externalUrl`),
  `fingerprint` = VALUES(`fingerprint`),
  `fetchedAt` = VALUES(`fetchedAt`),
  `expiresAt` = VALUES(`expiresAt`);
