import { Resend } from "resend";
import { env } from "../lib/env";

const BRAND = {
  ink: "#1b1f2a",
  muted: "#687184",
  cobalt: "#4654d8",
  cobaltLight: "#7383ff",
  surface: "#ffffff",
  canvas: "#f4f7fb",
  border: "#e5e9f2",
};

const BRAND_NAME = "Nexora";
const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export type EmailAction = {
  label: string;
  url: string;
};

export type EmailTemplate = {
  subject: string;
  html: string;
  text: string;
};

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    character =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] ?? character,
  );
}

function appBaseUrl(): string | null {
  const value = env.appBaseUrl || env.appOrigin || env.publicApiUrl;
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function actionUrl(path: string, token?: string): string | null {
  const base = appBaseUrl();
  if (!base) return null;
  const url = new URL(path, `${base}/`);
  if (token) url.searchParams.set("token", token);
  return url.toString();
}

function logoUrl(): string | null {
  if (env.resendLogoUrl) {
    try {
      const url = new URL(env.resendLogoUrl);
      return url.protocol === "https:" || url.protocol === "http:"
        ? url.toString()
        : null;
    } catch {
      return null;
    }
  }
  const base = appBaseUrl();
  return base ? `${base}/brand/nexora-logo-light.png` : null;
}

function EmailLogo() {
  const source = logoUrl();
  if (source) {
    return `<img src="${escapeHtml(source)}" alt="Nexora" width="175" height="38" style="display:block;width:175px;height:38px;border:0;outline:none;text-decoration:none;" />`;
  }
  return `<div style="color:${BRAND.ink};font-family:${FONT_STACK};font-size:26px;font-weight:800;letter-spacing:-0.05em;line-height:38px;">${BRAND_NAME}</div>`;
}

function EmailButton(action: EmailAction) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;margin:32px 0 0;"><tr><td align="center" bgcolor="${BRAND.cobalt}" style="border-radius:999px;box-shadow:0 10px 24px rgba(70,84,216,.22);"><a href="${escapeHtml(action.url)}" style="display:inline-block;padding:15px 24px;color:#ffffff;font-family:${FONT_STACK};font-size:15px;font-weight:700;line-height:18px;text-decoration:none;border-radius:999px;">${escapeHtml(action.label)}</a></td></tr></table>`;
}

function SecurityNotice(children: string) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse:collapse;margin-top:28px;"><tr><td bgcolor="${BRAND.canvas}" style="border-left:3px solid ${BRAND.cobaltLight};padding:15px 17px;color:${BRAND.muted};font-family:${FONT_STACK};font-size:13px;line-height:20px;">${children}</td></tr></table>`;
}

function EmailFooter() {
  const url = actionUrl("/channels/@me");
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse:collapse;margin-top:32px;border-top:1px solid ${BRAND.border};"><tr><td style="padding-top:22px;color:${BRAND.muted};font-family:${FONT_STACK};font-size:12px;line-height:19px;">${url ? `<a href="${escapeHtml(url)}" style="color:${BRAND.cobalt};font-weight:700;text-decoration:none;">${BRAND_NAME}</a> · ` : ""}Mensagem transacional oficial.<br />© 2026 Nexora<br />Se você não solicitou esta ação, pode ignorar este e-mail com segurança.</td></tr></table>`;
}

