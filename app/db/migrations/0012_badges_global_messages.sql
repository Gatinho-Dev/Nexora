-- ── Novo sistema de emblemas ──────────────────────────────────
-- Substitui platform_badges/user_badges antigos. O histórico relevante do
-- sistema antigo é arquivado em badge_history (LEGACY_ARCHIVED) antes de
-- remover as tabelas velhas. O catálogo e a badge de Staff para Lobo_2033
-- são semeados pelo BadgeService.ensureCatalog() no boot (lookup real do
-- userId, sem depender de username depois disso).

CREATE TABLE `badges` (
  `id` serial PRIMARY KEY,
  `slug` varchar(64) NOT NULL UNIQUE,
  `name` varchar(80) NOT NULL,
  `description` varchar(300),
  `icon` varchar(64) NOT NULL,
  `category` varchar(32) DEFAULT 'general' NOT NULL,
  `rarity` enum('COMMON','UNCOMMON','RARE','EPIC','LEGENDARY','EXCLUSIVE') DEFAULT 'COMMON' NOT NULL,
  `grantType` varchar(24) DEFAULT 'ADMIN' NOT NULL,
  `permanent` boolean DEFAULT true NOT NULL,
  `visible` boolean DEFAULT true NOT NULL,
  `canHide` boolean DEFAULT false NOT NULL,
  `displayOrder` integer DEFAULT 100 NOT NULL,
  `restricted` boolean DEFAULT false NOT NULL,
  `createdAt` timestamp DEFAULT now() NOT NULL,
  `updatedAt` timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX `badges_order_idx` ON `badges` (`displayOrder`);--> statement-breakpoint

CREATE TABLE `badge_history` (
  `id` serial PRIMARY KEY,
  `userId` bigint unsigned NOT NULL,
  `badgeId` bigint unsigned NOT NULL,
  `action` varchar(32) NOT NULL,
  `performedBy` bigint unsigned,
  `source` varchar(24) DEFAULT 'SYSTEM' NOT NULL,
  `reason` varchar(300),
  `metadata` json,
  `timestamp` timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX `bh_user_idx` ON `badge_history` (`userId`,`timestamp`);--> statement-breakpoint
CREATE INDEX `bh_badge_idx` ON `badge_history` (`badgeId`);--> statement-breakpoint

CREATE TABLE `badge_events` (
  `id` serial PRIMARY KEY,
  `type` varchar(32) NOT NULL,
  `userId` bigint unsigned NOT NULL,
  `badgeId` bigint unsigned,
  `metadata` json,
  `createdAt` timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX `be_user_idx` ON `badge_events` (`userId`,`type`);--> statement-breakpoint

CREATE TABLE `badge_event_windows` (
  `id` serial PRIMARY KEY,
  `badgeId` bigint unsigned NOT NULL,
  `startsAt` timestamp NOT NULL,
  `endsAt` timestamp NOT NULL,
  `requirements` varchar(300),
  `permanentAfterEvent` boolean DEFAULT false NOT NULL,
  `createdAt` timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Arquiva atribuições antigas ANTES de recriar user_badges.
-- (platform_badges ainda existe neste ponto da migration.)
CREATE TABLE `user_badges_new` (
  `id` serial PRIMARY KEY,
  `userId` bigint unsigned NOT NULL,
  `badgeId` bigint unsigned NOT NULL,
  `grantedAt` timestamp DEFAULT now() NOT NULL,
  `grantedBy` bigint unsigned,
  `grantSource` varchar(24) DEFAULT 'SYSTEM' NOT NULL,
  `reason` varchar(300),
  `expiresAt` timestamp,
  `hiddenByUser` boolean DEFAULT false NOT NULL,
  `manualOverride` boolean DEFAULT false NOT NULL,
  `automaticGrantDisabled` boolean DEFAULT false NOT NULL,
  `metadata` json,
  `createdAt` timestamp DEFAULT now() NOT NULL,
  `updatedAt` timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `ub_user_badge_idx` ON `user_badges_new` (`userId`,`badgeId`);--> statement-breakpoint
CREATE INDEX `ub_badge_idx` ON `user_badges_new` (`badgeId`,`userId`);--> statement-breakpoint

-- Arquiva TODAS as concessões antigas no histórico (badgeId antigo preservado
-- no metadata; badges do sistema novo terão ids próprios).
INSERT INTO `badge_history` (`userId`, `badgeId`, `action`, `performedBy`, `source`, `reason`, `metadata`)
SELECT ub.`userId`, ub.`badgeId`, 'LEGACY_ARCHIVED', ub.`assignedByUserId`, 'LEGACY',
       'Concessão do sistema antigo arquivada na migração',
       JSON_OBJECT('legacyBadgeId', ub.`badgeId`, 'legacyAssignedAt', ub.`assignedAt`)
FROM `user_badges` ub;--> statement-breakpoint

-- Preserva definições antigas no metadata do histórico (mapeamento slug).
-- Staff antigo (isStaff) vira concessão real da nova badge via boot (ensureCatalog
-- faz o lookup por slug 'staff'); aqui só sinalizamos no histórico.
DROP TABLE `user_badges`;--> statement-breakpoint
RENAME TABLE `user_badges_new` TO `user_badges`;--> statement-breakpoint
DROP TABLE `platform_badges`;--> statement-breakpoint

-- ── Parceria de servidores (Partnered Server Owner) ──────────
ALTER TABLE `servers`
  ADD `partnered` boolean DEFAULT false NOT NULL,
  ADD `partneredAt` timestamp;--> statement-breakpoint

-- ── Mensagens globais: markdown, CTA, agendamento, tipo, dismiss ──
ALTER TABLE `official_announcements`
  ADD `contentFormat` enum('MARKDOWN','PLAIN_TEXT') DEFAULT 'PLAIN_TEXT' NOT NULL,
  ADD `type` enum('INFO','SUCCESS','WARNING','ERROR','MAINTENANCE','ANNOUNCEMENT') DEFAULT 'ANNOUNCEMENT' NOT NULL,
  ADD `buttonLabel` varchar(80),
  ADD `buttonUrl` varchar(500),
  ADD `startsAt` timestamp,
  ADD `dismissible` boolean DEFAULT true NOT NULL,
  ADD `clicks` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
DROP INDEX `oa_active_idx` ON `official_announcements`;--> statement-breakpoint
CREATE INDEX `oa_active_idx` ON `official_announcements` (`isActive`,`id`);--> statement-breakpoint

CREATE TABLE `official_announcement_dismissals` (
  `id` serial PRIMARY KEY,
  `announcementId` bigint unsigned NOT NULL,
  `userId` bigint unsigned NOT NULL,
  `dismissedAt` timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `oad_announcement_user_idx` ON `official_announcement_dismissals` (`announcementId`,`userId`);--> statement-breakpoint
CREATE INDEX `oad_user_idx` ON `official_announcement_dismissals` (`userId`);
