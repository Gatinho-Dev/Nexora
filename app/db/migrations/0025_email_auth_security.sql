-- E-mail opcional e segurança de conta.
-- O hash permite unicidade e lookup sem expor o endereço no índice.

ALTER TABLE `users` ADD COLUMN `emailHash` char(64) NULL;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `emailVerifiedAt` timestamp NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_hash_uniq` ON `users` (`emailHash`);
--> statement-breakpoint
CREATE TABLE `email_action_tokens` (
  `id` char(36) NOT NULL,
  `userId` bigint unsigned NOT NULL,
  `purpose` enum('verify_email','password_reset','email_change') NOT NULL,
  `tokenHash` char(64) NOT NULL,
  `targetEmail` varchar(320),
  `expiresAt` timestamp NOT NULL,
  `consumedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `email_action_tokens_id` PRIMARY KEY (`id`),
  CONSTRAINT `email_action_tokens_user_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `eat_token_uniq` ON `email_action_tokens` (`tokenHash`);
--> statement-breakpoint
CREATE INDEX `eat_user_purpose_idx` ON `email_action_tokens` (`userId`,`purpose`,`createdAt`);
--> statement-breakpoint
CREATE INDEX `eat_expiry_idx` ON `email_action_tokens` (`expiresAt`,`consumedAt`);
