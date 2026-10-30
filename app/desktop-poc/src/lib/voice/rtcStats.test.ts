import { describe, expect, it } from "vitest";
import { serializeRtcStats } from "./rtcStats";

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
