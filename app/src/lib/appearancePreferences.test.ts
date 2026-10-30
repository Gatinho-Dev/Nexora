import { describe, expect, it } from "vitest";
import { DEFAULT_APPEARANCE_PREFERENCES, parseAppearancePreferences } from "./appearancePreferences";

describe("appearance preference parsing", () => {
  it("returns stable defaults", () => {
    expect(parseAppearancePreferences(undefined)).toEqual(DEFAULT_APPEARANCE_PREFERENCES);
  });

  it("clamps scale, text size and spacing from untrusted sync data", () => {
    expect(parseAppearancePreferences({ appearance: {
      theme: "light",
      messageDensity: "compact",
      uiScale: 999,
      messageTextSize: 2,
      messageSpacing: 200,
    } })).toEqual({
      theme: "light",
      messageDensity: "compact",
      uiScale: 150,
      messageTextSize: 12,
      messageSpacing: 100,
    });
  });
});
