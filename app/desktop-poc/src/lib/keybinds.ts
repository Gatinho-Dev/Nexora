export type KeybindAction =
  | "mute"
  | "deafen"
  | "open"
  | "answer"
  | "hangup"
  | "overlay"
  | "streamer";
export type KeybindMap = Partial<Record<KeybindAction, string>>;

export const KEYBIND_LABELS: Record<KeybindAction, string> = {
  mute: "Mutar / desmutar",
  deafen: "Ensudecer / reativar áudio",
  open: "Abrir Nexora",
  answer: "Responder chamada",
  hangup: "Encerrar chamada",
  overlay: "Alternar overlay",
  streamer: "Alternar modo streamer",
};

export const DEFAULT_KEYBINDS: KeybindMap = {
  mute: "Ctrl+Shift+M",
  deafen: "Ctrl+Shift+D",
  open: "Ctrl+Shift+N",
  answer: "Ctrl+Shift+A",
  hangup: "Ctrl+Shift+H",
  overlay: "Ctrl+Shift+O",
  streamer: "Ctrl+Shift+S",
};

export function keybindFromEvent(event: KeyboardEvent) {
  const modifiers: string[] = [];
  if (event.ctrlKey) modifiers.push("Ctrl");
  if (event.altKey) modifiers.push("Alt");
  if (event.shiftKey) modifiers.push("Shift");
  if (event.metaKey) modifiers.push("Meta");
  const key =
    event.key === " "
      ? "Space"
      : event.key.length === 1
        ? event.key.toUpperCase()
        : event.key;
  if (!["Control", "Alt", "Shift", "Meta"].includes(key)) {
    modifiers.push(key);
  }
  return modifiers.join("+");
}

export function parseKeybinds(
  data: Record<string, unknown> | null | undefined
): KeybindMap {
  const raw = data?.keybinds;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return DEFAULT_KEYBINDS;
  }
  const values = raw as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(KEYBIND_LABELS).map(action => [
      action,
      typeof values[action] === "string"
        ? values[action]
        : DEFAULT_KEYBINDS[action as KeybindAction],
    ])
  ) as KeybindMap;
}

export function duplicateKeybinds(keybinds: KeybindMap) {
  const seen = new Map<string, KeybindAction[]>();
  for (const [action, shortcut] of Object.entries(keybinds) as [
    KeybindAction,
    string | undefined,
  ][]) {
    if (!shortcut) continue;
    seen.set(shortcut, [...(seen.get(shortcut) ?? []), action]);
  }
  return new Set(
    [...seen.entries()]
      .filter(([, actions]) => actions.length > 1)
      .map(([shortcut]) => shortcut)
  );
}
