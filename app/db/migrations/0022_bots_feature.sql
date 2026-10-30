-- Bots feature: tables for server bots with triggers, actions, visual flow editor, and execution history

-- bots: main bot configuration per server
CREATE TABLE IF NOT EXISTS `bots` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `serverId` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(80) NOT NULL,
  `description` TEXT,
  `avatarUrl` TEXT,
  `mode` ENUM('simple', 'advanced') NOT NULL DEFAULT 'simple',
  `enabled` BOOLEAN NOT NULL DEFAULT TRUE,
  `code` TEXT,
  `nodesConfig` JSON,
  `createdByUserId` BIGINT UNSIGNED NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `bot_server_idx` (`serverId`),
  INDEX `bot_creator_idx` (`createdByUserId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- bot_triggers: event triggers for bots
CREATE TABLE IF NOT EXISTS `bot_triggers` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `botId` INT UNSIGNED NOT NULL,
  `type` VARCHAR(48) NOT NULL,
  `config` JSON,
  `condition` TEXT,
  `position` INT NOT NULL DEFAULT 0,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `bt_bot_idx` (`botId`),
  INDEX `bt_type_idx` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- bot_actions: actions executed when triggers fire
CREATE TABLE IF NOT EXISTS `bot_actions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `botId` INT UNSIGNED NOT NULL,
  `triggerId` INT UNSIGNED,
  `type` VARCHAR(48) NOT NULL,
  `config` JSON,
  `code` TEXT,
  `position` INT NOT NULL DEFAULT 0,
  `nextActionId` INT UNSIGNED,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `ba_bot_idx` (`botId`),
  INDEX `ba_trigger_idx` (`triggerId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- bot_nodes: visual nodes for React Flow editor
CREATE TABLE IF NOT EXISTS `bot_nodes` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `botId` INT UNSIGNED NOT NULL,
  `nodeType` ENUM('trigger', 'action', 'condition', 'delay', 'code', 'output') NOT NULL,
  `refType` VARCHAR(48),
  `positionX` INT NOT NULL DEFAULT 0,
  `positionY` INT NOT NULL DEFAULT 0,
  `data` JSON,
  `parentId` INT UNSIGNED,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `bn_bot_idx` (`botId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- bot_edges: connections between nodes in visual editor
CREATE TABLE IF NOT EXISTS `bot_edges` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `botId` INT UNSIGNED NOT NULL,
  `sourceNodeId` INT UNSIGNED NOT NULL,
  `targetNodeId` INT UNSIGNED NOT NULL,
  `sourceHandle` VARCHAR(32),
  `targetHandle` VARCHAR(32),
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `be_bot_idx` (`botId`),
  INDEX `be_source_idx` (`sourceNodeId`),
  INDEX `be_target_idx` (`targetNodeId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- bot_executions: execution history and audit log
CREATE TABLE IF NOT EXISTS `bot_executions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `botId` INT UNSIGNED NOT NULL,
  `triggerId` INT UNSIGNED,
  `triggerType` VARCHAR(48),
  `status` ENUM('success', 'failed', 'timeout', 'cancelled') NOT NULL,
  `context` JSON,
  `result` JSON,
  `error` TEXT,
  `startedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completedAt` TIMESTAMP,
  INDEX `bex_bot_idx` (`botId`),
  INDEX `bex_status_idx` (`status`),
  INDEX `bex_started_idx` (`startedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
