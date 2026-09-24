import { describe, expect, it } from "vitest";
import { isEmailLike, maskEmail } from "../secondFactor";

describe("isEmailLike", () => {
  it("detecta e-mails plausíveis", () => {
    expect(isEmailLike("user@exemplo.com")).toBe(true);
    expect(isEmailLike("a@b.co")).toBe(true);
  });

  it("rejeita nomes de usuário e valores longos", () => {
    expect(isEmailLike("gatinho_dev")).toBe(false);
    expect(isEmailLike("sem-arroba")).toBe(false);
    expect(isEmailLike(`${"a".repeat(321)}@x.com`)).toBe(false);
  });
});

describe("maskEmail", () => {
  it("mascara o local preservando o domínio", () => {
    expect(maskEmail("usuario@exemplo.com")).toMatch(/^us[•]+@exemplo\.com$/);
  });

  it("aceita valores vazios/nulos", () => {
    expect(maskEmail(null)).toBeNull();
    expect(maskEmail("")).toBeNull();
  });
});
