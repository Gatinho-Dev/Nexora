import { describe, expect, it } from "vitest";
import {
  CiderActivitySchema,
  CIDER_IMAGE_HOSTS,
  ciderProvider,
  normalizeCiderActivity,
} from "./cider";

const valid = {
  title: "Blinding Lights",
  details: "The Weeknd",
  state: "After Hours",
  largeImageUrl: "https://i.ytimg.com/vi/abc/hqdefault.jpg",
  largeImageText: "After Hours",
  smallImageUrl: "https://i.ytimg.com/vi/abc/default.jpg",
  smallImageText: "YouTube",
  startedAt: Date.now() - 30_000,
  endsAt: Date.now() + 180_000,
  externalUrl: "https://www.youtube.com/watch?v=abc",
};

describe("Cider · schema de atividade", () => {
  it("aceita uma atividade bem formada", () => {
    expect(CiderActivitySchema.safeParse(valid).success).toBe(true);
  });

  it("rejeita título vazio ou gigante", () => {
    expect(CiderActivitySchema.safeParse({ ...valid, title: "" }).success).toBe(false);
    expect(
      CiderActivitySchema.safeParse({ ...valid, title: "x".repeat(201) }).success
    ).toBe(false);
  });

  it("rejeita details e state acima do limite da coluna", () => {
    // varchar(240) no banco: aceitar mais aqui causaria erro na escrita.
    expect(
      CiderActivitySchema.safeParse({ ...valid, details: "d".repeat(241) }).success
    ).toBe(false);
    expect(
      CiderActivitySchema.safeParse({ ...valid, state: "s".repeat(241) }).success
    ).toBe(false);
  });

  it("rejeita timestamp fracionário ou negativo", () => {
    expect(
      CiderActivitySchema.safeParse({ ...valid, startedAt: 1.5 }).success
    ).toBe(false);
    expect(
      CiderActivitySchema.safeParse({ ...valid, startedAt: -1 }).success
    ).toBe(false);
  });

  it("rejeita url que não é url", () => {
    expect(
      CiderActivitySchema.safeParse({ ...valid, largeImageUrl: "javascript:alert(1)" })
        .success
    ).toBe(false);
  });

  it("aceita title null, que significa parar de ouvir", () => {
    expect(CiderActivitySchema.safeParse({ title: null }).success).toBe(true);
  });
});

describe("Cider · normalização", () => {
  it("title null limpa a atividade em vez de gravar", () => {
    const result = normalizeCiderActivity({ title: null });
    expect(result.clear).toBe(true);
    expect(result.activity).toBeNull();
  });

  it("monta a atividade de música com a janela de tempo", () => {
    const { clear, activity } = normalizeCiderActivity(valid);
    expect(clear).toBe(false);
    expect(activity?.provider).toBe("cider");
    expect(activity?.type).toBe("music");
    expect(activity?.title).toBe("Blinding Lights");
    expect(activity?.details).toBe("The Weeknd");
    expect(activity?.endsAt).toBeInstanceOf(Date);
  });

  it("descarta capa de host que não é do YouTube", () => {
    // Sem isso, o card de presença vira um rastreador apontando para qualquer
    // URL que o cliente mandar.
    const { activity } = normalizeCiderActivity({
      ...valid,
      largeImageUrl: "https://exemplo-qualquer.com/rastreando.png",
    });
    expect(activity?.largeImageUrl).toBeNull();
  });

  it("descarta capa em http:// mesmo sendo host conhecido", () => {
    const { activity } = normalizeCiderActivity({
      ...valid,
      largeImageUrl: "http://i.ytimg.com/vi/abc/hqdefault.jpg",
    });
    expect(activity?.largeImageUrl).toBeNull();
  });

  it("mantém capa https de host do YouTube", () => {
    const { activity } = normalizeCiderActivity(valid);
    expect(activity?.largeImageUrl).toContain("i.ytimg.com");
  });

  it("os hosts aceitos são só os de imagem do YouTube", () => {
    expect([...CIDER_IMAGE_HOSTS]).toContain("i.ytimg.com");
    expect([...CIDER_IMAGE_HOSTS]).not.toContain("youtube.com");
  });

  it("ignora janela invertida e usa o instante atual", () => {
    const now = Date.now();
    const { activity } = normalizeCiderActivity({
      ...valid,
      startedAt: now - 5_000,
      endsAt: now - 10_000, // termina antes de começar
    });
    // Sem janela válida não há barra de progresso, mas a atividade ainda vale.
    expect(activity?.startedAt).toBeInstanceOf(Date);
    expect(activity?.endsAt).toBeNull();
  });

  it("ignora janela que duraria mais de um dia", () => {
    const now = Date.now();
    const { activity } = normalizeCiderActivity({
      ...valid,
      startedAt: now - 2 * 86_400_000,
      endsAt: now + 86_400_000,
    });
    expect(activity?.endsAt).toBeNull();
  });

  it("aceita epoch em segundos, não só em milissegundos", () => {
    const now = Date.now();
    const { activity } = normalizeCiderActivity({
      ...valid,
      startedAt: Math.floor((now - 10_000) / 1000),
      endsAt: Math.floor((now + 100_000) / 1000),
    });
    // Converteu de segundos: a janela sobrevive e a barra funciona.
    expect(activity?.endsAt).toBeInstanceOf(Date);
    const ms = activity!.endsAt!.getTime();
    expect(ms).toBeGreaterThan(now);
  });

  it("rejeita timestamp no futuro distante", () => {
    const now = Date.now();
    const { activity } = normalizeCiderActivity({
      ...valid,
      startedAt: now + 7 * 86_400_000,
    });
    // Cai no fallback: começa agora, sem barra.
    expect(activity?.endsAt).toBeNull();
  });
});

