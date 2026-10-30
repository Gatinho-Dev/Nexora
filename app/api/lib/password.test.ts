import { describe, expect, it } from "vitest";
import { randomBytes, scryptSync } from "node:crypto";
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  passwordHashNeedsUpgrade,
  verifyPassword,
} from "./password";

describe("password hashing", () => {
  it("hashes and verifies new passwords with a versioned format", () => {
    const stored = hashPassword("correct horse battery staple");
    expect(stored).toMatch(/^scrypt\$v1\$/);
    expect(verifyPassword("correct horse battery staple", stored)).toBe(true);
    expect(verifyPassword("wrong password", stored)).toBe(false);
    expect(passwordHashNeedsUpgrade(stored)).toBe(false);
  });

  it("keeps verifying legacy salt:hash passwords", () => {
    const salt = randomBytes(16).toString("hex");
    const digest = scryptSync("legacy password", salt, 64).toString("hex");
    const stored = `${salt}:${digest}`;
    expect(verifyPassword("legacy password", stored)).toBe(true);
    expect(verifyPassword("not the password", stored)).toBe(false);
    expect(passwordHashNeedsUpgrade(stored)).toBe(true);
  });

  it("rejects malformed and tampered values", () => {
    expect(verifyPassword("password", "not-a-hash")).toBe(false);
    expect(verifyPassword("password", "scrypt$v1$salt$not-hex")).toBe(false);
    expect(verifyPassword("password", `${DUMMY_PASSWORD_HASH}tampered`)).toBe(false);
  });
});
