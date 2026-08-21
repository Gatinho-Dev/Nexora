import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "mysql",
  ...(connectionString
    ? {
        dbCredentials: {
          url: connectionString,
        },
      }
    : {}),
});
