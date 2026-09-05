import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_PERIOD_SECONDS = 30;

export function encodeBase32(input: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}

export function decodeBase32(value: string): Buffer {
  const clean = value.toUpperCase().replace(/=+$/g, "").replace(/\s+/g, "");
  let bits = 0;
  let buffer = 0;
  const bytes: number[] = [];
  for (const character of clean) {
    const index = BASE32.indexOf(character);
    if (index < 0) throw new Error("Segredo TOTP inválido.");
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return encodeBase32(randomBytes(20));
}

export function totpAtStep(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac("sha1", decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

export function verifyTotp(
  secret: string,
  code: string,
  options: { now?: number; window?: number; minStepExclusive?: number } = {},
): { valid: boolean; step: number | null } {
  const normalized = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalized)) return { valid: false, step: null };
  const currentStep = Math.floor(
    (options.now ?? Date.now()) / 1000 / TOTP_PERIOD_SECONDS,
  );
  const window = options.window ?? 1;
  for (let delta = -window; delta <= window; delta += 1) {
    const step = currentStep + delta;
    if (step <= (options.minStepExclusive ?? -1)) continue;
    const expected = Buffer.from(totpAtStep(secret, step));
    const candidate = Buffer.from(normalized);
    if (
      expected.length === candidate.length &&
      timingSafeEqual(expected, candidate)
    ) {
      return { valid: true, step };
    }
  }
  return { valid: false, step: null };
}

export function buildTotpUri(input: {
  secret: string;
  username: string;
  issuer?: string;
}): string {
  const issuer = input.issuer ?? "Nexora";
  const label = encodeURIComponent(`${issuer}:${input.username}`);
  return `otpauth://totp/${label}?secret=${encodeURIComponent(input.secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${TOTP_PERIOD_SECONDS}`;
}

export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const raw = randomBytes(5).toString("hex").toUpperCase();
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

export function hashBackupCode(code: string): string {
  const salt = randomBytes(16).toString("base64url");
  const normalized = code.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const digest = scryptSync(normalized, salt, 32).toString("base64url");
  return `scrypt$${salt}$${digest}`;
}

export function verifyBackupCode(code: string, stored: string): boolean {
  const [algorithm, salt, digest] = stored.split("$");
  if (algorithm !== "scrypt" || !salt || !digest) return false;
  const normalized = code.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const candidate = scryptSync(normalized, salt, 32);
  const expected = Buffer.from(digest, "base64url");
  return (
    candidate.length === expected.length && timingSafeEqual(candidate, expected)
  );
}
