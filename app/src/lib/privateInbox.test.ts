import { describe, expect, it } from "vitest";
import type { ConversationDTO } from "@contracts/types";
import {
  buildPrivateInboxEntries,
  conversationActivityAt,
  isConversationMutedAt,
  organizePrivateInbox,
  resolveConversationUnread,
  type OfficialInboxState,
  type PrivateInboxEntry,
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

const at = (iso: string) => conversationActivityAt(conversation(1, {
  lastMessage: {
    id: 1,
    content: "oi",
    createdAt: iso,
    authorId: 1,
  },
}));

const officialState = (patch: Partial<OfficialInboxState> = {}): OfficialInboxState => ({
  activityAt: new Date("2026-03-01T12:00:00Z").getTime(),
  unread: 0,
  preview: "Aviso de segurança",
  ...patch,
});

const ids = (entries: PrivateInboxEntry[]) =>
  entries.map(entry =>
    entry.kind === "official" ? "official" : String(entry.conversation.id),
  );

describe("conversationActivityAt", () => {
  it("usa a última mensagem e cai para 0 quando não há data utilizável", () => {
    expect(at("2026-02-01T10:00:00Z")).toBe(
      new Date("2026-02-01T10:00:00Z").getTime(),
    );
    expect(conversationActivityAt(conversation(1))).toBe(0);
    expect(
      conversationActivityAt(
        conversation(1, {
          lastMessage: {
            id: 1,
            content: "x",
            createdAt: "data inválida",
            authorId: 1,
          },
        }),
      ),
    ).toBe(0);
  });

  it("usa updatedAt quando a conversa ainda não tem mensagens", () => {
    expect(
      conversationActivityAt(
        conversation(1, { updatedAt: "2026-02-01T10:00:00Z" }),
      ),
    ).toBe(new Date("2026-02-01T10:00:00Z").getTime());
  });
});

describe("buildPrivateInboxEntries", () => {
  const recentConversations = () => [
    conversation(1, {
      lastMessage: { id: 1, content: "a", createdAt: "2026-03-05T10:00:00Z", authorId: 1 },
    }),
    conversation(2, {
      lastMessage: { id: 2, content: "b", createdAt: "2026-03-04T10:00:00Z", authorId: 1 },
    }),
    conversation(3, {
      lastMessage: { id: 3, content: "c", createdAt: "2026-03-03T10:00:00Z", authorId: 1 },
    }),
  ];

  it("mantém a conversa oficial em ordem com as DMs quando não há aviso novo", () => {
    // Aviso de 1º de março perde para as três DMs, então desce para o fim.
    const { recent } = buildPrivateInboxEntries(recentConversations(), officialState());
    expect(ids(recent)).toEqual(["1", "2", "3", "official"]);
  });

  it("sobe para a primeira posição conforme você conversa com outras pessoas", () => {
    // Depois de uma conversa nova, o aviso é o item mais antigo da lista.
    const afterChatting = [
      ...recentConversations(),
      conversation(4, {
        lastMessage: { id: 4, content: "d", createdAt: "2026-03-06T10:00:00Z", authorId: 1 },
      }),
    ];
    const { recent } = buildPrivateInboxEntries(afterChatting, officialState());
    expect(ids(recent)).toEqual(["4", "1", "2", "3", "official"]);
  });

  it("flutua para o topo quando chega aviso novo, acima das conversas fixadas", () => {
    const withPinned = [
      ...recentConversations(),
      conversation(9, {
        pinnedAt: "2026-03-07T10:00:00Z",
        lastMessage: { id: 9, content: "p", createdAt: "2026-03-07T10:00:00Z", authorId: 1 },
      }),
    ];
    const { pinned, recent } = buildPrivateInboxEntries(
      withPinned,
      officialState({ unread: 2 }),
    );
    expect(ids(pinned)).toEqual(["official", "9"]);
    expect(ids(recent)).toEqual(["1", "2", "3"]);
  });

  it("continua sendo a única entrada quando não há nenhuma conversa", () => {
    const { pinned, recent } = buildPrivateInboxEntries([], officialState());
    expect(pinned).toHaveLength(0);
    expect(ids(recent)).toEqual(["official"]);
  });

  it("omite a entrada oficial quando não existe nenhum comunicado", () => {
    const { recent } = buildPrivateInboxEntries(recentConversations(), null);
    expect(ids(recent)).toEqual(["1", "2", "3"]);
  });
});
