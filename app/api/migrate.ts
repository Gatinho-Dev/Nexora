import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";
import { env } from "./lib/env";

const pool = mysql.createPool(env.databaseUrl);

try {
  const db = drizzle(pool);
  const migrationsFolder = fileURLToPath(
    new URL("./migrations", import.meta.url)
  );

  await migrate(db, { migrationsFolder });
  console.log("[database] Migrations are up to date.");
} finally {
  await pool.end();
}
