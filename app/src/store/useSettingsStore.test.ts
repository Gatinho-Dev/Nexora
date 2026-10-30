import { beforeEach, describe, expect, it } from "vitest";
import { useSettingsStore } from "./useSettingsStore";
import { DEFAULT_CLIENT_SETTINGS } from "@/lib/clientSettings";

describe("useSettingsStore", () => {
  beforeEach(() => {
    useSettingsStore.setState({
      settings: { ...DEFAULT_CLIENT_SETTINGS },
      hydrated: false,
    });
  });

  it("aplica patch parcial preservando o resto das preferências", () => {
    const before = useSettingsStore.getState().settings;
    useSettingsStore.getState().patch({ bypassProcessing: true });

    const after = useSettingsStore.getState().settings;
    expect(after.bypassProcessing).toBe(true);
    expect(after.inputVolume).toBe(before.inputVolume);
    expect(after.voiceInputMode).toBe(before.voiceInputMode);
  });

  it("hidrata a partir do servidor e normaliza valores inválidos", () => {
    useSettingsStore.getState().hydrate({
      inputVolume: 1000,
      spamFilter: "nao-existe",
    });

    const { settings, hydrated } = useSettingsStore.getState();
    expect(hydrated).toBe(true);
    expect(settings.inputVolume).toBe(200);
    expect(settings.spamFilter).toBe(DEFAULT_CLIENT_SETTINGS.spamFilter);
  });

  it("reset devolve todos os campos ao default", () => {
    useSettingsStore.getState().patch({
      hardwareAcceleration: false,
      registeredGames: ["valorant"],
    });
    useSettingsStore.getState().reset();

    expect(useSettingsStore.getState().settings).toEqual(
      DEFAULT_CLIENT_SETTINGS
    );
  });
});
