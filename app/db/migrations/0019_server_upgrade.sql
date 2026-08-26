-- Evolução do sistema de servidores — 100% aditiva.
-- Nada é apagado; sessões/servidores/canais/mensagens permanecem intactos.

ALTER TABLE `channels`
  ADD COLUMN `slowmodeSeconds` int NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `server_members`
  ADD COLUMN `timeoutUntil` timestamp,
  ADD COLUMN `timeoutReason` varchar(200);
--> statement-breakpoint
ALTER TABLE `roles`
  ADD COLUMN `hoist` boolean NOT NULL DEFAULT false,
  ADD COLUMN `mentionable` boolean NOT NULL DEFAULT true;
--> statement-breakpoint
CREATE TABLE `server_audit_logs` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`serverId` bigint unsigned NOT NULL,
	`actorUserId` bigint unsigned NOT NULL,
	`action` varchar(48) NOT NULL,
	`targetType` varchar(24),
	`targetId` bigint unsigned,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `server_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `sal_server_idx` ON `server_audit_logs` (`serverId`,`id`);
--> statement-breakpoint
CREATE INDEX `sal_action_idx` ON `server_audit_logs` (`serverId`,`action`);
