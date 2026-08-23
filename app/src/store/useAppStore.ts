import { create } from "zustand";
import type {
  MessageDTO,
  ReactionDTO,
  VoiceParticipant,
} from "@contracts/types";

export const channelKey = (id: number) => `c:${id}`;
export const dmKey = (id: number) => `dm:${id}`;

type TypingEntry = { name: string; until: number };

export type VoiceConnectionStatus =
  "idle" | "connecting" | "connected" | "reconnecting" | "failed";

type AppState = {
  wsConnected: boolean;
  // chat
  messages: Record<string, MessageDTO[]>;
  hasMore: Record<string, boolean>;
  typing: Record<string, Record<number, TypingEntry>>;
  // safety
  sensitiveMediaPref: "hide" | "warn" | "auto";
  setSensitiveMediaPref: (pref: "hide" | "warn" | "auto") => void;
  // rail unread aggregation per server
  serverUnread: Record<number, number>;
  setServerUnread: (serverId: number, count: number) => void;
  // presence & unread
  presence: Record<number, string>;
  unreadChannels: Record<number, number>;
  unreadConversations: Record<number, number>;
  // voice
  voiceParticipants: Record<string, VoiceParticipant[]>;
  voiceChannelId: number | null;
  voiceConversationId: number | null;
  voiceServerId: number | null;
  muted: boolean;
  deafened: boolean;
  cameraOn: boolean;
  screenOn: boolean;
  voiceConnectionStatus: VoiceConnectionStatus;
  voicePlaybackBlocked: boolean;
  speakingByUser: Record<number, boolean>;
  localStream: MediaStream | null;
  localVideo: MediaStream | null;
  remoteStreams: Record<number, MediaStream>;
  // mobile UI
  mobileNavOpen: boolean;
  mobileMembersOpen: boolean;
  membersOpen: boolean;

  // actions
  setWsConnected: (v: boolean) => void;
  setMessages: (key: string, msgs: MessageDTO[], hasMore: boolean) => void;
  prependMessages: (key: string, older: MessageDTO[], hasMore: boolean) => void;
  addMessage: (msg: MessageDTO) => void;
  updateMessage: (msg: MessageDTO) => void;
  removeMessage: (key: string, id: number) => void;
  setReactions: (
    key: string,
    messageId: number,
    reactions: ReactionDTO[]
  ) => void;
  setTyping: (key: string, userId: number, name: string) => void;
  setPresence: (userId: number, status: string) => void;
  setPresenceBulk: (entries: Record<number, string>) => void;
  setUnread: (
    channels: Record<number, number>,
    conversations: Record<number, number>
  ) => void;
  bumpUnreadChannel: (id: number) => void;
  bumpUnreadConversation: (id: number) => void;
  clearUnreadChannel: (id: number) => void;
  clearUnreadConversation: (id: number) => void;
  setVoiceParticipants: (roomKey: string, list: VoiceParticipant[]) => void;
  setVoiceSession: (
    patch: Partial<
      Pick<
        AppState,
        | "voiceChannelId"
        | "voiceConversationId"
        | "voiceServerId"
        | "muted"
        | "deafened"
        | "cameraOn"
        | "screenOn"
        | "voiceConnectionStatus"
        | "voicePlaybackBlocked"
        | "localStream"
        | "localVideo"
      >
    >
  ) => void;
  setRemoteStream: (userId: number, stream: MediaStream | null) => void;
  setSpeaking: (userId: number, speaking: boolean) => void;
  resetVoice: () => void;
  setMobileNavOpen: (v: boolean) => void;
  setMobileMembersOpen: (v: boolean) => void;
  setMembersOpen: (v: boolean) => void;
};

function keyOfMessage(msg: MessageDTO): string {
  return msg.channelId ? channelKey(msg.channelId) : dmKey(msg.conversationId!);
}

