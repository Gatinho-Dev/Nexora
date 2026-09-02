import { create } from "zustand";
import type {
  MessageDTO,
  ReactionDTO,
  RichPresenceActivityDTO,
  RobloxActivityDTO,
  VoiceParticipant,
} from "@contracts/types";

export const channelKey = (id: number) => `c:${id}`;
export const dmKey = (id: number) => `dm:${id}`;

type TypingEntry = { name: string; until: number };

export type ChannelUnreadDetail = {
  serverId: number;
  count: number;
  mentionCount: number;
  firstUnreadMessageId: number;
  firstUnreadAt: string | Date;
  latestMessageId: number;
};

type ServerVoiceSummary = {
  count: number;
  preview: Pick<VoiceParticipant, "userId" | "name" | "avatar">[];
};

export type VoiceConnectionStatus =
  "idle" | "connecting" | "connected" | "reconnecting" | "failed";

export type VoiceCallPhase =
  | "idle"
  | "creating"
  | "ringing"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "ended"
  | "failed";

export type VoiceConnectionQuality = {
  level: "excellent" | "good" | "poor" | "unknown";
  rttMs: number | null;
  jitterMs: number | null;
  packetLossPercent: number | null;
  bitrateKbps: number | null;
  candidateType: string | null;
};

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
  serverMentions: Record<number, number>;
  setServerUnread: (serverId: number, count: number) => void;
  serverVoiceSummaries: Record<number, ServerVoiceSummary>;
  setServerVoiceSummary: (
    serverId: number,
    count: number,
    preview: Pick<VoiceParticipant, "userId" | "name" | "avatar">[]
  ) => void;
  stageHandsByRoom: Record<string, number[]>;
  setStageHands: (roomKey: string, userIds: number[]) => void;
  quickSwitcherOpen: boolean;
  setQuickSwitcherOpen: (v: boolean) => void;
  // presence & unread
  presence: Record<number, string>;
  // atividade Roblox em tempo real (WS activity:update vence a query inicial)
  robloxActivity: Record<number, RobloxActivityDTO | null>;
  setRobloxActivity: (
    userId: number,
    activity: RobloxActivityDTO | null
  ) => void;
  richPresence: Record<number, RichPresenceActivityDTO[]>;
  setRichPresence: (
    userId: number,
    activities: RichPresenceActivityDTO[]
  ) => void;
  unreadChannels: Record<number, number>;
  unreadConversations: Record<number, number>;
  channelUnreadDetails: Record<number, ChannelUnreadDetail>;
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
  voiceCallPhase: VoiceCallPhase;
  voiceCallId: string | null;
  voiceCallStartedAt: number | null;
  voiceCallConnectedAt: number | null;
  voiceCallDeadlineAt: number | null;
  voiceCallEndReason: string | null;
  voiceQuality: VoiceConnectionQuality;
  voiceDeviceError: string | null;
  voicePlaybackBlocked: boolean;
  speakingByUser: Record<number, boolean>;
  localStream: MediaStream | null;
  localVideo: MediaStream | null;
  remoteStreams: Record<number, MediaStream>;
  incomingCall: {
    conversationId: number;
    actorName: string;
    actorAvatar?: string | null;
    notificationId?: number;
    video: boolean;
  } | null;
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
  upsertMessage: (msg: MessageDTO) => void;
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
    conversations: Record<number, number>,
    channelDetails?: Record<number, ChannelUnreadDetail>
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
        | "voiceCallPhase"
        | "voiceCallId"
        | "voiceCallStartedAt"
        | "voiceCallConnectedAt"
        | "voiceCallDeadlineAt"
        | "voiceCallEndReason"
        | "voiceQuality"
        | "voiceDeviceError"
        | "voicePlaybackBlocked"
        | "localStream"
        | "localVideo"
      >
    >
  ) => void;
  setRemoteStream: (userId: number, stream: MediaStream | null) => void;
  setSpeaking: (userId: number, speaking: boolean) => void;
  resetVoice: () => void;
  setIncomingCall: (call: AppState["incomingCall"]) => void;
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
  robloxActivity: {},
  richPresence: {},
  sensitiveMediaPref: "warn",
  serverUnread: {},
  serverMentions: {},
  serverVoiceSummaries: {},
  stageHandsByRoom: {},
  quickSwitcherOpen: false,
  unreadChannels: {},
  unreadConversations: {},
  channelUnreadDetails: {},
  voiceParticipants: {},
  voiceChannelId: null,
  voiceConversationId: null,
  voiceServerId: null,
  muted: false,
  deafened: false,
  cameraOn: false,
  screenOn: false,
  voiceConnectionStatus: "idle",
  voiceCallPhase: "idle",
  voiceCallId: null,
  voiceCallStartedAt: null,
  voiceCallConnectedAt: null,
  voiceCallDeadlineAt: null,
  voiceCallEndReason: null,
  voiceQuality: {
    level: "unknown",
    rttMs: null,
    jitterMs: null,
    packetLossPercent: null,
    bitrateKbps: null,
    candidateType: null,
  },
  voiceDeviceError: null,
  voicePlaybackBlocked: false,
  speakingByUser: {},
  localStream: null,
  localVideo: null,
  remoteStreams: {},
  incomingCall: null,
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
      // Cap de memória: mantém no máx. as 200 mais recentes por canal
      // (histórico completo continua no banco e paginável por scroll).
      const next = [...list, msg];
      return {
        messages: {
          ...s.messages,
          [key]: next.length > 200 ? next.slice(next.length - 200) : next,
        },
      };
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

  /** Como updateMessage, mas insere se a mensagem ainda não existe locally. */
  upsertMessage: msg =>
    set(s => {
      const key = keyOfMessage(msg);
      const list = s.messages[key];
      if (!list) return s;
      if (list.some(m => m.id === msg.id)) {
        return {
          messages: {
            ...s.messages,
            [key]: list.map(m => (m.id === msg.id ? msg : m)),
          },
        };
      }
      return { messages: { ...s.messages, [key]: [...list, msg] } };
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

  setRobloxActivity: (userId, activity) =>
    set(s => ({ robloxActivity: { ...s.robloxActivity, [userId]: activity } })),

  setRichPresence: (userId, activities) =>
    set(s => ({ richPresence: { ...s.richPresence, [userId]: activities } })),

  setPresenceBulk: entries =>
    set(s => ({ presence: { ...s.presence, ...entries } })),

  setUnread: (channels, conversations, channelDetails = {}) =>
    set(() => {
      const serverUnread: Record<number, number> = {};
      const serverMentions: Record<number, number> = {};
      for (const detail of Object.values(channelDetails)) {
        serverUnread[detail.serverId] =
          (serverUnread[detail.serverId] ?? 0) + detail.count;
        serverMentions[detail.serverId] =
          (serverMentions[detail.serverId] ?? 0) + detail.mentionCount;
      }
      return {
        unreadChannels: channels,
        unreadConversations: conversations,
        channelUnreadDetails: channelDetails,
        serverUnread,
        serverMentions,
      };
    }),

  setSensitiveMediaPref: pref => {
    set({ sensitiveMediaPref: pref });
  },
  setQuickSwitcherOpen: v => set({ quickSwitcherOpen: v }),
  setStageHands: (roomKey, userIds) =>
    set(state =>
      JSON.stringify(state.stageHandsByRoom[roomKey]) ===
      JSON.stringify(userIds)
        ? state
        : {
            stageHandsByRoom: { ...state.stageHandsByRoom, [roomKey]: userIds },
          }
    ),
  setServerUnread: (serverId, count) =>
    set(state =>
      state.serverUnread[serverId] === count
        ? state
        : { serverUnread: { ...state.serverUnread, [serverId]: count } }
    ),
  setServerVoiceSummary: (serverId, count, preview) =>
    set(state => ({
      serverVoiceSummaries: {
        ...state.serverVoiceSummaries,
        [serverId]: {
          count,
          preview: preview.slice(0, 4),
        },
      },
    })),
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
      const details = { ...s.channelUnreadDetails };
      const detail = details[id];
      delete next[id];
      delete details[id];
      if (!detail)
        return { unreadChannels: next, channelUnreadDetails: details };
      const serverUnread = { ...s.serverUnread };
      const serverMentions = { ...s.serverMentions };
      serverUnread[detail.serverId] = Math.max(
        0,
        (serverUnread[detail.serverId] ?? 0) - detail.count
      );
      serverMentions[detail.serverId] = Math.max(
        0,
        (serverMentions[detail.serverId] ?? 0) - detail.mentionCount
      );
      return {
        unreadChannels: next,
        channelUnreadDetails: details,
        serverUnread,
        serverMentions,
      };
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
      voiceCallPhase: "idle",
      voiceCallId: null,
      voiceCallStartedAt: null,
      voiceCallConnectedAt: null,
      voiceCallDeadlineAt: null,
      voiceCallEndReason: null,
      voiceQuality: {
        level: "unknown",
        rttMs: null,
        jitterMs: null,
        packetLossPercent: null,
        bitrateKbps: null,
        candidateType: null,
      },
      voiceDeviceError: null,
      voicePlaybackBlocked: false,
      speakingByUser: {},
      localStream: null,
      localVideo: null,
      remoteStreams: {},
    }),

  setIncomingCall: call => set({ incomingCall: call }),

  setMobileNavOpen: v => set({ mobileNavOpen: v }),
  setMobileMembersOpen: v => set({ mobileMembersOpen: v }),
  setMembersOpen: v => set({ membersOpen: v }),
}));
