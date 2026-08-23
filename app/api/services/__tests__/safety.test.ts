import { describe, expect, it } from "vitest";

import {
  calculateAccountStatus,
  isActivelySuspended,
  restrictionError,
  shouldEscalateToBan,
  MAX_SEVERE_STRIKES,
} from "../accountSafety";
import { decidePolicy } from "../mediaModeration";
import {
  analyzeImage,
  ModerationUnavailableError,
  SEXUAL_MARKERS,
  SEXUAL_MINOR_MARKERS,
} from "../nvidiaContentSafety";
import { env } from "../../lib/env";

const HOUR = 3_600_000;
const DAY = 86_400_000;

// ── Media policy (spec tests 1–3) ─────────────────────────────

describe("decidePolicy", () => {
  it("test 1: imagem segura → approved e visível normalmente", () => {
    const d = decidePolicy({ safe: true, sexualMinor: false, sexualAdult: false, categories: [] });
    expect(d.status).toBe("approved");
    expect(d.sensitive).toBe(false);
    expect(d.allowReveal).toBe(true);
  });

  it("test 2: Sexual adulto → sensitive com blur +18 e botão mostrar", () => {
    const d = decidePolicy({ safe: false, sexualMinor: false, sexualAdult: true, categories: ["Sexual"] });
    expect(d.status).toBe("sensitive");
    expect(d.sensitive).toBe(true);
    expect(d.adultOnly).toBe(true);
    expect(d.allowReveal).toBe(true);
  });

  it("test 3: Sexual (minor) → blocked SEM revelação (ordem checada antes de Sexual)", () => {
    // Even if a generic "Sexual" marker also appears, minor wins.
    const d = decidePolicy({ safe: false, sexualMinor: true, sexualAdult: true, categories: ["Sexual (minor)", "Sexual"] });
    expect(d.severeMinor).toBe(true);
    expect(d.status).toBe("blocked");
    expect(d.allowReveal).toBe(false);
  });

  it("outras categorias unsafe ficam sensíveis genéricas", () => {
    const d = decidePolicy({ safe: false, sexualMinor: false, sexualAdult: false, categories: ["Violence"] });
    expect(d.status).toBe("sensitive");
    expect(d.adultOnly).toBe(false);
    expect(d.allowReveal).toBe(true);
  });

  it("marcadores cobrem variantes de nomenclatura do modelo", () => {
    expect(SEXUAL_MINOR_MARKERS.some(m => "sexual (minor)".includes(m))).toBe(true);
    expect(SEXUAL_MARKERS.some(m => "Sexual".toLowerCase().includes(m))).toBe(true);
  });
});

// ── Account status mapping (spec tests 7–9 + suspensão) ───────

describe("calculateAccountStatus", () => {
  const base = { permanentBan: false, suspendedUntil: null as Date | null };

  it("test 1/7: sem infrações → good_standing (Tudo certo)", () => {
    expect(calculateAccountStatus({ ...base, severeStrikes: 0 })).toBe("good_standing");
  });

  it("primeiro strike confirmado → limited", () => {
    expect(calculateAccountStatus({ ...base, severeStrikes: 1 })).toBe("limited");
  });

  it("segundo strike → at_risk", () => {
    expect(calculateAccountStatus({ ...base, severeStrikes: 2 })).toBe("at_risk");
  });

  it("suspensão ativa → suspended", () => {
    const until = new Date(Date.now() + 2 * DAY);
    expect(calculateAccountStatus({ ...base, severeStrikes: 0, suspendedUntil: until })).toBe("suspended");
  });

  it("test 14: suspensão expirada restaura o nível subjacente automaticamente", () => {
    const past = new Date(Date.now() - HOUR);
    expect(isActivelySuspended({ suspendedUntil: past, permanentBan: false })).toBe(false);
    expect(
      calculateAccountStatus({ ...base, severeStrikes: 1, suspendedUntil: past })
    ).toBe("limited");
  });

  it("test 9: banimento permanente tem precedência máxima", () => {
    expect(
      calculateAccountStatus({ permanentBan: true, suspendedUntil: null, severeStrikes: MAX_SEVERE_STRIKES })
    ).toBe("permanently_banned");
  });
});

describe("shouldEscalateToBan", () => {
  it("test 9: terceiro strike confirmado escalona para banimento", () => {
    expect(shouldEscalateToBan(2)).toBe(false);
    expect(shouldEscalateToBan(3)).toBe(true);
  });
});

// ── Route guards (spec tests 10–11) ───────────────────────────

describe("restrictionError", () => {
  it("usuário suspenso recebe mensagem de bloqueio", () => {
    const until = new Date(Date.now() + DAY);
    expect(restrictionError({ suspendedUntil: until, permanentBan: false })).toMatch(/suspen/i);
  });

  it("usuário banido recebe 403 mesmo chamando a API diretamente", () => {
    const err = restrictionError({ suspendedUntil: null, permanentBan: true });
    expect(err).toMatch(/permanentemente banida/i);
  });

  it("usuário em boa conta não é bloqueado", () => {
    expect(restrictionError({ suspendedUntil: null, permanentBan: false })).toBeNull();
  });
});

// ── NVIDIA failures keep media private (spec test 12) ─────────

describe("analyzeImage availability", () => {
  it("sem chave configurada lança indisponibilidade (mídia NÃO é aprovada)", async () => {
    const original = env.nvidiaApiKey;
    try {
      (env as unknown as { nvidiaApiKey: string }).nvidiaApiKey = "";
      await expect(analyzeImage(Buffer.from("x"), "image/png")).rejects.toBeInstanceOf(
        ModerationUnavailableError
      );
    } finally {
      (env as unknown as { nvidiaApiKey: string }).nvidiaApiKey = original;
    }
  });
});
