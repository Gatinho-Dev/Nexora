ALTER TABLE `messages` ADD `clientNonce` varchar(64);
--> statement-breakpoint
CREATE UNIQUE INDEX `msg_author_nonce_uniq` ON `messages` (`authorId`,`clientNonce`);
