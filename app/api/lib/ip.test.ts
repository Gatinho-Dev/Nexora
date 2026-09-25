import { describe, expect, it } from "vitest";
import { getClientIp } from "./ip";

describe("getClientIp", () => {
  it("uses the first public address from a proxy chain", () => {
    const headers = new Headers({
      "x-forwarded-for": "10.0.0.8, 203.0.113.42, 198.51.100.7",
    });
    expect(getClientIp(headers)).toBe("203.0.113.42");
  });

  it("falls back to a valid direct address and rejects malformed values", () => {
    expect(
      getClientIp(new Headers({ "x-real-ip": "::ffff:198.51.100.9" })),
    ).toBe("198.51.100.9");
    expect(getClientIp(new Headers({ "x-real-ip": "not-an-ip" }))).toBeNull();
    expect(getClientIp(new Headers())).toBeNull();
  });
});
