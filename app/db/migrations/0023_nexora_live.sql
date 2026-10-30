CREATE TABLE `live_rooms` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`roomCode` varchar(8) NOT NULL,
	`hostTokenHash` varchar(64),
	`hostSessionId` varchar(64),
	`status` enum('active','expired') DEFAULT 'active' NOT NULL,
	`maxParticipants` int NOT NULL,
	`createdAt` timestamp DEFAULT (now()) NOT NULL,
	`lastActivityAt` timestamp DEFAULT (now()) NOT NULL,
	`expiresAt` timestamp,
	CONSTRAINT `live_rooms_id` PRIMARY KEY(`id`),
	CONSTRAINT `live_rooms_roomCode_unique` UNIQUE(`roomCode`)
);
--> statement-breakpoint
CREATE INDEX `live_rooms_status_idx` ON `live_rooms` (`status`,`lastActivityAt`);