export const useAppStore = create<AppState>(set => ({
  wsConnected: false,
  messages: {},
  hasMore: {},
  typing: {},
  presence: {},
  sensitiveMediaPref: "warn",
  serverUnread: {},
  unreadChannels: {},
  unreadConversations: {},
  voiceParticipants: {},
  voiceChannelId: null,
  voiceConversationId: null,
  voiceServerId: null,
  muted: false,
  deafened: false,
  cameraOn: false,
  screenOn: false,
  voiceConnectionStatus: "idle",
  voicePlaybackBlocked: false,
  speakingByUser: {},
  localStream: null,
  localVideo: null,
  remoteStreams: {},
  mobileNavOpen: false,
  mobileMembersOpen: false,
  membersOpen: false,

  setWsConnected: v => set({ wsConnected: v }),

  setMessages: (key, msgs, hasMore) =>
    set(s => ({
      messages: { ...s.messages, [key]: msgs },
      hasMore: { ...s.hasMore, [key]: hasMore },
    })),

  prependMessages: (key, older, hasMore) =>
    set(s => ({
      messages: {
        ...s.messages,
        [key]: [...older, ...(s.messages[key] ?? [])],
      },
      hasMore: { ...s.hasMore, [key]: hasMore },
    })),

  addMessage: msg =>
    set(s => {
      const key = keyOfMessage(msg);
      const list = s.messages[key] ?? [];
      if (list.some(m => m.id === msg.id)) return s;
      return { messages: { ...s.messages, [key]: [...list, msg] } };
    }),

  updateMessage: msg =>
    set(s => {
      const key = keyOfMessage(msg);
      const list = s.messages[key];
      if (!list) return s;
      return {
        messages: {
          ...s.messages,
          [key]: list.map(m => (m.id === msg.id ? msg : m)),
        },
      };
    }),

  removeMessage: (key, id) =>
    set(s => {
      const list = s.messages[key];
      if (!list) return s;
      return {
        messages: { ...s.messages, [key]: list.filter(m => m.id !== id) },
      };
    }),

  setReactions: (key, messageId, reactions) =>
    set(s => {
      const list = s.messages[key];
      if (!list) return s;
      return {
        messages: {
          ...s.messages,
          [key]: list.map(m => (m.id === messageId ? { ...m, reactions } : m)),
        },
      };
    }),

  setTyping: (key, userId, name) =>
    set(s => ({
      typing: {
        ...s.typing,
        [key]: {
          ...s.typing[key],
          [userId]: { name, until: Date.now() + 6000 },
        },
      },
    })),

  setPresence: (userId, status) =>
    set(s => ({ presence: { ...s.presence, [userId]: status } })),

  setPresenceBulk: entries =>
    set(s => ({ presence: { ...s.presence, ...entries } })),

  setUnread: (channels, conversations) =>
    set({ unreadChannels: channels, unreadConversations: conversations }),

  setSensitiveMediaPref: pref => {
    set({ sensitiveMediaPref: pref });
  },
  setServerUnread: (serverId, count) =>
    set(state =>
      state.serverUnread[serverId] === count
        ? state
        : { serverUnread: { ...state.serverUnread, [serverId]: count } }
    ),
  bumpUnreadChannel: id =>
    set(s => ({
      unreadChannels: {
        ...s.unreadChannels,
        [id]: (s.unreadChannels[id] ?? 0) + 1,
      },
    })),

  bumpUnreadConversation: id =>
    set(s => ({
      unreadConversations: {
        ...s.unreadConversations,
        [id]: (s.unreadConversations[id] ?? 0) + 1,
      },
    })),

  clearUnreadChannel: id =>
    set(s => {
      const next = { ...s.unreadChannels };
      delete next[id];
      return { unreadChannels: next };
    }),

  clearUnreadConversation: id =>
    set(s => {
      const next = { ...s.unreadConversations };
      delete next[id];
      return { unreadConversations: next };
    }),

  setVoiceParticipants: (roomKey, list) =>
    set(s => ({
      voiceParticipants: { ...s.voiceParticipants, [roomKey]: list },
    })),

  setVoiceSession: patch => set(patch),

  setRemoteStream: (userId, stream) =>
    set(s => {
      const next = { ...s.remoteStreams };
      if (stream) next[userId] = stream;
      else delete next[userId];
      return { remoteStreams: next };
    }),

  setSpeaking: (userId, speaking) =>
    set(s => {
      if (s.speakingByUser[userId] === speaking) return s;
      const next = { ...s.speakingByUser };
      if (speaking) next[userId] = true;
      else delete next[userId];
      return { speakingByUser: next };
    }),

  resetVoice: () =>
    set({
      voiceChannelId: null,
      voiceConversationId: null,
      voiceServerId: null,
      muted: false,
      deafened: false,
      cameraOn: false,
      screenOn: false,
      voiceConnectionStatus: "idle",
      voicePlaybackBlocked: false,
      speakingByUser: {},
      localStream: null,
      localVideo: null,
      remoteStreams: {},
    }),

  setMobileNavOpen: v => set({ mobileNavOpen: v }),
  setMobileMembersOpen: v => set({ mobileMembersOpen: v }),
  setMembersOpen: v => set({ membersOpen: v }),
}));
