import { describe, expect, it } from "vitest";
import type { ConversationDTO } from "@contracts/types";
import {
  isConversationMutedAt,
  organizePrivateInbox,
  resolveConversationUnread,
} from "./privateInbox";

function conversation(
  id: number,
  patch: Partial<ConversationDTO> = {},
): ConversationDTO {
  return {
    id,
    isGroup: false,
    members: [],
    otherUser: null,
    lastMessage: null,
    unreadCount: 0,
    ...patch,
  };
}

describe("private inbox organization", () => {
  it("organizes a 500-DM fixture without losing or duplicating conversations", () => {
    const fixture = Array.from({ length: 500 }, (_, index) =>
      conversation(index + 1, {
        pinnedAt: index < 20 ? new Date(2026, 0, index + 1) : null,
        isRequest: index >= 480,
        isSpam: index >= 495,
      }),
    );

    const result = organizePrivateInbox(fixture);

    expect(result.pinned).toHaveLength(20);
    expect(result.recent).toHaveLength(460);
    expect(result.requests).toHaveLength(15);
    expect(result.spam).toHaveLength(5);
    expect(fixture).toHaveLength(500);
  });

  it("uses realtime unread state when present and persisted state otherwise", () => {
    expect(resolveConversationUnread(0, 7)).toBe(0);
    expect(resolveConversationUnread(undefined, 7)).toBe(7);
  });

  it("respects permanent and time-limited mute preferences", () => {
    const now = new Date("2026-08-29T12:00:00Z").getTime();
    expect(isConversationMutedAt({ mutedForever: true }, now)).toBe(true);
    expect(
      isConversationMutedAt(
        { mutedUntil: "2026-08-29T12:30:00Z" },
        now,
      ),
    ).toBe(true);
    expect(
      isConversationMutedAt(
        { mutedUntil: "2026-08-29T11:30:00Z" },
        now,
      ),
    ).toBe(false);
  });
});
