import { afterEach, describe, expect, it } from "vitest";
import {
  emailChangePendingTemplate,
  emailChangedAlertTemplate,
  emailVerificationTemplate,
  loginAlertTemplate,
  passwordChangedTemplate,
  passwordResetTemplate,
  twoFactorDisabledTemplate,
  twoFactorEnabledTemplate,
} from "../email";
import { env } from "../../lib/env";

const originalAppOrigin = env.appOrigin;
const originalAppBaseUrl = env.appBaseUrl;
const originalPublicApiUrl = env.publicApiUrl;

afterEach(() => {
  env.appOrigin = originalAppOrigin;
  env.appBaseUrl = originalAppBaseUrl;
  env.publicApiUrl = originalPublicApiUrl;
});

describe("email templates", () => {
  it("verification: monta link /verify-email com o token", () => {
    env.appOrigin = "https://nexorachat.cloud";
    const tpl = emailVerificationTemplate({
      email: "user@example.com",
      token: "tok-123-abc",
    });
    expect(tpl).not.toBeNull();
    expect(tpl!.subject).toContain("Nexora");
    expect(tpl!.html).toContain("/verify-email?token=tok-123-abc");
    expect(tpl!.text).toContain("/verify-email?token=tok-123-abc");
  });

  it("password reset: monta link /reset-password com o token", () => {
    env.appOrigin = "https://nexorachat.cloud";
    const tpl = passwordResetTemplate({ token: "reset-456" });
    expect(tpl).not.toBeNull();
    expect(tpl!.html).toContain("/reset-password?token=reset-456");
  });

  it("login alert: escapa dados do usuário no HTML", () => {
    env.appOrigin = "https://nexorachat.cloud";
    const tpl = loginAlertTemplate({
      username: '<script>alert("x")</script>',
      browser: "Chrome",
      os: "Linux",
      dateLabel: "24/09/2026 10:00",
    });
    expect(tpl).not.toBeNull();
    expect(tpl!.html).not.toContain("<script>");
    expect(tpl!.html).toContain("&lt;script&gt;");
  });

  it("email changed alert: inclui o endereço antigo escapado", () => {
    env.appOrigin = "https://nexorachat.cloud";
    const tpl = emailChangedAlertTemplate({ email: "old@exemplo.com" });
    expect(tpl).not.toBeNull();
    expect(tpl!.html).toContain("old@exemplo.com");
  });

  it("security templates include official actions and warnings", () => {
    env.appOrigin = "https://nexorachat.cloud";
    for (const template of [
      passwordChangedTemplate(),
      twoFactorEnabledTemplate(),
      twoFactorDisabledTemplate(),
      emailChangePendingTemplate({ email: "new@example.com" }),
    ]) {
      expect(template).not.toBeNull();
      expect(template!.html).toContain("Nexora");
      expect(template!.text).toContain("Nexora");
    }
    expect(emailChangePendingTemplate({ email: "new@example.com" })!.html).toContain(
      "new@example.com",
    );
  });

  it("prefere APP_BASE_URL sobre a URL da API para links de e-mail", () => {
    env.appOrigin = "";
    env.publicApiUrl = "https://api.example.com";
    env.appBaseUrl = "https://nexorachat.cloud";
    const tpl = passwordChangedTemplate();
    expect(tpl!.html).toContain("https://nexorachat.cloud/channels/@me");
  });

  it("retorna null quando não há origem do app configurada (evita link quebrado)", () => {
    env.appOrigin = "";
    env.appBaseUrl = "";
    env.publicApiUrl = "";
    const tpl = emailVerificationTemplate({
      email: "user@example.com",
      token: "x".repeat(40),
    });
    expect(tpl).toBeNull();
  });
});
