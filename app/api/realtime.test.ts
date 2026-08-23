import { describe, expect, it } from "vitest";
import { isValidSignalData } from "./realtime";

describe("realtime signaling validation", () => {
  it("accepts supported SDP and ICE payloads", () => {
    expect(
      isValidSignalData({ description: { type: "offer", sdp: "v=0" } })
    ).toBe(true);
    expect(isValidSignalData({ candidate: null })).toBe(true);
    expect(
      isValidSignalData({ candidate: { candidate: "candidate:1 1 udp" } })
    ).toBe(true);
  });

  it("rejects malformed or oversized signaling payloads", () => {
    expect(isValidSignalData(null)).toBe(false);
    expect(
      isValidSignalData({ description: { type: "invalid", sdp: "v=0" } })
    ).toBe(false);
    expect(
      isValidSignalData({
        description: { type: "offer", sdp: "x".repeat(1_000_001) },
      })
    ).toBe(false);
  });
});
