import { describe, expect, it } from "vitest";
import {
  allInviteesDeclined,
  DM_UNANSWERED_TIMEOUT_MS,
  hasUnansweredCallExpired,
  isDmCallAnswered,
} from "./dmCallPolicy";

describe("DM call policy", () => {
  it("answers permanently after a second unique participant joins", () => {
    expect(isDmCallAnswered(new Set([10]))).toBe(false);
    expect(isDmCallAnswered(new Set([10, 11]))).toBe(true);
  });

  it("expires only unanswered calls at two minutes", () => {
    expect(
      hasUnansweredCallExpired({
        answered: false,
        startedAt: 1_000,
        now: 1_000 + DM_UNANSWERED_TIMEOUT_MS - 1,
      })
    ).toBe(false);
    expect(
      hasUnansweredCallExpired({
        answered: false,
        startedAt: 1_000,
        now: 1_000 + DM_UNANSWERED_TIMEOUT_MS,
      })
    ).toBe(true);
    expect(
      hasUnansweredCallExpired({
        answered: true,
        startedAt: 1_000,
        now: 1_000 + DM_UNANSWERED_TIMEOUT_MS * 2,
      })
    ).toBe(false);
  });

  it("ends early only when every invited user declined", () => {
    expect(allInviteesDeclined(new Set([2, 3]), new Set([2]))).toBe(false);
    expect(allInviteesDeclined(new Set([2, 3]), new Set([2, 3]))).toBe(true);
  });
});
