import { create } from "zustand";
import type { MessageDTO } from "@contracts/types";

// Per-chat composer UI state (reply target, message being edited)
type ChatUIState = {
  replyingTo: MessageDTO | null;
  editing: MessageDTO | null;
  setReplyingTo: (msg: MessageDTO | null) => void;
  setEditing: (msg: MessageDTO | null) => void;
};

export const useChatUIStore = create<ChatUIState>((set) => ({
  replyingTo: null,
  editing: null,
  setReplyingTo: (msg) => set({ replyingTo: msg, editing: null }),
  setEditing: (msg) => set({ editing: msg, replyingTo: null }),
}));
