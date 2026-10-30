export type ReportTargetType =
  | "message"
  | "user"
  | "media"
  | "server"
  | "channel";

export type ReportTarget = {
  type: ReportTargetType;
  id: number;
  label?: string;
};

export const REPORT_CATEGORY_LABELS: Record<string, string> = {
  harassment: "Assédio ou bullying",
  hate: "Discurso de ódio",
  sexual: "Conteúdo sexual",
  minor_safety: "Segurança de menores",
  violence: "Violência",
  self_harm: "Automutilação",
  spam_or_scam: "Spam ou golpe",
  personal_info: "Informações pessoais",
  impersonation: "Impersonação",
  illegal: "Conteúdo ilegal",
  other: "Outro",
};

export const MINOR_SAFETY_SUBCATEGORY_LABELS: Record<string, string> = {
  sexual_content_involving_minor: "Conteúdo sexual envolvendo possível menor",
  grooming_or_exploitation: "Aliciamento ou exploração",
  predatory_behavior: "Comportamento predatório",
  other_minor_risk: "Outro risco envolvendo menor",
};

export const REPORT_TARGET_TYPE_LABELS: Record<ReportTargetType, string> = {
  message: "mensagem",
  user: "usuário",
  media: "conteúdo",
  server: "servidor",
  channel: "canal",
};
