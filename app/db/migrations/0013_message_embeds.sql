CREATE TABLE `message_embeds` (
  `id` serial PRIMARY KEY,
  `messageId` bigint unsigned NOT NULL,
  `url` varchar(1000) NOT NULL,
  `provider` varchar(24) NOT NULL,
  `type` varchar(16) DEFAULT 'unknown' NOT NULL,
  `title` varchar(300),
  `description` varchar(600),
  `authorName` varchar(120),
  `authorUrl` varchar(500),
  `providerName` varchar(80),
  `thumbnailUrl` varchar(800),
  `playerUrl` varchar(800),
  `videoId` varchar(120),
  `position` int DEFAULT 0 NOT NULL,
  `status` enum('processing','ready','unsupported','failed') DEFAULT 'processing' NOT NULL,
  `fetchedAt` timestamp,
  `createdAt` timestamp DEFAULT now() NOT NULL,
  `updatedAt` timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX `embed_message_idx` ON `message_embeds` (`messageId`);--> statement-breakpoint
CREATE INDEX `embed_url_idx` ON `message_embeds` (`url`(191));
