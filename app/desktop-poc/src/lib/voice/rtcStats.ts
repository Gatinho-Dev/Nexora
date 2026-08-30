type SerializableRtcStats = RTCStats & {
  toJSON?: () => Record<string, unknown>;
};

/**
 * RTCStats entries are Web IDL dictionaries. Chromium exposes them as plain
 * enumerable objects, while some runtimes add a toJSON method. Support both
 * shapes so the optional voice diagnostics work across browsers.
 */
export function serializeRtcStats(
  report: SerializableRtcStats
): Record<string, unknown> {
  if (typeof report.toJSON === "function") return report.toJSON();
  return Object.fromEntries(Object.entries(report));
}
