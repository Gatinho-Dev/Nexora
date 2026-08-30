import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";
import { env } from "./lib/env";

const pool = mysql.createPool(env.databaseUrl);

const SERVER_SETTINGS_MIGRATION = "0021_server_settings_control_center.sql";
const SERVER_SETTINGS_MIGRATION_TIMESTAMP = 1788486000000;

async function queryExists(sql: string, params: unknown[]) {
  const [rows] = await pool.query(sql, params);
  return Array.isArray(rows) && rows.length > 0;
}

async function tableExists(tableName: string) {
  return queryExists(
    "SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1",
    [tableName],
  );
}

async function columnExists(tableName: string, columnName: string) {
  return queryExists(
    "SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1",
    [tableName, columnName],
  );
}

async function indexExists(tableName: string, indexName: string) {
  return queryExists(
    "SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1",
    [tableName, indexName],
  );
}

async function ensureColumn(tableName: string, columnName: string, definition: string) {
  if (!await columnExists(tableName, columnName)) {
    await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
  }
}

async function ensureIndex(tableName: string, indexName: string, columns: string) {
  if (!await indexExists(tableName, indexName)) {
    await pool.query(`CREATE INDEX \`${indexName}\` ON \`${tableName}\` (${columns})`);
  }
}

/**
 * TiDB DDL is not rolled back with the migration transaction. A previous deploy
 * can therefore leave 0021 only partially applied. Complete that known migration
 * before Drizzle runs, then record its exact hash so it is not executed again.
 */
async function recoverIncompleteServerSettingsMigration(migrationsFolder: string) {
  if (!await tableExists("__drizzle_migrations")) return;

  const migrationPath = path.join(migrationsFolder, SERVER_SETTINGS_MIGRATION);
  const migrationHash = createHash("sha256")
    .update(await readFile(migrationPath))
    .digest("hex");
  const [appliedRows] = await pool.query(
    "SELECT 1 FROM __drizzle_migrations WHERE hash = ? LIMIT 1",
    [migrationHash],
  );
  if (Array.isArray(appliedRows) && appliedRows.length > 0) return;

  const hasPartialSchema = await columnExists("servers", "tags")
    || await columnExists("servers", "verificationLevel")
    || await columnExists("server_members", "timeoutUntil")
    || await tableExists("server_notification_preferences")
    || await tableExists("server_audit_logs");
  if (!hasPartialSchema) return;

  await ensureColumn("servers", "tags", "json");
  await ensureColumn("servers", "verificationLevel", "enum('none','low','medium','high','maximum') NOT NULL DEFAULT 'none'");
  await ensureColumn("servers", "defaultNotifications", "enum('all','mentions') NOT NULL DEFAULT 'all'");
  await ensureColumn("servers", "invitesPaused", "boolean NOT NULL DEFAULT false");
  await ensureColumn("servers", "rulesEnabled", "boolean NOT NULL DEFAULT false");
  await ensureColumn("servers", "rules", "json");
  await ensureColumn("servers", "communityEnabled", "boolean NOT NULL DEFAULT false");
  await pool.query("UPDATE `servers` SET `tags` = JSON_ARRAY(), `rules` = JSON_ARRAY() WHERE `tags` IS NULL OR `rules` IS NULL");
  await pool.query("ALTER TABLE `servers` MODIFY COLUMN `tags` json NOT NULL, MODIFY COLUMN `rules` json NOT NULL");

  await ensureColumn("server_members", "timeoutUntil", "timestamp NULL");
  await ensureColumn("server_members", "rulesAcceptedAt", "timestamp NULL");
  await ensureColumn("server_members", "lastActiveAt", "timestamp NULL");
  await ensureColumn("roles", "hoistMembers", "boolean NOT NULL DEFAULT false");
  await ensureColumn("roles", "mentionable", "boolean NOT NULL DEFAULT false");
  await ensureColumn("invites", "revokedAt", "timestamp NULL");

  if (!await tableExists("server_notification_preferences")) {
    await pool.query(`CREATE TABLE \`server_notification_preferences\` (
      \`id\` serial AUTO_INCREMENT NOT NULL,
      \`serverId\` bigint unsigned NOT NULL,
      \`userId\` bigint unsigned NOT NULL,
      \`level\` enum('all','mentions','none') NOT NULL DEFAULT 'mentions',
      \`mutedUntil\` timestamp NULL,
      \`suppressEveryone\` boolean NOT NULL DEFAULT false,
      \`suppressRoles\` boolean NOT NULL DEFAULT false,
      \`updatedAt\` timestamp NOT NULL DEFAULT (now()),
      CONSTRAINT \`server_notification_preferences_id\` PRIMARY KEY(\`id\`),
      CONSTRAINT \`snp_server_user_uniq\` UNIQUE(\`serverId\`,\`userId\`)
    )`);
  }
  await ensureColumn("server_notification_preferences", "level", "enum('all','mentions','none') NOT NULL DEFAULT 'mentions'");
  await ensureColumn("server_notification_preferences", "mutedUntil", "timestamp NULL");
  await ensureColumn("server_notification_preferences", "suppressEveryone", "boolean NOT NULL DEFAULT false");
  await ensureColumn("server_notification_preferences", "suppressRoles", "boolean NOT NULL DEFAULT false");
  await ensureColumn("server_notification_preferences", "updatedAt", "timestamp NOT NULL DEFAULT (now())");
  await ensureIndex("server_notification_preferences", "snp_user_idx", "`userId`");

  if (!await tableExists("server_audit_logs")) {
    await pool.query(`CREATE TABLE \`server_audit_logs\` (
      \`id\` serial AUTO_INCREMENT NOT NULL,
      \`serverId\` bigint unsigned NOT NULL,
      \`actorUserId\` bigint unsigned NOT NULL,
      \`action\` varchar(64) NOT NULL,
      \`targetType\` varchar(48) NOT NULL,
      \`targetId\` bigint unsigned,
      \`targetUserId\` bigint unsigned,
      \`reason\` varchar(500),
      \`metadata\` json,
      \`createdAt\` timestamp NOT NULL DEFAULT (now()),
      CONSTRAINT \`server_audit_logs_id\` PRIMARY KEY(\`id\`)
    )`);
  }
  await ensureColumn("server_audit_logs", "targetId", "bigint unsigned");
  await ensureColumn("server_audit_logs", "targetUserId", "bigint unsigned");
  await ensureColumn("server_audit_logs", "reason", "varchar(500)");
  await ensureColumn("server_audit_logs", "metadata", "json");
  await ensureIndex("server_audit_logs", "sal_server_idx", "`serverId`,`id`");
  await ensureIndex("server_audit_logs", "sal_actor_idx", "`actorUserId`,`id`");
  await ensureIndex("server_audit_logs", "sal_target_idx", "`targetUserId`,`id`");

  await pool.query(
    "INSERT INTO __drizzle_migrations (`hash`, `created_at`) VALUES (?, ?)",
    [migrationHash, SERVER_SETTINGS_MIGRATION_TIMESTAMP],
  );
  console.log("[database] Recovered incomplete server settings migration.");
}

try {
  const db = drizzle(pool);
  const migrationsFolder = fileURLToPath(
    new URL("./migrations", import.meta.url)
  );

  await recoverIncompleteServerSettingsMigration(migrationsFolder);
  await migrate(db, { 
  migrationsFolder, 
  baseline: "0004_account_safety_moderation" 
});
  console.log("[database] Migrations are up to date.");
} finally {
  await pool.end();
}
