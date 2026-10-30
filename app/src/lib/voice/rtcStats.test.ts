import { describe, expect, it } from "vitest";
import { serializeRtcStats, summarizeVoiceQuality } from "./rtcStats";

describe("WebRTC stats serialization", () => {
  it("serializes Chromium's plain RTCStats dictionaries", () => {
    const report = {
      id: "outbound-audio",
      type: "outbound-rtp",
      timestamp: 123,
      kind: "audio",
      bytesSent: 456,
    } as unknown as RTCStats;

    expect(serializeRtcStats(report)).toEqual({
      id: "outbound-audio",
      type: "outbound-rtp",
      timestamp: 123,
      kind: "audio",
      bytesSent: 456,
    });
  });

  it("uses toJSON when a runtime provides it", () => {
    const report = {
      id: "candidate-pair",
      type: "candidate-pair",
      timestamp: 321,
      toJSON: () => ({ id: "candidate-pair", state: "succeeded" }),
    } as unknown as RTCStats & {
      toJSON: () => Record<string, unknown>;
    };

    expect(serializeRtcStats(report)).toEqual({
      id: "candidate-pair",
      state: "succeeded",
    });
  });
});

describe("RTC voice quality", () => {
  it("reports unknown without real samples", () => {
    expect(summarizeVoiceQuality([]).level).toBe("unknown");
  });

  it("uses measured RTT, jitter and packet loss", () => {
    expect(
      summarizeVoiceQuality([
        {
          rttMs: 42,
          jitterMs: 8,
          packetsLost: 1,
          packetsReceived: 999,
          bitrateKbps: 58,
          candidateType: "relay",
        },
      ]),
    ).toMatchObject({
      level: "excellent",
      rttMs: 42,
      jitterMs: 8,
      packetLossPercent: 0.1,
      candidateType: "relay",
    });
  });

  it("marks genuinely degraded samples as poor", () => {
    expect(
      summarizeVoiceQuality([
        {
          rttMs: 480,
          jitterMs: 75,
          packetsLost: 12,
          packetsReceived: 88,
          bitrateKbps: 18,
          candidateType: "host",
        },
      ]).level,
    ).toBe("poor");
  });
});
