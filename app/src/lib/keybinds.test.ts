import { describe, expect, it } from "vitest";
import { DEFAULT_KEYBINDS, duplicateKeybinds, keybindFromEvent, parseKeybinds } from "./keybinds";

describe("keybind preferences", () => {
  it("uses defaults for missing or invalid data", () => {
    expect(parseKeybinds(undefined)).toEqual(DEFAULT_KEYBINDS);
    expect(parseKeybinds({ keybinds: [] })).toEqual(DEFAULT_KEYBINDS);
  });

  it("preserves configured bindings and fills missing actions", () => {
    const result = parseKeybinds({ keybinds: { mute: "Alt+M" } });
    expect(result.mute).toBe("Alt+M");
    expect(result.deafen).toBe(DEFAULT_KEYBINDS.deafen);
  });

  it("detects duplicate shortcuts", () => {
    expect(duplicateKeybinds({ mute: "Ctrl+M", deafen: "Ctrl+M", open: "Ctrl+N" })).toEqual(new Set(["Ctrl+M"]));
  });

  it("normalizes keyboard events", () => {
    expect(keybindFromEvent({ ctrlKey: true, altKey: false, shiftKey: true, metaKey: false, key: "m" } as KeyboardEvent)).toBe("Ctrl+Shift+M");
  });
});