function EmailLayout(input: {
  preheader: string;
  title: string;
  content: string;
  action?: EmailAction;
}) {
  const action = input.action
    ? `${EmailButton(input.action)}<p style="margin:16px 0 0;color:${BRAND.muted};font-family:${FONT_STACK};font-size:12px;line-height:19px;text-align:center;">Não funcionou? <a href="${escapeHtml(input.action.url)}" style="color:${BRAND.cobalt};font-weight:700;text-decoration:underline;word-break:break-all;">Abrir o link no navegador</a></p>`
    : "";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><meta name="color-scheme" content="light" /><meta name="supported-color-schemes" content="light" /><title>${escapeHtml(input.title)}</title></head><body style="margin:0;padding:0;background:${BRAND.canvas};color:${BRAND.ink};font-family:${FONT_STACK};-webkit-font-smoothing:antialiased;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(input.preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;width:100%;background:${BRAND.canvas};"><tr><td align="center" style="padding:36px 14px 48px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;width:100%;max-width:640px;"><tr><td style="padding:0 8px 24px;">${EmailLogo()}</td></tr><tr><td bgcolor="${BRAND.surface}" style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:24px;box-shadow:0 18px 50px rgba(17,19,26,.07);"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;"><tr><td style="padding:40px 40px 0;"><p style="margin:0;color:${BRAND.cobalt};font-family:${FONT_STACK};font-size:11px;font-weight:800;letter-spacing:.14em;line-height:16px;text-transform:uppercase;">NEXORA · MENSAGEM SEGURA</p></td></tr><tr><td style="padding:18px 40px 0;"><h1 style="margin:0;color:${BRAND.ink};font-family:${FONT_STACK};font-size:30px;font-weight:750;letter-spacing:-.035em;line-height:38px;">${escapeHtml(input.title)}</h1></td></tr><tr><td style="padding:16px 40px 0;"><div style="color:#394154;font-family:${FONT_STACK};font-size:16px;line-height:26px;">${input.content}</div></td></tr><tr><td style="padding:0 40px 36px;">${action}</td></tr><tr><td style="padding:0 40px 36px;">${EmailFooter()}</td></tr></table></td></tr></table></td></tr></table></body></html>`;
}

function plainLayout(title: string, lines: string[], action?: EmailAction) {
  return [title, "", ...lines, action ? `\n${action.label}: ${action.url}` : "", "", "© 2026 Nexora"].join("\n");
}

export function emailVerificationTemplate(input: { email: string; token: string }): EmailTemplate | null {
  const url = actionUrl("/verify-email", input.token);
  if (!url) return null;
  const action = { label: "Verificar meu e-mail", url };
  return {
    subject: "Verifique seu e-mail — Nexora",
    html: EmailLayout({
      preheader: "Confirme seu endereço de e-mail para proteger sua conta Nexora.",
      title: "Verifique seu e-mail",
      content: `<p style="margin:0 0 14px;">Bem-vindo ao Nexora! 👋</p><p style="margin:0;">Para concluir a configuração da sua conta, confirme seu endereço de e-mail.</p>${SecurityNotice("Este link é válido por um período limitado. Se você não criou uma conta no Nexora, ignore este e-mail.")}`,
      action,
    }),
    text: plainLayout(
      "Verifique seu e-mail — Nexora",
      [
        "Bem-vindo ao Nexora! 👋",
        "Para concluir a configuração da sua conta, confirme seu endereço de e-mail.",
        "Este link é válido por um período limitado.",
        "Se você não criou uma conta no Nexora, ignore este e-mail.",
      ],
      action,
    ),
  };
}

export function passwordResetTemplate(input: { token: string }): EmailTemplate | null {
  const url = actionUrl("/reset-password", input.token);
  if (!url) return null;
  const action = { label: "Redefinir minha senha", url };
  return {
    subject: "Redefinição de senha — Nexora",
    html: EmailLayout({
      preheader: "Redefina sua senha da Nexora com segurança.",
      title: "Solicitação de redefinição de senha",
      content: `<p style="margin:0 0 14px;">Recebemos uma solicitação para alterar a senha da sua conta Nexora.</p>${SecurityNotice("Se você não solicitou essa alteração, ignore este e-mail. Sua senha atual não será alterada até que uma nova senha seja definida.")}`,
      action,
    }),
    text: plainLayout(
      "Redefinição de senha — Nexora",
      [
        "Recebemos uma solicitação para alterar a senha da sua conta Nexora.",
        "Se você não solicitou essa alteração, ignore este e-mail.",
        "Sua senha atual não será alterada até que uma nova senha seja definida.",
      ],
      action,
    ),
  };
}

export function emailChangeTemplate(input: { token: string }): EmailTemplate | null {
  const url = actionUrl("/verify-email", input.token);
  if (!url) return null;
  const action = { label: "Confirmar novo e-mail", url };
  return {
    subject: "Confirme seu novo e-mail — Nexora",
    html: EmailLayout({
      preheader: "Confirme a alteração de e-mail da sua conta Nexora.",
      title: "Confirme seu novo e-mail",
      content: `<p style="margin:0 0 14px;">Você solicitou uma alteração de e-mail para sua conta Nexora.</p><p style="margin:0;">O novo endereço só será salvo depois desta confirmação.</p>${SecurityNotice("Se você não solicitou essa alteração, ignore este e-mail e proteja sua conta.")}`,
      action,
    }),
    text: plainLayout(
      "Confirme seu novo e-mail — Nexora",
      [
        "Você solicitou uma alteração de e-mail para sua conta Nexora.",
        "O novo endereço só será salvo depois desta confirmação.",
        "Se você não solicitou essa alteração, ignore este e-mail.",
      ],
      action,
    ),
  };
}

export function loginAlertTemplate(input: {
  username: string;
  browser: string;
  os: string;
  dateLabel: string;
}): EmailTemplate | null {
  const url = actionUrl("/channels/@me");
  if (!url) return null;
  const action = { label: "Proteger minha conta", url };
  return {
    subject: "Novo login detectado — Nexora",
    html: EmailLayout({
      preheader: "Uma nova entrada na sua conta Nexora foi detectada.",
      title: "Novo login detectado",
      content: `<p style="margin:0 0 14px;">Uma nova entrada na sua conta Nexora foi detectada.</p><p style="margin:0 0 8px;"><strong>Conta:</strong> @${escapeHtml(input.username)}</p><p style="margin:0 0 8px;"><strong>Dispositivo:</strong> ${escapeHtml(input.browser)} · ${escapeHtml(input.os)}</p><p style="margin:0 0 18px;"><strong>Data:</strong> ${escapeHtml(input.dateLabel)}</p>${SecurityNotice("Se foi você, tudo certo. Se não foi você, encerre as outras sessões e altere sua senha.")}`,
      action,
    }),
    text: plainLayout(
      "Novo login detectado — Nexora",
      [
        `Conta: @${input.username}`,
        `Dispositivo: ${input.browser} · ${input.os}`,
        `Data: ${input.dateLabel}`,
        "Se foi você, tudo certo. Se não foi você, encerre as outras sessões e altere sua senha.",
      ],
      action,
    ),
  };
}

export function emailChangedAlertTemplate(input: { email: string }): EmailTemplate | null {
  const url = actionUrl("/channels/@me");
  if (!url) return null;
  const action = { label: "Abrir Nexora", url };
  return {
    subject: "Seu e-mail do Nexora foi alterado — Nexora",
    html: EmailLayout({
      preheader: "O endereço de e-mail da sua conta Nexora foi alterado.",
      title: "Seu e-mail foi alterado",
      content: `<p style="margin:0 0 14px;">O endereço <strong>${escapeHtml(input.email)}</strong> deixou de estar associado à sua conta Nexora.</p><p style="margin:0;">Se não foi você, proteja imediatamente sua conta.</p>`,
      action,
    }),
    text: plainLayout(
      "Seu e-mail do Nexora foi alterado",
      [`O endereço ${input.email} deixou de estar associado à sua conta Nexora.`, "Se não foi você, proteja imediatamente sua conta."],
      action,
    ),
  };
}

export function passwordChangedTemplate(): EmailTemplate | null {
  const url = actionUrl("/channels/@me");
  if (!url) return null;
  const action = { label: "Abrir minhas configurações", url };
  return {
    subject: "Sua senha foi alterada — Nexora",
    html: EmailLayout({
      preheader: "A senha da sua conta Nexora foi alterada.",
      title: "Sua senha foi alterada",
      content: `<p style="margin:0 0 14px;">A senha da sua conta Nexora foi alterada com sucesso.</p><p style="margin:0;">Se não foi você, encerre as sessões ativas e proteja sua conta imediatamente.</p>${SecurityNotice("A Nexora nunca pede sua senha por e-mail.")}`,
      action,
    }),
    text: plainLayout(
      "Sua senha foi alterada — Nexora",
      [
        "A senha da sua conta Nexora foi alterada com sucesso.",
        "Se não foi você, encerre as sessões ativas e proteja sua conta imediatamente.",
      ],
      action,
    ),
  };
}

export function emailChangePendingTemplate(input: { email: string }): EmailTemplate | null {
  const url = actionUrl("/channels/@me");
  if (!url) return null;
  const action = { label: "Revisar minha conta", url };
  return {
    subject: "Alteração de e-mail pendente — Nexora",
    html: EmailLayout({
      preheader: "Uma alteração de e-mail foi solicitada na sua conta Nexora.",
      title: "Alteração de e-mail pendente",
      content: `<p style="margin:0 0 14px;">Foi solicitada uma alteração do e-mail da sua conta para <strong>${escapeHtml(input.email)}</strong>.</p><p style="margin:0;">A alteração só será concluída depois que o novo endereço for confirmado.</p>${SecurityNotice("Se você não solicitou essa alteração, ignore este e-mail e revise suas sessões.")}`,
      action,
    }),
    text: plainLayout(
      "Alteração de e-mail pendente — Nexora",
      [
        `Foi solicitada uma alteração do e-mail da sua conta para ${input.email}.`,
        "A alteração só será concluída depois que o novo endereço for confirmado.",
        "Se você não solicitou essa alteração, ignore este e-mail.",
      ],
      action,
    ),
  };
}

export function twoFactorEnabledTemplate(): EmailTemplate | null {
  const url = actionUrl("/channels/@me");
  if (!url) return null;
  const action = { label: "Revisar minha segurança", url };
  return {
    subject: "2FA ativado na sua conta — Nexora",
    html: EmailLayout({
      preheader: "A autenticação em duas etapas foi ativada.",
      title: "Autenticação em duas etapas ativada",
      content: `<p style="margin:0 0 14px;">A autenticação em duas etapas foi ativada na sua conta Nexora.</p><p style="margin:0;">Novos logins agora pedem um código do seu aplicativo autenticador ou um código de recuperação.</p>${SecurityNotice("Se não foi você, encerre as sessões e redefina sua senha imediatamente.")}`,
      action,
    }),
    text: plainLayout(
      "2FA ativado na sua conta — Nexora",
      [
        "A autenticação em duas etapas foi ativada na sua conta Nexora.",
        "Se não foi você, encerre as sessões e redefina sua senha imediatamente.",
      ],
      action,
    ),
  };
}

export function twoFactorDisabledTemplate(): EmailTemplate | null {
  const url = actionUrl("/channels/@me");
  if (!url) return null;
  const action = { label: "Revisar minha segurança", url };
  return {
    subject: "2FA desativado na sua conta — Nexora",
    html: EmailLayout({
      preheader: "A autenticação em duas etapas foi desativada.",
      title: "Autenticação em duas etapas desativada",
      content: `<p style="margin:0 0 14px;">A autenticação em duas etapas foi desativada na sua conta Nexora.</p><p style="margin:0;">Sua senha continua sendo exigida, mas a conta está menos protegida contra acessos não autorizados.</p>${SecurityNotice("Se não foi você, redefina sua senha e ative a 2FA novamente.")}`,
      action,
    }),
    text: plainLayout(
      "2FA desativado na sua conta — Nexora",
      [
        "A autenticação em duas etapas foi desativada na sua conta Nexora.",
        "Se não foi você, redefina sua senha e ative a 2FA novamente.",
      ],
      action,
    ),
  };
}

export function isEmailConfigured(): boolean {
  return Boolean(env.resendApiKey && env.resendFromEmail && appBaseUrl());
}

let resendClient: Resend | null = null;
let resendClientKey = "";

function resendFromAddress(): string {
  return `${BRAND_NAME} <${env.resendFromEmail}>`;
}

export async function sendTransactionalEmail(input: {
  to: string;
  template: EmailTemplate | null;
}): Promise<boolean> {
  if (!input.template || !env.resendApiKey || !env.resendFromEmail) return false;
  try {
    if (!resendClient || resendClientKey !== env.resendApiKey) {
      resendClient = new Resend(env.resendApiKey);
      resendClientKey = env.resendApiKey;
    }
    const result = await resendClient.emails.send({
      from: resendFromAddress(),
      to: input.to,
      subject: input.template.subject,
      html: input.template.html,
      text: input.template.text,
    });
    if (result.error) {
      console.error("[email] Resend rejected a transactional email", result.error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error(
      "[email] transactional delivery failed",
      error instanceof Error ? error.message : "unknown error",
    );
    return false;
  }
}
