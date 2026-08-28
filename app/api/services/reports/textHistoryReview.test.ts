import { describe, expect, it } from "vitest";
import { decideHistorySanction } from "./textHistoryReview";

describe("decideHistorySanction", () => {
  it("does nothing when the history is clean", () => {
    expect(decideHistorySanction([])).toEqual({ action: "none", suspensionDays: null });
  });

  it("uses a warning for an isolated non-critical violation", () => {
    expect(decideHistorySanction(["harassment"])).toEqual({ action: "warning", suspensionDays: null });
  });

  it("selects proportional temporary suspensions for repeated violations", () => {
    expect(decideHistorySanction(["harassment", "spam", "scam"])).toEqual({
      action: "warning",
      suspensionDays: null,
    });
    expect(decideHistorySanction(["threat", "hate", "criminal"])).toEqual({
      action: "temporary_suspension",
      suspensionDays: 3,
    });
    expect(decideHistorySanction(["threat", "hate", "criminal", "malware", "graphic_violence"])).toEqual({
      action: "temporary_suspension",
      suspensionDays: 7,
    });
    expect(decideHistorySanction(Array.from({ length: 8 }, () => "harassment"))).toEqual({
      action: "temporary_suspension",
      suspensionDays: 1,
    });
  });

  it("never exposes a permanent-ban outcome", () => {
    const decision = decideHistorySanction(Array.from({ length: 50 }, () => "threat"));
    expect(decision.action).toBe("temporary_suspension");
    expect(decision).not.toHaveProperty("permanentBan");
  });
});
