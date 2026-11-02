import { describe, expect, it } from "vitest";
import { filterMentionRecipients, parseServerMentions, type MentionPreference } from "./mentionRules";

const NOW = Date.parse("2026-10-30T12:00:00Z");

function pref(
  userId: number,
  overrides: Partial<MentionPreference> = {},
): [number, MentionPreference] {
  return [userId, {
    userId,
    level: "mentions",
    mutedUntil: null,
    suppressEveryone: false,
    suppressRoles: false,
    ...overrides,
  }];
}

describe("parseServerMentions", () => {
  it("recognizes exact broad, direct and role mentions", () => {
    const mentions = parseServerMentions("@here @everyone @alice @[Equipe de moderação](role:42)");
    expect(mentions.here).toBe(true);
    expect(mentions.everyone).toBe(true);
    expect([...mentions.usernames]).toEqual(["alice"]);
    expect([...mentions.roleIds]).toEqual([42]);
  });

  it("recognizes general mentions followed by punctuation", () => {
    const mentions = parseServerMentions("Oi, @here. Aviso: @everyone!");
    expect(mentions.here).toBe(true);
    expect(mentions.everyone).toBe(true);
  });

  it("does not treat prefixes, email addresses or role labels as direct mentions", () => {
    const mentions = parseServerMentions("@hereafter @everyone2 mail@here.com @[alice](role:42)");
    expect(mentions.here).toBe(false);
    expect(mentions.everyone).toBe(false);
    expect([...mentions.usernames]).toEqual(["hereafter", "everyone2"]);
    expect([...mentions.roleIds]).toEqual([42]);
  });
});

describe("filterMentionRecipients", () => {
  const candidates = {
    candidateIds: [1, 2, 3, 4],
    directlyMentioned: new Set([1]),
    broadlyMentioned: new Set([2, 3]),
    roleMentioned: new Set([3, 4]),
    now: NOW,
  };

  it("notifies candidates with no preferences", () => {
    expect(filterMentionRecipients({ ...candidates, preferences: new Map() })).toEqual([1, 2, 3, 4]);
  });

  it("drops users with level none, even when directly mentioned", () => {
    expect(filterMentionRecipients({
      ...candidates, preferences: new Map([pref(1, { level: "none" })]),
    })).toEqual([2, 3, 4]);
  });

  it("drops users muted until a time in the future only", () => {
    expect(filterMentionRecipients({
      ...candidates,
      preferences: new Map([
        pref(1, { mutedUntil: new Date(NOW + 60_000).toISOString() }),
        pref(2, { mutedUntil: new Date(NOW - 60_000).toISOString() }),
      ]),
    })).toEqual([2, 3, 4]);
  });

  it("suppresses general mentions while keeping direct and unsuppressed role mentions", () => {
    expect(filterMentionRecipients({
      ...candidates,
      preferences: new Map([
        pref(1, { suppressEveryone: true }),
        pref(2, { suppressEveryone: true }),
        pref(3, { suppressEveryone: true }),
      ]),
    })).toEqual([1, 3, 4]);
  });

  it("suppresses role mentions while keeping direct and unsuppressed general mentions", () => {
    expect(filterMentionRecipients({
      ...candidates,
      roleMentioned: new Set([1, 3, 4]),
      preferences: new Map([
        pref(1, { suppressRoles: true }),
        pref(3, { suppressRoles: true }),
        pref(4, { suppressRoles: true }),
      ]),
    })).toEqual([1, 2, 3]);
  });

  it("suppresses both types independently and never emits users without a matching reason", () => {
    expect(filterMentionRecipients({
      ...candidates,
      candidateIds: [1, 2, 3, 4, 5],
      preferences: new Map([
        pref(3, { suppressRoles: true, suppressEveryone: true }),
      ]),
    })).toEqual([1, 2, 4]);
  });
});
