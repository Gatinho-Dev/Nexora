import { afterEach, describe, expect, it } from "vitest";
import {
  emailChangedAlertTemplate,
  emailVerificationTemplate,
  loginAlertTemplate,
  passwordResetTemplate,
} from "../email";
import { env } from "../../lib/env";

const originalAppOrigin = env.appOrigin;
const originalPublicApiUrl = env.publicApiUrl;

afterEach(() => {
  env.appOrigin = originalAppOrigin;
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

  it("retorna null quando não há origem do app configurada (evita link quebrado)", () => {
    env.appOrigin = "";
    env.publicApiUrl = "";
    const tpl = emailVerificationTemplate({
      email: "user@example.com",
      token: "x".repeat(40),
    });
    expect(tpl).toBeNull();
  });
});
