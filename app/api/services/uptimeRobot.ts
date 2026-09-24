/**
 * UptimeRobot — client for the API v2 (POST /v2/getMonitors).
 *
 * Docs: https://uptimerobot.com/api/
 * - Auth: `api_key` in the request body (account or read-only key).
 * - Free plan: 10 req/min → we cache for 60s and reuse one client.
 * - Response: { stat: "ok" | "fail", monitors: [...] }.
 *
 * The API key lives ONLY on the server (env). The client never sees it —
 * the admin UI talks to tRPC and this service does the outbound call.
 */
import { env } from "../lib/env";

const API_URL = "https://api.uptimerobot.com/v2/getMonitors";

/** UptimeRobot monitor statuses (numeric in the API). */
export type UptimeStatus =
  | "up"
  | "down"
  | "seems_down"
  | "paused"
  | "not_checked_yet";

export interface UptimeMonitor {
  id: number;
  friendlyName: string;
  url: string;
  type: number;
  typeLabel: string;
  /** Check interval in seconds. */
  interval: number;
  status: UptimeStatus;
  /** e.g. "99.98" over the requested window (7 days). */
  uptimeRatio: string | null;
  averageResponseTime: string | null;
  /** "1-7-30" requested → ["99.9", "99.85", "99.7"]. */
  customUptimeRatios: string[] | null;
  /** Response times of the last checks (ms), newest last. */
  responseTimes: Array<{ datetime: number; value: number }>;
}

/** Raw shape we depend on — tolerant to extra fields and nulls from the API. */
interface RawMonitor {
  id?: unknown;
  friendly_name?: unknown;
  url?: unknown;
  type?: unknown;
  interval?: unknown;
  status?: unknown;
  custom_uptime_ratio?: unknown;
  average_response_time?: unknown;
  response_times?: unknown;
}

const STATUS_MAP: Record<number, UptimeStatus> = {
  0: "paused",
  1: "not_checked_yet",
  2: "up",
  8: "seems_down",
  9: "down",
};

const TYPE_MAP: Record<number, string> = {
  1: "HTTP(s)",
  2: "Keyword",
  3: "Ping",
  4: "Port",
  5: "Heartbeat",
};

export function mapStatus(raw: unknown): UptimeStatus {
  const key = typeof raw === "string" ? Number.parseInt(raw, 10) : raw;
  return STATUS_MAP[key as number] ?? "not_checked_yet";
}

export function mapType(raw: unknown): string {
  const key = typeof raw === "string" ? Number.parseInt(raw, 10) : raw;
  return TYPE_MAP[key as number] ?? "Desconhecido";
}

function toNum(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeMonitor(raw: RawMonitor): UptimeMonitor | null {
  const id = toNum(raw.id);
  const name = typeof raw.friendly_name === "string" ? raw.friendly_name : null;
  if (id === null || name === null) return null;

  const interval = toNum(raw.interval);
  const responseTimes = toArray(raw.response_times)
    .map(entry => {
      const item = entry as { datetime?: unknown; value?: unknown };
      const datetime = toNum(item.datetime);
      const value = toNum(item.value);
      return datetime !== null && value !== null ? { datetime, value } : null;
    })
    .filter((entry): entry is { datetime: number; value: number } => entry !== null)
    .slice(-24); // últimas 24 amostras (~2h no plano Free)

  const ratios =
    typeof raw.custom_uptime_ratio === "string"
      ? raw.custom_uptime_ratio.split("-").filter(Boolean)
      : null;

  return {
    id,
    friendlyName: name,
    url: typeof raw.url === "string" ? raw.url : "",
    type: toNum(raw.type) ?? 0,
    typeLabel: mapType(raw.type),
    interval: interval ?? 300,
    status: mapStatus(raw.status),
    uptimeRatio: ratios?.[0] ?? null,
    averageResponseTime:
      typeof raw.average_response_time === "string"
        ? raw.average_response_time
        : null,
    customUptimeRatios: ratios,
    responseTimes,
  };
}

export interface UptimeSnapshot {
  configured: boolean;
  fetchedAt: number;
  /** Counts by status, over all monitors returned. */
  counts: {
    total: number;
    up: number;
    down: number;
    seemsDown: number;
    paused: number;
  };
  /** Overall worst-case status across all monitors. */
  overall: "operational" | "degraded" | "down" | "paused" | "no_data";
  monitors: UptimeMonitor[];
}

function computeOverall(
  counts: UptimeSnapshot["counts"],
): UptimeSnapshot["overall"] {
  if (counts.total === 0) return "no_data";
  if (counts.down > 0) return "down";
  if (counts.seemsDown > 0) return "degraded";
  if (counts.up > 0) return "operational";
  return "paused";
}

let cache: { data: UptimeSnapshot; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60_000; // respeita 10 req/min (plano Free)

export function __clearCacheForTests(): void {
  cache = null;
}

function emptySnapshot(configured: boolean): UptimeSnapshot {
  return {
    configured,
    fetchedAt: Date.now(),
    counts: { total: 0, up: 0, down: 0, seemsDown: 0, paused: 0 },
    overall: "no_data",
    monitors: [],
  };
}

export async function getUptimeSnapshot(
  options?: { forceRefresh?: boolean },
): Promise<UptimeSnapshot> {
  if (!env.uptimeRobotApiKey) {
    return emptySnapshot(false);
  }

  const forceRefresh = options?.forceRefresh === true;
  if (
    !forceRefresh &&
    cache &&
    Date.now() - cache.fetchedAt < CACHE_TTL_MS
  ) {
    return cache.data;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  let payload: { stat?: unknown; monitors?: unknown; error?: { message?: unknown } };
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        api_key: env.uptimeRobotApiKey,
        format: "json",
        logs: "0",
        response_times: "1",
        response_times_average: "30",
        custom_uptime_ratios: "1-7-30",
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    payload = (await response.json()) as typeof payload;
  } catch (error) {
    console.error(
      "[uptimerobot] falha ao consultar a API:",
      error instanceof Error ? error.message : error,
    );
    return emptySnapshot(true);
  } finally {
    clearTimeout(timeout);
  }

  if (payload.stat !== "ok" || !Array.isArray(payload.monitors)) {
    const message =
      typeof payload.error?.message === "string"
        ? payload.error.message
        : "unknown";
    console.error("[uptimerobot] resposta de erro da API:", message);
    return emptySnapshot(true);
  }

  const monitors = payload.monitors
    .map(m => normalizeMonitor(m as RawMonitor))
    .filter((m): m is UptimeMonitor => m !== null);

  const counts = {
    total: monitors.length,
    up: monitors.filter(m => m.status === "up").length,
    down: monitors.filter(m => m.status === "down").length,
    seemsDown: monitors.filter(m => m.status === "seems_down").length,
    paused: monitors.filter(m => m.status === "paused").length,
  };

  const snapshot: UptimeSnapshot = {
    configured: true,
    fetchedAt: Date.now(),
    counts,
    overall: computeOverall(counts),
    monitors,
  };

  cache = { data: snapshot, fetchedAt: snapshot.fetchedAt };
  return snapshot;
}
