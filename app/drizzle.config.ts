import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

if (process.env.NODE_ENV !== "production") {
  config();
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

if (process.env.NODE_ENV === "production") {
  const hostname = new URL(connectionString).hostname.toLowerCase();
  if (["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"].includes(hostname)) {
    throw new Error(
      "DATABASE_URL points to localhost. Configure Render with a reachable managed MySQL URL before running migrations.",
    );
  }
}

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "mysql",
  dbCredentials: {
    url: connectionString,
  },
});
