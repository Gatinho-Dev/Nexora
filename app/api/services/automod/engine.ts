/**
 * AutoMod engine — regras rápidas LOCAIS por servidor.
 * Coisas simples (flood, repetição, palavras bloqueadas) NUNCA vão para IA.
 * Hierarquia: regras globais > segurança por IA > AutoMod do servidor
 * (servidor pode ser mais restritivo, nunca mais permissivo que o global).
 */

import { inspectTextForUrls } from "../urlSafety";

export type AutomodRuleType =
  | "flood"
  | "repeat"
  | "mass_mention"
  | "blocked_words"
  | "invites"
  | "suspicious_links";

export type AutomodRuleConfig = {
  enabled: boolean;
  /** flood: máx. mensagens na janela */
  maxMessages?: number;
  /** janela em segundos */
  windowSeconds?: number;
  /** repeat: mensagens idênticas consecutivas permitidas */
  maxRepeats?: number;
  /** mass_mention: máximo de menções por mensagem */
  maxMentions?: number;
  /** blocked_words: lista de termos */
  words?: string[];
};

export type AutomodContext = {
  content: string;
  /** Timestamps (ms) das mensagens recentes do autor no canal. */
  recentTimestamps: number[];
  /** Conteúdos recentes do autor (para detecção de repetição). */
  recentContents: string[];
  mentionCount: number;
  now?: number;
};

export type AutomodVerdict = {
  triggered: AutomodRuleType[];
  /** true => mensagem deve ser recusada. */
  block: boolean;
};

export const DEFAULT_AUTOMOD_CONFIG: Record<AutomodRuleType, AutomodRuleConfig> = {
  flood: { enabled: false, maxMessages: 10, windowSeconds: 10 },
  repeat: { enabled: false, maxRepeats: 3 },
  mass_mention: { enabled: false, maxMentions: 6 },
  blocked_words: { enabled: false, words: [] },
  invites: { enabled: false },
  suspicious_links: { enabled: false },
};

/** Avaliação PURA das regras — unit-tested. */
export function evaluateAutomod(
  rules: Partial<Record<AutomodRuleType, AutomodRuleConfig>>,
  ctx: AutomodContext
): AutomodVerdict {
  const triggered: AutomodRuleType[] = [];
  const now = ctx.now ?? Date.now();

  const floodCfg = rules.flood;
  if (floodCfg?.enabled) {
    const windowMs = (floodCfg.windowSeconds ?? 10) * 1000;
    const max = floodCfg.maxMessages ?? 10;
    const inWindow = ctx.recentTimestamps.filter(t => now - t < windowMs);
    if (inWindow.length >= max) triggered.push("flood");
  }

  const repeatCfg = rules.repeat;
  if (repeatCfg?.enabled) {
    const max = repeatCfg.maxRepeats ?? 3;
    const lastN = ctx.recentContents.slice(-(max - 1));
    if (
      ctx.content.trim().length > 0 &&
      lastN.length === max - 1 &&
      lastN.every(c => c.trim() === ctx.content.trim())
    ) {
      triggered.push("repeat");
    }
  }

  const mentionCfg = rules.mass_mention;
  if (mentionCfg?.enabled && ctx.mentionCount > (mentionCfg.maxMentions ?? 6)) {
    triggered.push("mass_mention");
  }

  const wordsCfg = rules.blocked_words;
  if (wordsCfg?.enabled && (wordsCfg.words?.length ?? 0) > 0) {
    const normalized = ctx.content.toLowerCase();
    const hit = wordsCfg.words!.some(w => {
      const term = w.trim().toLowerCase();
      return term.length > 0 && normalized.includes(term);
    });
    if (hit) triggered.push("blocked_words");
  }

  const urlInfo = inspectTextForUrls(ctx.content);

  if (rules.invites?.enabled && urlInfo.inviteLink) {
    triggered.push("invites");
  }

  if (rules.suspicious_links?.enabled && urlInfo.suspicious) {
    triggered.push("suspicious_links");
  }

  return { triggered, block: triggered.length > 0 };
}

export function automodBlockMessage(rules: AutomodRuleType[]): string {
  if (rules.includes("flood")) {
    return "Você está enviando mensagens rápido demais neste canal (AutoMod).";
  }
  if (rules.includes("repeat")) {
    return "Evite repetir a mesma mensagem (AutoMod).";
  }
  if (rules.includes("mass_mention")) {
    return "Esta mensagem menciona pessoas demais (AutoMod).";
  }
  if (rules.includes("blocked_words")) {
    return "Esta mensagem contém palavras bloqueadas neste servidor (AutoMod).";
  }
  if (rules.includes("invites")) {
    return "Convites não são permitidos neste servidor (AutoMod).";
  }
  if (rules.includes("suspicious_links")) {
    return "Este link foi bloqueado por suspeita de golpe ou phishing (AutoMod).";
  }
  return "Mensagem bloqueada pelo AutoMod deste servidor.";
}
