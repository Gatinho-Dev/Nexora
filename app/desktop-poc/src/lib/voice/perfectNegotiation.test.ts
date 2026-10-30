import { describe, expect, it } from "vitest";
import {
  shouldIgnoreCandidate,
  shouldIgnoreOffer,
} from "./perfectNegotiation";

describe("WebRTC perfect negotiation", () => {
  it("ignores a colliding offer only on the impolite peer", () => {
    expect(
      shouldIgnoreOffer({
        descriptionType: "offer",
        makingOffer: true,
        signalingState: "have-local-offer",
        polite: false,
      })
    ).toBe(true);
    expect(
      shouldIgnoreOffer({
        descriptionType: "offer",
        makingOffer: true,
        signalingState: "have-local-offer",
        polite: true,
      })
    ).toBe(false);
  });

  it("discards candidates from the ignored ICE generation", () => {
    expect(shouldIgnoreCandidate(true)).toBe(true);
    expect(shouldIgnoreCandidate(false)).toBe(false);
  });

  it("accepts an offer when there is no collision", () => {
    expect(
      shouldIgnoreOffer({
        descriptionType: "offer",
        makingOffer: false,
        signalingState: "stable",
        polite: false,
      })
    ).toBe(false);
  });
});
