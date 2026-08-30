-- ── Enquetes ──────────────────────────────────────────────────
CREATE TABLE `polls` (
  `id` serial PRIMARY KEY,
  `messageId` bigint unsigned NOT NULL UNIQUE,
  `question` varchar(300) NOT NULL,
  `allowMultiple` boolean DEFAULT false NOT NULL,
  `expiresAt` timestamp,
  `closedAt` timestamp,
  `createdByUserId` bigint unsigned NOT NULL,
  `createdAt` timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX `poll_message_idx` ON `polls` (`messageId`);--> statement-breakpoint

CREATE TABLE `poll_answers` (
  `id` serial PRIMARY KEY,
  `pollId` bigint unsigned NOT NULL,
  `text` varchar(120) NOT NULL,
  `position` int DEFAULT 0 NOT NULL
);--> statement-breakpoint
CREATE INDEX `poll_answers_poll_idx` ON `poll_answers` (`pollId`);--> statement-breakpoint

CREATE TABLE `poll_votes` (
  `id` serial PRIMARY KEY,
  `pollId` bigint unsigned NOT NULL,
  `answerId` bigint unsigned NOT NULL,
  `userId` bigint unsigned NOT NULL,
  `createdAt` timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `poll_votes_uniq` ON `poll_votes` (`pollId`,`userId`,`answerId`);--> statement-breakpoint
CREATE INDEX `poll_votes_user_idx` ON `poll_votes` (`userId`);--> statement-breakpoint

-- ── Threads: estado bloqueado ────────────────────────────────
ALTER TABLE `threads` ADD `lockedAt` timestamp;
