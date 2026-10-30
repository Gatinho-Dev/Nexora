-- Sessões de dispositivo: permite listar "onde minha conta está conectada"
-- e revogar sessões remotamente (logout remoto real).
-- O banco guarda apenas o sha256 do token — nunca o JWT bruto.

CREATE TABLE `account_sessions` (
	`id` varchar(32) NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`tokenHash` char(64) NOT NULL,
	`userAgent` varchar(250),
	`browser` varchar(40) NOT NULL,
	`os` varchar(40) NOT NULL,
	`deviceType` varchar(20) NOT NULL,
	`friendlyName` varchar(80) NOT NULL,
	`ipAddress` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`revokedAt` timestamp,
	CONSTRAINT `account_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `as_token_hash_uniq` ON `account_sessions` (`tokenHash`);
--> statement-breakpoint
CREATE INDEX `as_user_seen_idx` ON `account_sessions` (`userId`,`lastSeenAt`);
--> statement-breakpoint
CREATE INDEX `as_expires_idx` ON `account_sessions` (`expiresAt`);
