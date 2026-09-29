import { describe, expect, it } from "vitest";
import {
  detectVersion,
  looksLikeMusic,
  plausibleDuration,
  scoreCandidate,
  stripNoise,
  titleSimilarity,
} from "../core/metadata";
import { eventData, playbackErrorMessage } from "../core/player";
import {
  buildSearchPlan,
  capPerChannel,
  dedupeTracks,
  displayTitle,
  parseIntent,
  rerankTracks,
  toTrack,
  type CiderTrack,
} from "../api/query";
import { __testing, describeSearchFailure } from "../api/search";

describe("núcleo do Cider · metadados", () => {
  it("tira ruído de publicação do título sem alterar o original", () => {
    // O título do YouTube é evidência; o limpo é apresentação.
    const original = "The Weeknd - Blinding Lights (Official Video)";
    expect(stripNoise(original)).not.toBe(original);
    expect(stripNoise(original)).toContain("Blinding Lights");
  });

  it("detecta versão da gravação", () => {
    expect(detectVersion("Song (Official Video)")).toBe("studio");
    expect(detectVersion("Song (Live at Wembley)")).toBe("live");
    expect(detectVersion("Song (Acoustic)")).toBe("acoustic");
    expect(detectVersion("Song (Karaoke Version)")).toBe("karaoke");
    expect(detectVersion("Song (Sped Up)")).toBe("sped-up");
  });

  it("rejeita conteúdo que não é música", () => {
    expect(
      plausibleDuration(10 * 60 * 60 * 1000)
    ).toBe(false); // vídeo de 10 h
    expect(plausibleDuration(200_000)).toBe(true);
    expect(
      looksLikeMusic({ title: "How to cook pasta", channel: "Cooking", durationMs: 300_000 })
    ).toBe(false);
  });

  it("dá nota maior à faixa oficial que a um cover", () => {
    const official = scoreCandidate("the weeknd blinding lights", {
      title: "The Weeknd - Blinding Lights (Official Video)",
      channel: "The Weeknd",
      durationMs: 200_000,
    });
    const cover = scoreCandidate("the weeknd blinding lights", {
      title: "The Weeknd - Blinding Lights (Cover by Some Guy)",
      channel: "Some Guy",
      durationMs: 200_000,
    });
    expect(official).toBeGreaterThan(cover);
  });

  it("título parecido pontua acima de título sem relação", () => {
    expect(
      titleSimilarity("Blinding Lights", "Blinding Lights (Official)")
    ).toBeGreaterThan(titleSimilarity("Blinding Lights", "Total Eclipse of the Heart"));
  });
});

describe("núcleo do Cider · player", () => {
  it("lê o código do objeto de evento, que é como o YouTube envia", () => {
    // Aplicar `Number()` no evento daria NaN: o estado cairia sempre no
    // `default` e o erro sairia como "código NaN".
    expect(eventData({ data: 1, target: {} })).toBe(1);
    expect(eventData({ data: 150 })).toBe(150);
  });

  it("aceita o número cru, sem depender de um único formato", () => {
    expect(eventData(3)).toBe(3);
  });

  it("devolve NaN para payload irreconhecível", () => {
    expect(eventData(null)).toBeNaN();
    expect(eventData({})).toBeNaN();
  });

  it("nunca imprime 'código NaN'", () => {
    expect(playbackErrorMessage(Number.NaN)).not.toContain("NaN");
  });

  it("traduz os códigos que o player realmente emite", () => {
    expect(playbackErrorMessage(2)).toContain("parâmetro do vídeo");
    expect(playbackErrorMessage(100)).toContain("não está disponível");
    expect(playbackErrorMessage(150)).toContain("reprodução incorporada");
  });
});

describe("núcleo do Cider · intenção de busca", () => {
  it("entende prefixos de artista, álbum e faixa", () => {
    expect(parseIntent("artist: Dua Lipa").kind).toBe("artist");
    expect(parseIntent("@dua lipa").kind).toBe("artist");
    expect(parseIntent("álbum: Cowboy Carter").kind).toBe("album");
    expect(parseIntent("música: levitating").kind).toBe("song");
  });

  it("refina artista para 'topic', que acha o canal oficial", () => {
    expect(parseIntent("artist: Dua Lipa").refined).toContain("topic");
  });

  it("inverte 'Artista - Música' para achar o canal que publica ao contrário", () => {
    const plan = buildSearchPlan(parseIntent("The Weeknd - Blinding Lights"));
    expect(plan.length).toBeGreaterThan(1);
    expect(plan.some(query => query.startsWith("Blinding Lights"))).toBe(true);
  });

  it("não repete consultas iguais", () => {
    const plan = buildSearchPlan(parseIntent("dua lipa"));
    expect(new Set(plan).size).toBe(plan.length);
  });
});

