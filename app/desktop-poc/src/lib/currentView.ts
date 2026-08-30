// Tracks which conversation the user is currently viewing, so realtime
// events can decide between "append + mark read" and "unread badge".
type View = { channelId?: number; conversationId?: number };

let current: View = {};

export function setCurrentView(view: View) {
  current = view;
}

export function getCurrentView(): View {
  return current;
}
