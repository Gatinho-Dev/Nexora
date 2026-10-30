CREATE TABLE `discovery_categories` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `slug` varchar(32) NOT NULL,
  `name` varchar(64) NOT NULL,
  `icon` varchar(32) NOT NULL DEFAULT 'sparkles',
  `position` int NOT NULL DEFAULT 0,
  `active` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `discovery_categories_id` PRIMARY KEY(`id`),
  UNIQUE KEY `discovery_category_slug_uniq` (`slug`),
  KEY `discovery_category_position_idx` (`active`, `position`)
);
--> statement-breakpoint
ALTER TABLE `servers`
  ADD COLUMN `publicDiscovery` boolean NOT NULL DEFAULT false,
  ADD COLUMN `isFeatured` boolean NOT NULL DEFAULT false,
  ADD COLUMN `discoveryCategoryId` bigint unsigned NULL;
--> statement-breakpoint
CREATE INDEX `srv_discovery_idx` ON `servers` (`publicDiscovery`, `isFeatured`, `createdAt`, `id`);
--> statement-breakpoint
CREATE INDEX `srv_discovery_category_idx` ON `servers` (`discoveryCategoryId`, `publicDiscovery`);
--> statement-breakpoint
INSERT INTO `discovery_categories` (`slug`, `name`, `icon`, `position`)
VALUES
  ('jogos', 'Jogos', 'gamepad-2', 10),
  ('musica', 'Música', 'music-2', 20),
  ('entretenimento', 'Entretenimento', 'clapperboard', 30),
  ('tecnologia', 'Ciência e Tecnologia', 'cpu', 40),
  ('educacao', 'Educação', 'graduation-cap', 50),
  ('arte-design', 'Arte e Design', 'palette', 60),
  ('social', 'Social', 'messages-square', 70),
  ('esportes', 'Esportes', 'trophy', 80),
  ('comunidades', 'Comunidades', 'globe-2', 90),
  ('estudos', 'Estudos', 'book-open', 100),
  ('criadores', 'Criadores', 'video', 110),
  ('programacao', 'Programação', 'code-2', 120)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `icon` = VALUES(`icon`),
  `position` = VALUES(`position`),
  `active` = true;
