import { describe, expect, it } from "vitest";
import {
  buildTotpUri,
  decodeBase32,
  encodeBase32,
  generateBackupCodes,
  hashBackupCode,
  totpAtStep,
  verifyBackupCode,
  verifyTotp,
} from "./mfa";

describe("TOTP", () => {
  it("round-trips base32 secrets", () => {
    const source = Buffer.from("Nexora MFA secret", "utf8");
    expect(decodeBase32(encodeBase32(source))).toEqual(source);
  });

  it("matches the six-digit suffix of the RFC 6238 SHA-1 vector", () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    expect(totpAtStep(secret, 1)).toBe("287082");
    expect(verifyTotp(secret, "287082", { now: 59_000, window: 0 })).toEqual({
      valid: true,
      step: 1,
    });
  });

  it("accepts clock drift but rejects replayed and malformed codes", () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    const code = totpAtStep(secret, 10);
    expect(verifyTotp(secret, code, { now: 11 * 30_000, window: 1 }).valid).toBe(true);
    expect(verifyTotp(secret, code, { now: 10 * 30_000, minStepExclusive: 10 })).toEqual({ valid: false, step: null });
    expect(verifyTotp(secret, "abc123")).toEqual({ valid: false, step: null });
  });

  it("builds a standards-compatible provisioning URI", () => {
    const uri = buildTotpUri({ secret: "ABC234", username: "daniel@example.com" });
    expect(uri).toContain("otpauth://totp/Nexora%3Adaniel%40example.com");
    expect(uri).toContain("algorithm=SHA1&digits=6&period=30");
  });
});

describe("backup codes", () => {
  it("generates unique one-time-code shaped values", () => {
    const codes = generateBackupCodes(20);
    expect(new Set(codes).size).toBe(20);
    expect(codes.every(code => /^[A-F0-9]{5}-[A-F0-9]{5}$/.test(code))).toBe(true);
  });

  it("stores salted hashes and verifies normalized input", () => {
    const stored = hashBackupCode("ABCDE-12345");
    expect(stored).not.toContain("ABCDE12345");
    expect(verifyBackupCode("abcde 12345", stored)).toBe(true);
    expect(verifyBackupCode("ABCDE-99999", stored)).toBe(false);
  });
});
