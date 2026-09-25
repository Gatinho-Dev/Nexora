import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const PASSWORD_SCHEME = "scrypt$v1$";
const SCRYPT_KEY_LENGTH = 64;
const SALT_BYTES = 16;

export const DUMMY_PASSWORD_HASH =
  "scrypt$v1$d7bcc69edc32f62c1d4335dc3e9b4834$4fac9f8c7ac01b51013507c86c025b8ed9c4de92bbdb1aeed6ac754d967e034f99c126148191ecf4187247d5bfb88089ce55b17b6532bbde57df1c06593376f9";

function deriveKey(password: string, salt: string): Buffer {
  return scryptSync(password, salt, SCRYPT_KEY_LENGTH);
}

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const digest = deriveKey(password, salt).toString("hex");
  return `${PASSWORD_SCHEME}${salt}$${digest}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.startsWith(PASSWORD_SCHEME)
    ? stored.slice(PASSWORD_SCHEME.length).split("$")
    : stored.split(":");
  if (parts.length !== 2) return false;
  const [salt, encodedDigest] = parts;
  if (!salt || !encodedDigest || !/^[0-9a-f]+$/i.test(encodedDigest)) return false;
  const expected = Buffer.from(encodedDigest, "hex");
  if (expected.length !== SCRYPT_KEY_LENGTH) return false;
  const candidate = deriveKey(password, salt);
  return timingSafeEqual(candidate, expected);
}

export function passwordHashNeedsUpgrade(stored: string): boolean {
  return !stored.startsWith(PASSWORD_SCHEME);
}
