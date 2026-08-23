import { config } from "dotenv";

// A production host (Render, Railway, Fly.io, etc.) injects its environment
// directly. Loading a developer's .env file there can silently point the
// service at localhost, which is inside the container and has no MySQL server.
if (process.env.NODE_ENV !== "production") {
  config();
}

function required(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

function validateDatabaseUrl(value: string): string {
  if (!value || process.env.NODE_ENV !== "production") return value;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      "DATABASE_URL must be a valid MySQL URL, for example mysql://user:password@host:3306/database",
    );
  }

  if (!["mysql:", "mysql2:", "mariadb:"].includes(url.protocol)) {
    throw new Error(
      `DATABASE_URL uses ${url.protocol} but Nexora currently requires a MySQL-compatible URL`,
    );
  }

  const hostname = url.hostname.toLowerCase();
  if (["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"].includes(hostname)) {
    throw new Error(
      "DATABASE_URL points to localhost. Render cannot reach a MySQL server running on your computer; set DATABASE_URL to a reachable managed MySQL instance and do not upload the local .env file as a production secret.",
    );
  }

  return value;
}

function csv(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
}

function numericCsv(name: string): number[] {
  return csv(name)
    .map(value => Number(value))
    .filter(value => Number.isSafeInteger(value) && value > 0);
}

const databaseUrl = validateDatabaseUrl(required("DATABASE_URL"));

export const env = {
  appId: required("APP_ID"),
  appSecret: required("APP_SECRET"),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl,
  kimiAuthUrl: required("KIMI_AUTH_URL"),
  kimiOpenUrl: required("KIMI_OPEN_URL"),
  ownerUnionId: process.env.OWNER_UNION_ID ?? "",
  ownerUnionIds: [process.env.OWNER_UNION_ID ?? "", ...csv("NEXORA_OWNER_UNION_IDS")]
    .filter(Boolean),
  ownerUserIds: numericCsv("NEXORA_OWNER_USER_IDS"),
  adminUnionIds: csv("NEXORA_ADMIN_UNION_IDS"),
  adminUserIds: numericCsv("NEXORA_ADMIN_USER_IDS"),
  appOrigin: process.env.APP_ORIGIN?.replace(/\/$/, "") ?? "",
  publicApiUrl: process.env.PUBLIC_API_URL?.replace(/\/$/, "") ?? "",
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? process.env.APP_ORIGIN ?? "")
    .split(",")
    .map(origin => origin.trim().replace(/\/$/, ""))
    .filter(Boolean),
};
