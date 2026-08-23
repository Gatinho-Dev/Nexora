import { describe, expect, it } from "vitest";
import { calculateRms, manualVadThreshold } from "./vadMath";

describe("voice activity math", () => {
  it("measures silence and a stable signal", () => {
    expect(calculateRms(new Float32Array([0, 0, 0, 0]))).toBe(0);
    expect(calculateRms(new Float32Array([0.5, -0.5, 0.5, -0.5]))).toBeCloseTo(
      0.5
    );
  });

  it("maps higher sensitivity to a lower opening threshold", () => {
    expect(manualVadThreshold(90)).toBeLessThan(manualVadThreshold(10));
    expect(manualVadThreshold(200)).toBe(manualVadThreshold(100));
    expect(manualVadThreshold(-20)).toBe(manualVadThreshold(0));
  });
});
