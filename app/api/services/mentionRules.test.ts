import { describe, expect, it } from "vitest";
import { filterMentionRecipients, type MentionPreference } from "./mentionRules";

const NOW = Date.parse("2026-10-30T12:00:00Z");

function pref(
  userId: number,
  overrides: Partial<MentionPreference> = {},
): [number, MentionPreference] {
  return [
    userId,
    {
      userId,
      level: "mentions",
      mutedUntil: null,
      suppressEveryone: false,
      ...overrides,
    },
  ];
}

describe("filterMentionRecipients", () => {
  it("notifies everyone when there are no preferences", () => {
    expect(
      filterMentionRecipients({
        candidateIds: [1, 2],
        directlyMentioned: new Set([1]),
        preferences: new Map(),
        now: NOW,
      }),
    ).toEqual([1, 2]);
  });

  it("drops users with level none, even when directly mentioned", () => {
    expect(
      filterMentionRecipients({
        candidateIds: [1, 2],
        directlyMentioned: new Set([1, 2]),
        preferences: new Map([pref(1, { level: "none" })]),
        now: NOW,
      }),
    ).toEqual([2]);
  });

  it("drops users muted until a time in the future only", () => {
    const muted = new Date(NOW + 60_000).toISOString();
    const expired = new Date(NOW - 60_000).toISOString();
    expect(
      filterMentionRecipients({
        candidateIds: [1, 2],
        directlyMentioned: new Set([1, 2]),
        preferences: new Map([
          pref(1, { mutedUntil: muted }),
          pref(2, { mutedUntil: expired }),
        ]),
        now: NOW,
      }),
    ).toEqual([2]);
  });

  it("suppresses @everyone for suppressEveryone users but keeps direct mentions", () => {
    const preferences = new Map([
      pref(1, { suppressEveryone: true }),
      pref(2, { suppressEveryone: true }),
    ]);
    expect(
      filterMentionRecipients({
        candidateIds: [1, 2],
        directlyMentioned: new Set([2]),
        preferences,
        now: NOW,
      }),
    ).toEqual([2]);
  });
});
