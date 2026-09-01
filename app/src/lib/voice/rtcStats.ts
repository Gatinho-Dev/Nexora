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

export type VoiceStatsSample = {
  rttMs: number | null;
  jitterMs: number | null;
  packetsLost: number;
  packetsReceived: number;
  bitrateKbps: number | null;
  candidateType: string | null;
};

export function summarizeVoiceQuality(samples: VoiceStatsSample[]) {
  if (samples.length === 0) {
    return {
      level: "unknown" as const,
      rttMs: null,
      jitterMs: null,
      packetLossPercent: null,
      bitrateKbps: null,
      candidateType: null,
    };
  }
  const average = (values: Array<number | null>) => {
    const usable = values.filter((value): value is number => value != null);
    return usable.length
      ? usable.reduce((total, value) => total + value, 0) / usable.length
      : null;
  };
  const rttMs = average(samples.map(sample => sample.rttMs));
  const jitterMs = average(samples.map(sample => sample.jitterMs));
  const bitrateKbps = average(samples.map(sample => sample.bitrateKbps));
  const packetsLost = samples.reduce(
    (total, sample) => total + sample.packetsLost,
    0
  );
  const packetsReceived = samples.reduce(
    (total, sample) => total + sample.packetsReceived,
    0
  );
  const packetLossPercent =
    packetsLost + packetsReceived > 0
      ? (packetsLost / (packetsLost + packetsReceived)) * 100
      : 0;
  const level: "excellent" | "good" | "poor" =
    (rttMs != null && rttMs > 350) ||
    (jitterMs != null && jitterMs > 60) ||
    packetLossPercent > 8
      ? "poor"
      : (rttMs != null && rttMs > 180) ||
          (jitterMs != null && jitterMs > 30) ||
          packetLossPercent > 3
        ? "good"
        : "excellent";
  return {
    level,
    rttMs: rttMs == null ? null : Math.round(rttMs),
    jitterMs: jitterMs == null ? null : Math.round(jitterMs),
    packetLossPercent: Math.round(packetLossPercent * 10) / 10,
    bitrateKbps: bitrateKbps == null ? null : Math.round(bitrateKbps),
    candidateType:
      samples.find(sample => sample.candidateType)?.candidateType ?? null,
  };
}
