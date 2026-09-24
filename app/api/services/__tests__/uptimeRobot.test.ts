import { describe, expect, it } from "vitest";
import { mapStatus, mapType } from "../uptimeRobot";

describe("uptimeRobot — mapStatus", () => {
  it("mapeia os códigos numéricos da API v2", () => {
    expect(mapStatus(2)).toBe("up");
    expect(mapStatus(9)).toBe("down");
    expect(mapStatus(8)).toBe("seems_down");
    expect(mapStatus(0)).toBe("paused");
    expect(mapStatus(1)).toBe("not_checked_yet");
  });

  it("aceita strings numéricas (a API às vezes envia string)", () => {
    expect(mapStatus("2")).toBe("up");
    expect(mapStatus("9")).toBe("down");
  });

  it("fallback seguro para valores desconhecidos", () => {
    expect(mapStatus(undefined)).toBe("not_checked_yet");
    expect(mapStatus(null)).toBe("not_checked_yet");
    expect(mapStatus(999)).toBe("not_checked_yet");
    expect(mapStatus("abc")).toBe("not_checked_yet");
  });
});

describe("uptimeRobot — mapType", () => {
  it("mapeia os tipos de monitor da API", () => {
    expect(mapType(1)).toBe("HTTP(s)");
    expect(mapType(2)).toBe("Keyword");
    expect(mapType(3)).toBe("Ping");
    expect(mapType(4)).toBe("Port");
    expect(mapType(5)).toBe("Heartbeat");
  });

  it("fallback seguro para tipos desconhecidos", () => {
    expect(mapType(undefined)).toBe("Desconhecido");
    expect(mapType(42)).toBe("Desconhecido");
  });
});
