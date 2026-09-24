import { describe, expect, it } from "vitest";
import { hashEmail, hashEmailToken, normalizeEmail } from "../emailTokens";

describe("normalizeEmail", () => {
  it("normaliza espaços e maiúsculas", () => {
    expect(normalizeEmail("  Usuario@Exemplo.COM ")).toBe(
      "usuario@exemplo.com",
    );
  });

  it("mantém o endereço canônico inalterado", () => {
    expect(normalizeEmail("a.b+tag@domain.dev")).toBe("a.b+tag@domain.dev");
  });
});

describe("hashEmail", () => {
  it("é determinístico e insensível a caixa/espaços", () => {
    expect(hashEmail("User@Example.com")).toBe(
      hashEmail("  user@example.com  "),
    );
  });

  it("produz SHA-256 hex de 64 caracteres", () => {
    const hash = hashEmail("alguem@nexora.chat");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("hashEmailToken", () => {
  it("produz hashes distintos para tokens distintos", () => {
    expect(hashEmailToken("token-a")).not.toBe(hashEmailToken("token-b"));
  });

  it("é determinístico", () => {
    expect(hashEmailToken("stable-value")).toBe(
      hashEmailToken("stable-value"),
    );
  });
});
