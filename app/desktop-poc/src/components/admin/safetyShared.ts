import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";

export const CASE_CATEGORY_LABELS: Record<string, string> = {
  minor_safety: "Segurança de menores",
  harassment: "Assédio",
  hate: "Ódio",
  violence: "Violência",
  self_harm: "Autolesão",
  scam_or_spam: "Golpe/Spam",
  sexual_content: "Conteúdo sexual",
  privacy: "Privacidade",
  server_content: "Conteúdo do servidor",
  illegal: "Ilegal",
  other: "Outro",
};

export const PRIORITY_BADGE_CLASSES: Record<string, string> = {
  critical: "border-red-500/30 bg-red-500/15 text-red-300",
  high: "border-orange-500/30 bg-orange-500/15 text-orange-300",
  normal: "border-blue-500/30 bg-blue-500/15 text-blue-300",
  low: "border-white/10 bg-white/[0.06] text-[#9da4ae]",
};

export const PRIORITY_LABELS: Record<string, string> = {
  critical: "Crítico",
  high: "Alta",
  normal: "Normal",
  low: "Baixa",
};

export const AUDIT_EVENT_LABELS: Record<string, string> = {
  report_submitted: "Denúncia enviada",
  moderation_case_created: "Caso criado",
  automod_triggered: "AutoMod acionado",
  appeal_approved: "Apelação aprovada",
  appeal_denied: "Apelação negada",
  severe_violation_auto_suspension: "Suspensão automática (grave)",
  text_flagged: "Texto sinalizado",
  public_field_flagged: "Campo público sinalizado",
  moderator_warn: "Advertência manual",
  moderator_manual_suspension: "Suspensão manual",
  moderator_unban: "Desbanimento",
  safety_kill_switch_on: "Kill switch ligado",
  safety_kill_switch_off: "Kill switch desligado",
};

export function translateAuditEvent(event: string): string {
  return AUDIT_EVENT_LABELS[event] ?? event;
}

export function timeAgo(value: string | Date): string {
  return formatDistanceToNowStrict(new Date(value), {
    addSuffix: true,
    locale: ptBR,
  });
}

export type AiAssessmentShape = {
  safe?: boolean;
  categories?: string[];
  confidence?: number;
  policyVersion?: string;
} & Record<string, unknown>;

export function parseAiAssessment(
  value: unknown
): AiAssessmentShape | null {
  if (!value || typeof value !== "object") return null;
  return value as AiAssessmentShape;
}
