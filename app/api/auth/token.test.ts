import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { env } from "../lib/env";
import { signSessionToken, verifySessionToken } from "./token";

const originalSecret = env.appSecret;

beforeEach(() => {
  env.appSecret = "test-secret-with-enough-entropy-for-session-tests";
});

afterEach(() => {
  env.appSecret = originalSecret;
});

describe("session tokens", () => {
  it("signs and verifies a session-bound token", async () => {
    const token = await signSessionToken({
      unionId: "local:user-1",
      clientId: "nexora",
      sid: "session-123",
    });
    await expect(verifySessionToken(token)).resolves.toEqual({
      unionId: "local:user-1",
      clientId: "nexora",
      sid: "session-123",
    });
  });

  it("rejects tampered and legacy tokens without a session id", async () => {
    const token = await signSessionToken({
      unionId: "local:user-1",
      clientId: "nexora",
      sid: "session-123",
    });
    await expect(verifySessionToken(`${token}tampered`)).resolves.toBeNull();
    await expect(verifySessionToken("not-a-jwt")).resolves.toBeNull();
  });
});
