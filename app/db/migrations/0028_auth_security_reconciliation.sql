CREATE TABLE IF NOT EXISTS `qr_login_sessions` (
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
  PRIMARY KEY (`id`),
  UNIQUE KEY `qls_token_uniq` (`tokenHash`),
  KEY `qls_expiry_idx` (`expiresAt`,`status`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `passkeys` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
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
  PRIMARY KEY (`id`),
  UNIQUE KEY `pk_credential_uniq` (`credentialId`),
  KEY `pk_user_idx` (`userId`,`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `webauthn_challenges` (
  `id` char(36) NOT NULL,
  `userId` bigint unsigned,
  `challengeHash` char(64) NOT NULL,
  `purpose` enum('register','authenticate') NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `consumedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  KEY `wc_expiry_idx` (`expiresAt`,`purpose`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `totp_settings` (
  `userId` bigint unsigned NOT NULL,
  `encryptedSecret` text NOT NULL,
  `enabled` boolean NOT NULL DEFAULT false,
  `verifiedAt` timestamp NULL,
  `lastUsedStep` bigint,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE NOW(),
  PRIMARY KEY (`userId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `backup_codes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `userId` bigint unsigned NOT NULL,
  `codeHash` varchar(180) NOT NULL,
  `usedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  KEY `bc_user_idx` (`userId`,`usedAt`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `trusted_devices` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `userId` bigint unsigned NOT NULL,
  `sessionId` varchar(32) NOT NULL,
  `trustedAt` timestamp NOT NULL DEFAULT (now()),
  `expiresAt` timestamp NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `td_session_uniq` (`sessionId`),
  KEY `td_user_idx` (`userId`,`trustedAt`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `security_events` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
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
  PRIMARY KEY (`id`),
  KEY `sec_user_idx` (`userId`,`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `email_action_tokens` (
  `id` char(36) NOT NULL,
  `userId` bigint unsigned NOT NULL,
  `purpose` enum('verify_email','password_reset','email_change') NOT NULL,
  `tokenHash` char(64) NOT NULL,
  `targetEmail` varchar(320),
  `expiresAt` timestamp NOT NULL,
  `consumedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  UNIQUE KEY `eat_token_uniq` (`tokenHash`),
  KEY `eat_user_purpose_idx` (`userId`,`purpose`,`createdAt`),
  KEY `eat_expiry_idx` (`expiresAt`,`consumedAt`),
  CONSTRAINT `email_action_tokens_user_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