describe("Cider · provider sem OAuth", () => {
  it("não se anuncia como conexão de conta", () => {
    expect(ciderProvider.capabilities.accountConnection).toBe(false);
    expect(ciderProvider.capabilities.livePresence).toBe(true);
  });

  it("não tem fetchPresence, e por isso não entra no polling", () => {
    // Se tivesse, o presenceWorker tentaria consultar o Cider a cada ciclo.
    expect(ciderProvider.fetchPresence).toBeUndefined();
  });

  it("recusa o fluxo OAuth com mensagem que aponta para /cider", () => {
    expect(() => ciderProvider.buildAuthorizeUrl({
      state: "s",
      codeChallenge: "c",
      nonce: "n",
    })).toThrowError(/\/cider/);
  });

  it("recusa troca de código e busca de perfil", async () => {
    await expect(ciderProvider.exchangeCode({ code: "c", codeVerifier: "v" })).rejects.toThrow();
    await expect(ciderProvider.fetchProfile("token")).rejects.toThrow();
  });
});

describe("Cider · janela de progresso", () => {
  const now = () => Date.now();

  it("rejeita startedAt no futuro, mesmo com tolerância de relógio", () => {
    // `now - startedAt` negativo passaria num `< 86_400_000` ingênuo; a janela
    // precisa cair para "agora" e não produzir barra negativa.
    const { activity } = normalizeCiderActivity({
      title: "X",
      startedAt: now() + 3_600_000,
      endsAt: now() + 5_400_000,
    });
    expect(activity?.endsAt).toBeNull();
  });

  it("aceita startedAt levemente no futuro, por desvio de relógio", () => {
    const { activity } = normalizeCiderActivity({
      title: "X",
      startedAt: now() + 30_000,
      endsAt: now() + 240_000,
    });
    expect(activity?.endsAt).toBeInstanceOf(Date);
  });

  it("rejeita faixa de mais de 30 horas", () => {
    const { activity } = normalizeCiderActivity({
      title: "X",
      startedAt: now() - 1000,
      endsAt: now() + 40 * 60 * 60 * 1000,
    });
    expect(activity?.endsAt).toBeNull();
  });

  it("sem endsAt a atividade continua valendo, só sem barra", () => {
    const { clear, activity } = normalizeCiderActivity({
      title: "X",
      startedAt: now() - 5_000,
      endsAt: null,
    });
    expect(clear).toBe(false);
    expect(activity?.title).toBe("X");
    expect(activity?.endsAt).toBeNull();
  });

  it("endsAt muito além de startedAt é barrado mesmo com início válido", () => {
    const { activity } = normalizeCiderActivity({
      title: "X",
      startedAt: now() - 1_000,
      endsAt: now() + 31 * 60 * 60 * 1000,
    });
    expect(activity?.endsAt).toBeNull();
  });
});

describe("Cider · URLs no schema", () => {
  it("recusa javascript: mesmo passando por z.string().url()", () => {
    // Verificado: o validador de URL do zod aceita esquema javascript:.
    expect(
      CiderActivitySchema.safeParse({ title: "X", largeImageUrl: "javascript:alert(1)" })
        .success
    ).toBe(false);
    expect(
      CiderActivitySchema.safeParse({ title: "X", externalUrl: "javascript:alert(1)" })
        .success
    ).toBe(false);
  });

  it("recusa http:// mesmo em host do YouTube", () => {
    expect(
      CiderActivitySchema.safeParse({
        title: "X",
        largeImageUrl: "http://i.ytimg.com/vi/a/hq.jpg",
      }).success
    ).toBe(false);
  });

  it("aceita https normal", () => {
    expect(
      CiderActivitySchema.safeParse({
        title: "X",
        largeImageUrl: "https://i.ytimg.com/vi/a/hq.jpg",
      }).success
    ).toBe(true);
  });
});