describe("núcleo do Cider · reordenação", () => {
  const make = (over: Partial<CiderTrack>): CiderTrack => ({
    videoId: "aaaaaaaaaaa",
    title: "Faixa",
    artist: "Artista",
    channelName: "Canal",
    youtubeTitle: "Artista - Faixa (Official Video)",
    albumHint: null,
    artworkUrl: "",
    durationMs: 200_000,
    url: "",
    version: "studio",
    score: 0,
    isAlternative: false,
    isExplicit: false,
    ...over,
  });

  it("separa artista e música de 'Artista - Música'", () => {
    const { artist, title } = displayTitle("The Weeknd - Blinding Lights (Official Video)");
    expect(artist).toBe("The Weeknd");
    expect(title).toBe("Blinding Lights");
  });

  it("deduplica por videoId, mantendo a de maior pontuação", () => {
    const items = [
      make({ videoId: "same", score: 10 }),
      make({ videoId: "same", score: 90 }),
    ];
    expect(dedupeTracks(items)).toHaveLength(1);
    expect(dedupeTracks(items)[0].score).toBe(90);
  });

  it("coloca a faixa oficial antes do cover", () => {
    const ranked = rerankTracks(
      [
        make({ videoId: "cover1", youtubeTitle: "Song (Cover)", channelName: "Tuner", version: "cover" }),
        make({ videoId: "off1", youtubeTitle: "Song (Official Video)", channelName: "Label" }),
      ],
      { query: "song", preferences: { preferOfficialAudio: true, hideAlternativeVersions: false, maxPerChannel: 4, limit: 10 } }
    );
    expect(ranked[0].videoId).toBe("off1");
  });

  it("nunca devolve a faixa que está tocando como próxima", () => {
    const ranked = rerankTracks(
      [make({ videoId: "atual" }), make({ videoId: "outra" })],
      {
        query: "song",
        preferences: { preferOfficialAudio: true, hideAlternativeVersions: false, maxPerChannel: 4, limit: 10 },
        excludeVideoId: "atual",
      }
    );
    expect(ranked.some(item => item.videoId === "atual")).toBe(false);
  });

  it("limita quantos itens um canal pode tomar", () => {
    const items = Array.from({ length: 6 }, (_v, i) =>
      make({ videoId: `id${i}`, channelName: "Mesmo Canal" })
    );
    expect(capPerChannel(items, 2)).toHaveLength(2);
  });

  it("marca cover e karaokê como alternativa, e a oficial como não", () => {
    // O campo precisa ser derivado da versão, senão a preferência de esconder
    // alternativas nunca filtra nada.
    const cover = toTrack({ videoId: "c1", title: "Song (Cover)", author: "Tuner", thumbnail: "", durationSeconds: 200 });
    const karaoke = toTrack({ videoId: "k1", title: "Song (Karaoke Version)", author: "Kara", thumbnail: "", durationSeconds: 200 });
    const official = toTrack({ videoId: "o1", title: "Song (Official Video)", author: "Label", thumbnail: "", durationSeconds: 200 });
    expect(cover.isAlternative).toBe(true);
    expect(karaoke.isAlternative).toBe(true);
    expect(official.isAlternative).toBe(false);
  });

  it("esconde alternativas só quando ainda sobra música de verdade", () => {
    const preferences = { preferOfficialAudio: true, hideAlternativeVersions: true, maxPerChannel: 4, limit: 10 };
    const soAlternativas = rerankTracks(
      [
        make({ videoId: "c1", version: "cover", isAlternative: true }),
        make({ videoId: "k1", version: "karaoke", isAlternative: true }),
      ],
      { query: "song", preferences }
    );
    // Sem música real, esconder todas deixaria a lista vazia.
    expect(soAlternativas).toHaveLength(2);

    const comOficial = rerankTracks(
      [
        make({ videoId: "c1", version: "cover", isAlternative: true }),
        make({ videoId: "o1", version: "studio", isAlternative: false }),
      ],
      { query: "song", preferences }
    );
    expect(comOficial.every(item => !item.isAlternative)).toBe(true);
  });

  it("converte item cru em faixa com duração em ms", () => {
    const track = toTrack({
      videoId: "abc12345678",
      title: "Artista - Música (Official Video)",
      author: "Canal Oficial",
      thumbnail: "https://i.ytimg.com/x.jpg",
      durationSeconds: 200,
    });
    expect(track.durationMs).toBe(200_000);
    expect(track.url).toContain("v=abc12345678");
    expect(track.youtubeTitle).toContain("Official Video");
  });
});

describe("núcleo do Cider · normalização da busca", () => {
  it("extrai o id do Piped pela URL quando não vem no campo id", () => {
    expect(
      __testing.pipedVideoId({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30" })
    ).toBe("dQw4w9WgXcQ");
  });

  it("prefere o campo id quando ele existe", () => {
    expect(
      __testing.pipedVideoId({ url: "https://x/watch?v=aaaaaaaaaaa", id: "dQw4w9WgXcQ" } as never)
    ).toBe("dQw4w9WgXcQ");
  });

  it("descarta vídeo sem id ou sem duração", () => {
    const videos = __testing.normalizePiped({
      items: [
        { url: "https://x/watch?v=dQw4w9WgXcQ", title: "ok", duration: 200 },
        { url: "https://x/watch?v=curto", title: "sem duração", duration: 0 },
        { url: "https://x/semv", title: "sem id", duration: 100 },
      ],
    });
    expect(videos).toHaveLength(1);
    expect(videos[0].videoId).toBe("dQw4w9WgXcQ");
  });

  it("converte duração em segundos sem passar por NaN", () => {
    const videos = __testing.normalizePiped({
      items: [{ url: "https://x/watch?v=dQw4w9WgXcQ", duration: "200" }],
    });
    expect(videos[0].duration).toBe(200);
  });

  it("lê o formato do Invidious", () => {
    const videos = __testing.normalizeInvidious([
      {
        videoId: "dQw4w9WgXcQ",
        title: "Faixa",
        author: "Canal",
        lengthSeconds: 212,
        videoThumbnails: [{ url: "small" }, { url: "grande" }],
      },
    ]);
    expect(videos[0].thumbnail).toBe("grande");
  });

  it("erro de busca diz o que aconteceu com cada instância", () => {
    const message = describeSearchFailure([
      { instance: "https://a.example", error: "HTTP 502" },
      { instance: "https://b.example", error: "tempo esgotado" },
    ]);
    expect(message).toContain("a.example");
    expect(message).toContain("b.example");
  });
});
