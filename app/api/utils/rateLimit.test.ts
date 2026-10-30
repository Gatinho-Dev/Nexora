import { describe, expect, it } from "vitest";
import { rateLimit } from "./rateLimit";

describe("rateLimit", () => {
  it("blocks requests after the configured window budget", () => {
    const key = `test:rate-limit:${Date.now()}:${Math.random()}`;
    rateLimit(key, 2, 60_000);
    rateLimit(key, 2, 60_000);
    expect(() => rateLimit(key, 2, 60_000)).toThrow(
      "Você está fazendo isso rápido demais",
    );
  });

  it("keeps independent buckets independent", () => {
    const suffix = `${Date.now()}:${Math.random()}`;
    rateLimit(`test:rate-limit:a:${suffix}`, 1, 60_000);
    expect(() => rateLimit(`test:rate-limit:b:${suffix}`, 1, 60_000)).not.toThrow();
  });
});
