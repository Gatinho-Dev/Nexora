import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";
import { env } from "./lib/env";

const pool = mysql.createPool(env.databaseUrl);

const PRIVATE_INBOX_MIGRATION = "0018_private_inbox_preferences.sql";
const PRIVATE_INBOX_MIGRATION_TIMESTAMP = 1788399600000;
const SERVER_SETTINGS_MIGRATION = "0019_server_settings_control_center.sql";
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

async function ensureUniqueIndex(tableName: string, indexName: string, columns: string) {
  if (!await indexExists(tableName, indexName)) {
    await pool.query(`CREATE UNIQUE INDEX \`${indexName}\` ON \`${tableName}\` (${columns})`);
  }
}

/**
 * The private-inbox SQL file was added after newer migrations had already been
 * recorded in production. Drizzle orders migrations by timestamp, so those
 * databases can legitimately skip 0018 and leave dm.list querying a table that
 * does not exist. Reconcile the required schema before the application starts.
 */
async function recoverPrivateInboxMigration(migrationsFolder: string) {
  if (!await tableExists("__drizzle_migrations")) return;

  const migrationPath = path.join(migrationsFolder, PRIVATE_INBOX_MIGRATION);
  const migrationHash = createHash("sha256")
    .update(await readFile(migrationPath))
    .digest("hex");
  const migrationApplied = await queryExists(
    "SELECT 1 FROM __drizzle_migrations WHERE hash = ? LIMIT 1",
    [migrationHash],
  );

  // These columns belong to the conversation model consumed by dm.list. Keep
  // them here as well because an interrupted older group migration can leave
  // the table usable for basic DMs but incompatible with the current query.
  await ensureColumn("conversation_members", "role", "enum('owner','admin','member') NOT NULL DEFAULT 'member'");
  await ensureColumn("conversation_members", "nickname", "varchar(64)");
  await ensureColumn("conversation_members", "mutedUntil", "timestamp NULL");
  await ensureColumn("conversation_members", "notificationLevel", "enum('all','mentions','muted') NOT NULL DEFAULT 'all'");

  if (!await tableExists("conversation_preferences")) {
    await pool.query(`CREATE TABLE \`conversation_preferences\` (
      \`id\` serial AUTO_INCREMENT NOT NULL,
      \`conversationId\` bigint unsigned NOT NULL,
      \`userId\` bigint unsigned NOT NULL,
      \`pinnedAt\` timestamp NULL,
      \`hiddenAt\` timestamp NULL,
      \`mutedUntil\` timestamp NULL,
      \`mutedForever\` boolean NOT NULL DEFAULT false,
      \`requestState\` enum('pending','accepted','ignored','spam'),
      \`privateNote\` text,
      \`friendNickname\` varchar(64),
      \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE NOW(),
      CONSTRAINT \`conversation_preferences_id\` PRIMARY KEY(\`id\`),
      CONSTRAINT \`cp_user_conversation_uniq\` UNIQUE(\`userId\`,\`conversationId\`)
    )`);
  }
  await ensureColumn("conversation_preferences", "pinnedAt", "timestamp NULL");
  await ensureColumn("conversation_preferences", "hiddenAt", "timestamp NULL");
  await ensureColumn("conversation_preferences", "mutedUntil", "timestamp NULL");
  await ensureColumn("conversation_preferences", "mutedForever", "boolean NOT NULL DEFAULT false");
  await ensureColumn("conversation_preferences", "requestState", "enum('pending','accepted','ignored','spam')");
  await ensureColumn("conversation_preferences", "privateNote", "text");
  await ensureColumn("conversation_preferences", "friendNickname", "varchar(64)");
  await ensureColumn("conversation_preferences", "updatedAt", "timestamp NOT NULL DEFAULT (now()) ON UPDATE NOW()");
  if (!await indexExists("conversation_preferences", "cp_user_conversation_uniq")) {
    await pool.query(`DELETE older FROM \`conversation_preferences\` older
      INNER JOIN \`conversation_preferences\` newer
        ON older.\`userId\` = newer.\`userId\`
        AND older.\`conversationId\` = newer.\`conversationId\`
        AND older.\`id\` < newer.\`id\``);
  }
  await ensureUniqueIndex("conversation_preferences", "cp_user_conversation_uniq", "`userId`,`conversationId`");
  await ensureIndex("conversation_preferences", "cp_user_pinned_idx", "`userId`,`pinnedAt`");

  if (await tableExists("channel_reads")) {
    const needsChannelIndex = !await indexExists("channel_reads", "cr_user_channel_uniq");
    const needsConversationIndex = !await indexExists("channel_reads", "cr_user_conversation_uniq");
    if (needsChannelIndex || needsConversationIndex) {
      await pool.query(`DELETE older FROM \`channel_reads\` older
        INNER JOIN \`channel_reads\` newer
          ON older.\`userId\` = newer.\`userId\`
          AND (
            (older.\`channelId\` IS NOT NULL AND older.\`channelId\` = newer.\`channelId\`)
            OR (older.\`conversationId\` IS NOT NULL AND older.\`conversationId\` = newer.\`conversationId\`)
          )
          AND (
            older.\`lastReadMessageId\` < newer.\`lastReadMessageId\`
            OR (older.\`lastReadMessageId\` = newer.\`lastReadMessageId\` AND older.\`id\` < newer.\`id\`)
          )`);
    }
    await ensureUniqueIndex("channel_reads", "cr_user_channel_uniq", "`userId`,`channelId`");
    await ensureUniqueIndex("channel_reads", "cr_user_conversation_uniq", "`userId`,`conversationId`");
  }

  if (!migrationApplied) {
    await pool.query(
      "INSERT INTO __drizzle_migrations (`hash`, `created_at`) VALUES (?, ?)",
      [migrationHash, PRIVATE_INBOX_MIGRATION_TIMESTAMP],
    );
    console.log("[database] Recovered skipped private inbox migration.");
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
  const bundledMigrationsFolder = fileURLToPath(
    new URL("./migrations", import.meta.url),
  );
  const sourceMigrationsFolder = fileURLToPath(
    new URL("../db/migrations", import.meta.url),
  );
  const migrationsFolder = existsSync(bundledMigrationsFolder)
    ? bundledMigrationsFolder
    : sourceMigrationsFolder;

  await recoverPrivateInboxMigration(migrationsFolder);
  await recoverIncompleteServerSettingsMigration(migrationsFolder);
  await migrate(db, { migrationsFolder });
  console.log("[database] Migrations are up to date.");
} finally {
  await pool.end();
}
