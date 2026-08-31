import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "./useAppStore";

describe("server rail aggregation", () => {
  beforeEach(() => {
    useAppStore.setState({
      unreadChannels: {},
      unreadConversations: {},
      channelUnreadDetails: {},
      serverUnread: {},
      serverMentions: {},
      serverVoiceSummaries: {},
    });
  });

  it("aggregates unread messages and mentions by server", () => {
    useAppStore.getState().setUnread(
      { 10: 3, 11: 2, 20: 4 },
      {},
      {
        10: {
          serverId: 1,
          count: 3,
          mentionCount: 1,
          firstUnreadMessageId: 100,
          firstUnreadAt: "2026-08-30T12:00:00.000Z",
          latestMessageId: 102,
        },
        11: {
          serverId: 1,
          count: 2,
          mentionCount: 0,
          firstUnreadMessageId: 110,
          firstUnreadAt: "2026-08-30T12:01:00.000Z",
          latestMessageId: 111,
        },
        20: {
          serverId: 2,
          count: 4,
          mentionCount: 2,
          firstUnreadMessageId: 200,
          firstUnreadAt: "2026-08-30T12:02:00.000Z",
          latestMessageId: 203,
        },
      },
    );

    expect(useAppStore.getState().serverUnread).toEqual({ 1: 5, 2: 4 });
    expect(useAppStore.getState().serverMentions).toEqual({ 1: 1, 2: 2 });
  });

  it("removes only the cleared channel from the server totals", () => {
    const store = useAppStore.getState();
    store.setUnread(
      { 10: 3, 11: 2 },
      {},
      {
        10: {
          serverId: 1,
          count: 3,
          mentionCount: 1,
          firstUnreadMessageId: 100,
          firstUnreadAt: "2026-08-30T12:00:00.000Z",
          latestMessageId: 102,
        },
        11: {
          serverId: 1,
          count: 2,
          mentionCount: 0,
          firstUnreadMessageId: 110,
          firstUnreadAt: "2026-08-30T12:01:00.000Z",
          latestMessageId: 111,
        },
      },
    );

    useAppStore.getState().clearUnreadChannel(10);

    expect(useAppStore.getState().unreadChannels).toEqual({ 11: 2 });
    expect(useAppStore.getState().serverUnread).toEqual({ 1: 2 });
    expect(useAppStore.getState().serverMentions).toEqual({ 1: 0 });
  });

  it("keeps a compact four-person voice preview", () => {
    useAppStore.getState().setServerVoiceSummary(
      1,
      6,
      Array.from({ length: 6 }, (_, index) => ({
        userId: index + 1,
        name: `Pessoa ${index + 1}`,
        avatar: null,
      })),
    );

    expect(useAppStore.getState().serverVoiceSummaries[1]).toMatchObject({
      count: 6,
    });
    expect(useAppStore.getState().serverVoiceSummaries[1].preview).toHaveLength(
      4,
    );
  });
});
