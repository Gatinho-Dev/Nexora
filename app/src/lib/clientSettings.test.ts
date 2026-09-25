import { describe, expect, it } from "vitest";
import {
  CUSTOM_GAME_PREFIX,
  DEFAULT_CLIENT_SETTINGS,
  parseClientSettings,
} from "./clientSettings";

describe("parseClientSettings", () => {
  it("devolve os defaults quando o blob está ausente ou corrompido", () => {
    expect(parseClientSettings(undefined)).toEqual(DEFAULT_CLIENT_SETTINGS);
    expect(parseClientSettings(null)).toEqual(DEFAULT_CLIENT_SETTINGS);
    expect(parseClientSettings("lixo")).toEqual(DEFAULT_CLIENT_SETTINGS);
    expect(parseClientSettings([1, 2, 3])).toEqual(DEFAULT_CLIENT_SETTINGS);
  });

  it("preserva apenas valores de enumeração conhecidos", () => {
    const parsed = parseClientSettings({
      explicitMediaFriends: "block",
      explicitMediaUnknown: "inexistente",
      spamFilter: "all",
      friendRequests: "servidores-inexistentes",
      voiceInputMode: "ptt",
    });

    expect(parsed.explicitMediaFriends).toBe("block");
    // Valor desconhecido cai no default, não é aceitado como está.
    expect(parsed.explicitMediaUnknown).toBe(
      DEFAULT_CLIENT_SETTINGS.explicitMediaUnknown
    );
    expect(parsed.spamFilter).toBe("all");
    expect(parsed.friendRequests).toBe(
      DEFAULT_CLIENT_SETTINGS.friendRequests
    );
    expect(parsed.voiceInputMode).toBe("ptt");
  });

  it("limita sliders aos limites declarados", () => {
    const parsed = parseClientSettings({
      inputVolume: 9999,
      outputVolume: -40,
      attenuation: Number.NaN,
    });

    expect(parsed.inputVolume).toBe(200);
    expect(parsed.outputVolume).toBe(0);
    // NaN não é finito: volta ao default em vez de quebrar a interface.
    expect(parsed.attenuation).toBe(DEFAULT_CLIENT_SETTINGS.attenuation);
  });

  it("mantém apenas jogos do catálogo ou entradas customizadas válidas", () => {
    const parsed = parseClientSettings({
      registeredGames: [
        "valorant",
        "jogo-que-nao-existe",
        `${CUSTOM_GAME_PREFIX}C:\\Jogos\\meu-jogo.exe`,
        `${CUSTOM_GAME_PREFIX}   `,
        42,
      ],
    });

    expect(parsed.registeredGames).toEqual([
      "valorant",
      `${CUSTOM_GAME_PREFIX}C:\\Jogos\\meu-jogo.exe`,
    ]);
  });

  it("descarta preferências booleanas que não são booleanas", () => {
    const parsed = parseClientSettings({
      linkEmbeds: "sim",
      convertEmoticons: true,
    });

    expect(parsed.linkEmbeds).toBe(DEFAULT_CLIENT_SETTINGS.linkEmbeds);
    expect(parsed.convertEmoticons).toBe(true);
  });
});
