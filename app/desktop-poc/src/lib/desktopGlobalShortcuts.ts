import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  register,
  unregister,
} from "@tauri-apps/plugin-global-shortcut";
import { voiceManager } from "@/lib/rtc";
import { useAppStore } from "@/store/useAppStore";

type ShortcutAction =
  | "mute"
  | "deafen"
  | "open"
  | "answer"
  | "hangup"
  | "overlay"
  | "streamer";

const DEFAULT_SHORTCUTS: Record<ShortcutAction, string> = {
  mute: "Ctrl+Shift+M",
  deafen: "Ctrl+Shift+D",
  open: "Ctrl+Shift+N",
  answer: "Ctrl+Shift+A",
  hangup: "Ctrl+Shift+H",
  overlay: "Ctrl+Shift+O",
  streamer: "Ctrl+Shift+S",
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toNativeShortcut(shortcut: string) {
  return shortcut
    .split("+")
    .map(part => {
      if (part === "Ctrl") return "CommandOrControl";
      if (part === "Meta") return "Super";
      return part;
    })
    .join("+");
}

export function useDesktopGlobalShortcuts(
  data: Record<string, unknown> | undefined,
  myUserId: number | undefined
) {
  useEffect(() => {
    if (!myUserId) return;

    const configured = asObject(data?.keybinds);
    const shortcuts = Object.fromEntries(
      (Object.keys(DEFAULT_SHORTCUTS) as ShortcutAction[]).map(action => [
        action,
        typeof configured[action] === "string"
          ? configured[action]
          : DEFAULT_SHORTCUTS[action],
      ])
    ) as Record<ShortcutAction, string>;
    const registered: string[] = [];
    let cancelled = false;

    const runAction = (action: ShortcutAction) => {
      const store = useAppStore.getState();
      if (action === "mute") void voiceManager.toggleMute();
      else if (action === "deafen") void voiceManager.toggleDeafen();
      else if (action === "hangup") void voiceManager.leave();
      else if (action === "open") void invoke("show_window");
      else if (action === "answer" && store.incomingCall) {
        void voiceManager.join({
          conversationId: store.incomingCall.conversationId,
          myId: myUserId,
        });
      } else if (action === "overlay") {
        document.documentElement.classList.toggle("nexora-overlay-mode");
      } else if (action === "streamer") {
        document.documentElement.classList.toggle("nexora-streamer-mode");
      }
    };

    void (async () => {
      for (const action of Object.keys(shortcuts) as ShortcutAction[]) {
        const shortcut = toNativeShortcut(shortcuts[action]);
        try {
          await register(shortcut, event => {
            if (event.state === "Pressed") runAction(action);
          });
          registered.push(shortcut);
        } catch (error) {
          window.dispatchEvent(
            new CustomEvent("nexora:keybind-conflict", {
              detail: {
                action,
                shortcut: shortcuts[action],
                error: String(error),
              },
            })
          );
        }
      }
      if (cancelled && registered.length > 0) {
        await unregister(registered);
      }
    })();

    return () => {
      cancelled = true;
      if (registered.length > 0) void unregister(registered);
    };
  }, [data, myUserId]);

  useEffect(() => {
    if (!myUserId) return;

    const streamer = asObject(data?.streamerMode);
    const baseEnabled = streamer.enabled === true;
    const autoDetect = streamer.autoDetect !== false;
    let disposed = false;

    const detect = async () => {
      try {
        const software = autoDetect
          ? await invoke<string[]>("detect_streaming_software")
          : [];
        if (disposed) return;
        document.documentElement.classList.toggle(
          "nexora-streamer-mode",
          baseEnabled || software.length > 0
        );
        window.dispatchEvent(
          new CustomEvent("nexora:streamer-detected", { detail: software })
        );
      } catch {
        if (!disposed) {
          document.documentElement.classList.toggle(
            "nexora-streamer-mode",
            baseEnabled
          );
        }
      }
    };

    void detect();
    const timer = window.setInterval(() => void detect(), 5_000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [data, myUserId]);
}
