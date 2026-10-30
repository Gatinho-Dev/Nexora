import { afterEach, describe, expect, it } from "vitest";
import { env } from "./env";
import { getSessionCookieOptions } from "./cookies";

const originalProduction = env.isProduction;

afterEach(() => {
  env.isProduction = originalProduction;
});

describe("session cookie options", () => {
  it("uses secure SameSite settings in production", () => {
    env.isProduction = true;
    const options = getSessionCookieOptions(new Headers({ host: "nexorachat.cloud" }));
    expect(options.httpOnly).toBe(true);
    expect(options.secure).toBe(true);
    expect(options.sameSite).toBe("None");
  });

  it("allows local HTTP development on IPv4 and IPv6", () => {
    env.isProduction = false;
    for (const host of ["localhost:3000", "127.0.0.1:3000", "[::1]:3000"]) {
      const options = getSessionCookieOptions(new Headers({ host }));
      expect(options.secure).toBe(false);
      expect(options.sameSite).toBe("Lax");
    }
  });
});
