import { describe, expect, it } from "vitest";

import { evaluateAutomod } from "../automod/engine";
import { inspectTextForUrls, inspectUrl } from "../urlSafety";
import { decideTextAction } from "../textModeration";
import { priorityForCategory } from "../reports/moderationCaseService";
import { reportPriority } from "../reports/reportService";
import { shouldLiftPermanentBan } from "../appeals/appealService";
import type { SafetyResult } from "../safety/safetyParser";

// ── AutoMod engine ────────────────────────────────────────────

describe("evaluateAutomod", () => {
  it("flood dispara quando excede N mensagens na janela", () => {
    const now = Date.now();
    const verdict = evaluateAutomod(
      { flood: { enabled: true, maxMessages: 3, windowSeconds: 10 } },
      {
        content: "oi",
        // 3 mensagens prévias na janela + a atual = a 4ª em <10s.
        recentTimestamps: [now - 1000, now - 2000, now - 3000],
        recentContents: [],
        mentionCount: 0,
        now,
      }
    );
    expect(verdict.triggered).toContain("flood");
    expect(verdict.block).toBe(true);
    const ok = evaluateAutomod(
      { flood: { enabled: true, maxMessages: 5, windowSeconds: 10 } },
      {
        content: "oi",
        recentTimestamps: [now - 1000, now - 2000],
        recentContents: [],
        mentionCount: 0,
        now,
      }
    );
    expect(ok.block).toBe(false);
  });

  it("repeat dispara com mensagens idênticas consecutivas", () => {
    const verdict = evaluateAutomod(
      { repeat: { enabled: true, maxRepeats: 3 } },
      {
        content: "compra barato",
        recentContents: ["compra barato", "compra barato"],
        recentTimestamps: [],
        mentionCount: 0,
      }
    );
    expect(verdict.triggered).toEqual(["repeat"]);
  });

  it("mass_mention respeita limite configurado", () => {
    const ok = evaluateAutomod(
      { mass_mention: { enabled: true, maxMentions: 5 } },
      { content: "oi @a @b @c @d @e", recentContents: [], recentTimestamps: [], mentionCount: 5 }
    );
    expect(ok.block).toBe(false);
    const bad = evaluateAutomod(
      { mass_mention: { enabled: true, maxMentions: 4 } },
      { content: "oi @a @b @c @d @e", recentContents: [], recentTimestamps: [], mentionCount: 5 }
    );
    expect(bad.triggered).toContain("mass_mention");
  });

  it("blocked_words detecta termo bloqueado (case-insensitive)", () => {
    const verdict = evaluateAutomod(
      { blocked_words: { enabled: true, words: ["Proibido"] } },
      { content: "isso é proibido aqui", recentContents: [], recentTimestamps: [], mentionCount: 0 }
    );
    expect(verdict.block).toBe(true);
  });
});

// ── UrlSafety ─────────────────────────────────────────────────

describe("UrlSafety", () => {
  it("URL normal não é suspeita", () => {
    expect(inspectUrl("https://example.com/pagina").suspicious).toBe(false);
  });

  it("detecta IP literal, punycode, encurtador e executável", () => {
    expect(inspectUrl("http://192.168.1.10/login").reasons).toContain("ip_literal_host");
    expect(inspectUrl("https://xn--exemplo-2za.com/").reasons).toContain("punycode");
    expect(inspectUrl("https://bit.ly/abc").reasons).toContain("url_shortener");
    expect(inspectUrl("https://cdn.evil.com/payload.exe").reasons).toContain(
      "executable_download"
    );
  });

  it("detecta palavra-chave de phishing e credenciais embutidas", () => {
    expect(inspectUrl("https://free-nitro.rickroll.xyz/gift").suspicious).toBe(true);
    expect(inspectUrl("https://user:pass@exemplo.com/").reasons).toContain(
      "embedded_credentials"
    );
  });

  it("inspectTextForUrls detecta convite de outra plataforma", () => {
    const info = inspectTextForUrls("entre em https://discord.gg/abcd");
    expect(info.inviteLink).toBe(true);
  });
});

// ── Política de texto ─────────────────────────────────────────

describe("decideTextAction", () => {
  const result = (
    categories: SafetyResult["categories"],
    safe = categories.length === 0
  ): SafetyResult => ({
    safe,
    categories,
    provider: "openrouter",
    model: "test-model",
    analyzedAt: new Date(),
  });

  it("SAFE → permitir", () => {
    expect(decideTextAction(result([])).action).toBe("allow");
  });

  it("sexual_minor SEMPRE remove + suspende (ordem obrigatória)", () => {
    const d = decideTextAction(result(["sexual_minor"]));
    expect(d.action).toBe("remove_and_suspend");
    // Mesmo com sexual adulto presente, minor vence.
    const d2 = decideTextAction(result(["sexual_minor", "sexual"]));
    expect(d2.action).toBe("remove_and_suspend");
  });

  it("violência/ódio → caso para revisão humana (sem punição automática)", () => {
    expect(decideTextAction(result(["harassment"])).action).toBe("review");
    expect(decideTextAction(result(["hate"], false)).action).toBe("review");
  });
});

// ── Priorização (triagem) ─────────────────────────────────────

describe("prioridades de denúncia/caso", () => {
  it("segurança de menores é sempre CRITICAL", () => {
    expect(reportPriority("minor_safety")).toBe("critical");
    expect(priorityForCategory("minor_safety")).toBe("critical");
    expect(priorityForCategory("other", "critical")).toBe("critical");
  });

  it("violência/autolesão/ilegal → HIGH", () => {
    for (const c of ["violence", "self_harm", "illegal"]) {
      expect(reportPriority(c)).toBe("high");
    }
  });

  it("spam → LOW e brigading só eleva via escalate explícito", () => {
    expect(reportPriority("spam_or_scam")).toBe("low");
  });
});

// ── Apelações: regra pura do banimento ────────────────────────

describe("shouldLiftPermanentBan", () => {
  it("abaixo do limite de strikes → ban deve ser levantado", () => {
    expect(shouldLiftPermanentBan(2)).toBe(true);
    expect(shouldLiftPermanentBan(0)).toBe(true);
  });

  it("no limite ou acima → mantém banimento", () => {
    expect(shouldLiftPermanentBan(3)).toBe(false);
    expect(shouldLiftPermanentBan(4)).toBe(false);
  });
});
