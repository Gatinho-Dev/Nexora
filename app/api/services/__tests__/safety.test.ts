import { describe, expect, it } from "vitest";

import {
  calculateAccountStatus,
  isActivelySuspended,
  restrictionError,
  shouldEscalateToBan,
  MAX_SEVERE_STRIKES,
} from "../accountSafety";
import { decideFromVerdict } from "../mediaModeration";
import type { NormalizedVerdict } from "../nvidiaContentSafety";
import {
  analyzeImage,
  ModerationUnavailableError,
  normalizeVerdict,
} from "../nvidiaContentSafety";
import { env } from "../../lib/env";

const HOUR = 3_600_000;
const DAY = 86_400_000;

// ── Media policy (spec tests 1–3) ─────────────────────────────

describe("decideFromVerdict", () => {
  const v = (
    decision: NormalizedVerdict["decision"],
    sexualMinor = false
  ): NormalizedVerdict => ({
    decision,
    confidence: 0.9,
    categories: [],
    sexualMinor,
    sexualAdult: false,
    raw: null,
  });

  it("test 1: ALLOW → approved e visível normalmente", () => {
    const d = decideFromVerdict(v("ALLOW"));
    expect(d.status).toBe("approved");
    expect(d.sensitive).toBe(false);
    expect(d.allowReveal).toBe(true);
    expect(d.severeMinor).toBe(false);
  });

  it("test 6: SENSITIVE_ADULT → sensitive com blur e revelação", () => {
    const d = decideFromVerdict(v("SENSITIVE_ADULT"));
    expect(d.status).toBe("sensitive");
    expect(d.sensitive).toBe(true);
    expect(d.adultOnly).toBe(true);
    expect(d.allowReveal).toBe(true);
    expect(d.severeMinor).toBe(false);
  });

  it("test 7: BLOCK (minor) → bloqueado sem revelação e caminho severo", () => {
    const d = decideFromVerdict(v("BLOCK", true));
    expect(d.status).toBe("blocked");
    expect(d.allowReveal).toBe(false);
    expect(d.severeMinor).toBe(true);
  });

  it("UNCERTAIN → revisão privada, sem punição", () => {
    const d = decideFromVerdict(v("UNCERTAIN"));
    expect(d.status).toBe("review_required");
    expect(d.severeMinor).toBe(false);
  });
});

// ── Normalização de scores do modelo ──────────────────────────

describe("normalizeVerdict", () => {
  it("scores numéricos NÃO são tratados como boolean truthy", () => {
    // sexual=0.02 é truthy em JS — deve virar ALLOW por threshold.
    const verdict = normalizeVerdict({
      safe: 0.96,
      sexual: 0.02,
      violence: 0.01,
    });
    expect(verdict.decision).toBe("ALLOW");
    expect(verdict.sexualAdult).toBe(false);
  });

  it("sexual >= threshold → SENSITIVE_ADULT", () => {
    const verdict = normalizeVerdict({ safe: 0.1, sexual: 0.8 });
    expect(verdict.decision).toBe("SENSITIVE_ADULT");
  });

  it("minor acima do threshold → BLOCK mesmo com sexual presente", () => {
    const verdict = normalizeVerdict({
      "Sexual (minor)": 0.9,
      Sexual: 0.7,
    });
    expect(verdict.decision).toBe("BLOCK");
    expect(verdict.sexualMinor).toBe(true);
  });

  it("minor abaixo do threshold NÃO pune (falso positivo sério)", () => {
    const verdict = normalizeVerdict({ "Sexual (minor)": 0.3 });
    expect(verdict.sexualMinor).toBe(false);
    expect(["ALLOW", "UNCERTAIN"]).toContain(verdict.decision);
  });

  it("boolean safe=false com categorias nomeadas → sensível", () => {
    const verdict = normalizeVerdict({ safe: false, categories: ["Violence"] });
    expect(["SENSITIVE_ADULT", "UNCERTAIN"]).toContain(verdict.decision);
  });

  it("strings de score são normalizadas ('high'/'0.9')", () => {
    const verdict = normalizeVerdict({ sexual: "high" });
    expect(verdict.decision).toBe("SENSITIVE_ADULT");
  });

  it("payload irreconhecível lança INVALID_RESPONSE (nunca unsafe)", () => {
    expect(() => normalizeVerdict("texto solto")).toThrow();
    expect(() => normalizeVerdict({ foo: "bar" })).toThrow();
  });

  // ── Regressões: toda imagem virava +18 ──────────────────────

  it("REGRESSÃO: categorias como strings + safe alto NÃO são +18", () => {
    // Formato real do llama-3.2-11b: labels sem score junto de safe 0.92.
    const verdict = normalizeVerdict({
      safe: 0.92,
      categories: ["Violence", "Sexual"],
    });
    expect(verdict.decision).toBe("ALLOW");
    expect(verdict.sexualAdult).toBe(false);
  });

  it("REGRESSÃO: flagged sem nenhuma categoria pontuada → UNCERTAIN (não +18)", () => {
    const verdict = normalizeVerdict({ safe: 0.4 });
    expect(["ALLOW", "UNCERTAIN"]).toContain(verdict.decision);
    expect(verdict.decision).not.toBe("SENSITIVE_ADULT");
  });

  it("REGRESSÃO: escala percentual (0..100) é normalizada", () => {
    const verdict = normalizeVerdict({
      safe: 90,
      categories: [{ category: "Sexual", score: 5 }],
    });
    expect(verdict.decision).toBe("ALLOW");
  });

  it("formato canônico seguro continua ALLOW", () => {
    const verdict = normalizeVerdict({
      safe: 0.98,
      categories: [{ category: "Sexual", score: 0.01 }],
    });
    expect(verdict.decision).toBe("ALLOW");
  });

  it("flagged com violência confusa e score explícito alto segue sensível", () => {
    const verdict = normalizeVerdict({ safe: 0.05, violence: 0.9 });
    expect(verdict.decision).toBe("SENSITIVE_ADULT");
  });
});

// ── Magic bytes ───────────────────────────────────────────────

describe("isRealImage", () => {
  it("reconhece JPEG/PNG/GIF/WebP reais", async () => {
    const { isRealImage } = await import("../mediaModeration");
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]);
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(16)]);
    const gif = Buffer.concat([Buffer.from([0x47, 0x49, 0x46, 0x38]), Buffer.alloc(16)]);
    const webp = Buffer.concat([
      Buffer.from("RIFF"),
      Buffer.alloc(4),
      Buffer.from("WEBP"),
      Buffer.alloc(8),
    ]);
    const fake = Buffer.from("%PDF-1.4 texto qualquer");
    expect(isRealImage(jpeg)).toBe(true);
    expect(isRealImage(png)).toBe(true);
    expect(isRealImage(gif)).toBe(true);
    expect(isRealImage(webp)).toBe(true);
    expect(isRealImage(fake)).toBe(false);
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
