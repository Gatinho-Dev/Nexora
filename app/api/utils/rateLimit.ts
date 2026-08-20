import { TRPCError } from "@trpc/server";

// Simple in-memory sliding-window rate limiter.
// NOTE: single-process by design (MVP). Swap for Redis when scaling horizontally.
const buckets = new Map<string, number[]>();

// Periodically drop stale keys so the map doesn't grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [key, arr] of buckets) {
    const fresh = arr.filter((t) => now - t < 3_600_000);
    if (fresh.length === 0) buckets.delete(key);
    else buckets.set(key, fresh);
  }
}, 60_000).unref();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const arr = buckets.get(key) ?? [];
  const fresh = arr.filter((t) => now - t < windowMs);
  if (fresh.length >= limit) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Você está fazendo isso rápido demais. Aguarde alguns segundos e tente novamente.",
    });
  }
  fresh.push(now);
  buckets.set(key, fresh);
}
