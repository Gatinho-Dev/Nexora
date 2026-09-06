import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "./env";

/**
 * Criptografia simétrica para tokens de integrações em repouso.
 * Chave derivada do APP_SECRET (AES-256-GCM). Nunca logar output/input.
 */

function key(): Buffer {
  return createHash("sha256").update(`nexora-integr:${env.appSecret}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${enc.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}`;
}

export function decryptSecret(payload: string): string | null {
  try {
    const [ivB64, dataB64, tagB64] = payload.split(".");
    if (!ivB64 || !dataB64 || !tagB64) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
