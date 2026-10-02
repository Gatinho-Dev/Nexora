/**
 * "Ouvir junto" tem duas perguntas que são de dados, não de interface: o
 * convidado está no mesmo ponto que o anfitrião? O anfitrião precisa publicar de
 * novo? Ambas vivem em `core/listen.ts` e são fixadas aqui — inclusive os
 * números que ninguém consegue conferir a olho (a banda de tolerância e o
 * batimento de cinco segundos).
 */

import { describe, expect, it } from "vitest";

import { CiderListen } from "@contracts/constants";
import type { CiderListenState } from "@contracts/types";
import {
  followPlan,
  inviteMessage,
  trackFromListen,
  listenStateFrom,
  listenStateSignature,
  listenTrackFrom,
  makeReaction,
  pruneReactions,
  publishPlan,
  readListenCode,
  type FollowSnapshot,
} from "./core/listen";
import type { CiderTrack } from "./api/query";

/** Faixa mínima válida: só o id importa aqui. */
function track(id: string): CiderTrack {
  return {
    videoId: id,
    title: id.toUpperCase(),
    artist: `Artista ${id}`,
    channelName: "Canal",
    youtubeTitle: id,
    albumHint: null,
    artworkUrl: `https://exemplo.com/${id}.jpg`,
    durationMs: 200_000,
    url: `https://youtu.be/${id}`,
    version: "studio",
    score: 0,
    isAlternative: false,
    isExplicit: false,
  };
}

function state(overrides: Partial<CiderListenState> = {}): CiderListenState {
  const item = { videoId: "aaaaaaaaaa", title: "A", artist: null, channelName: null, artworkUrl: null, durationMs: 0, url: null };
  return {
    track: item,
    playing: true,
    positionMs: 10_000,
    index: 0,
    queue: [item],
    ...overrides,
  };
}

function snapshot(overrides: Partial<FollowSnapshot> = {}): FollowSnapshot {
  return {
    videoId: "aaaaaaaaaa",
    index: 0,
    queueIds: ["aaaaaaaaaa"],
    positionMs: 10_000,
    playing: true,
    ...overrides,
  };
}

describe("followPlan", () => {
  it("carrega a fila quando a faixa do anfitrião é outra", () => {
    const plan = followPlan(
      snapshot({ videoId: "bbbbbbbbbb", queueIds: ["bbbbbbbbbb"] }),
      state(),
      1_000,
      1_000
    );
    expect(plan.load).toBe(true);
    expect(plan.seek).toBe(true);
    expect(plan.playing).toBe(true);
  });

  it("carrega quando a fila à frente é outra, mesmo na mesma faixa", () => {
    const plan = followPlan(
      snapshot({ queueIds: ["aaaaaaaaaa", "cccccccccc"] }),
      state(),
      1_000,
      1_000
    );
    expect(plan.load).toBe(true);
  });

  it("não corrige a posição dentro da banda de tolerância", () => {
    const plan = followPlan(snapshot({ positionMs: 11_500 }), state(), 1_000, 2_000);
    // Alvo: 10_000 + 1_000 de viagem = 11_000; o convidado está em 11_500.
    expect(plan.seek).toBe(false);
    expect(plan.aligned).toBe(true);
  });

  it("corrige a posição quando a diferença passa da banda", () => {
    const plan = followPlan(
      snapshot({ positionMs: 1_000 }),
      state({ positionMs: 30_000 }),
      1_000,
      1_000
    );
    expect(plan.load).toBe(false);
    expect(plan.seek).toBe(true);
    expect(plan.positionMs).toBe(30_000);
    expect(plan.aligned).toBe(false);
  });

  it("compensa o tempo de viagem só enquanto o anfitrião toca", () => {
    const playing = followPlan(snapshot({ positionMs: 0 }), state({ positionMs: 5_000 }), 1_000, 9_000);
    expect(playing.positionMs).toBe(13_000);
    const paused = followPlan(
      snapshot({ playing: false, positionMs: 5_000 }),
      state({ playing: false, positionMs: 5_000 }),
      1_000,
      9_000
    );
    expect(paused.positionMs).toBe(5_000);
    expect(paused.aligned).toBe(true);
  });

  it("pausa o convidado quando o anfitrião pausa, sem buscar posição", () => {
    const plan = followPlan(
      snapshot({ playing: true, positionMs: 10_000 }),
      state({ playing: false }),
      1_000,
      1_000
    );
    expect(plan.playing).toBe(false);
    expect(plan.aligned).toBe(false);
    expect(plan.seek).toBe(false);
  });

  it("sem faixa no anfitrião, o convidado também para", () => {
    const plan = followPlan(
      snapshot(),
      state({ track: null, playing: false, positionMs: 0, index: -1, queue: [] }),
      1_000,
      1_000
    );
    expect(plan).toMatchObject({ load: true, playing: false, positionMs: 0, aligned: false });
  });
});

describe("listenStateFrom", () => {
  it("a janela começa na faixa atual e o índice é dela", () => {
    const snapshotValue = {
      track: track("cccccccccc"),
      queue: [track("aaaaaaaaaa"), track("bbbbbbbbbb"), track("cccccccccc"), track("dddddddddd")],
      index: 2,
      positionMs: 1_234.6,
      playing: true,
    };
    const published = listenStateFrom(snapshotValue);
    expect(published.index).toBe(0);
    expect(published.queue.map((item) => item.videoId)).toEqual(["cccccccccc", "dddddddddd"]);
    expect(published.positionMs).toBe(1_235);
  });

  it("respeita o teto da janela", () => {
    const queue = Array.from({ length: 80 }, (_item, at) => track(`vid${String(at).padStart(7, "0")}`));
    const published = listenStateFrom({ track: queue[0], queue, index: 0, positionMs: 0, playing: false });
    expect(published.queue).toHaveLength(CiderListen.MAX_QUEUE);
  });

  it("sem faixa, o estado é vazio — não uma fila órfã", () => {
    const published = listenStateFrom({
      track: null,
      queue: [track("aaaaaaaaaa")],
      index: -1,
      positionMs: 5_000,
      playing: false,
    });
    expect(published).toEqual({ track: null, playing: false, positionMs: 0, index: -1, queue: [] });
  });

  it("publica só o recorte que o convidado usa para reproduzir", () => {
    const published = listenTrackFrom(track("aaaaaaaaaa"));
    expect(published).toEqual({
      videoId: "aaaaaaaaaa",
      title: "AAAAAAAAAA",
      artist: "Artista aaaaaaaaaa",
      channelName: "Canal",
      artworkUrl: "https://exemplo.com/aaaaaaaaaa.jpg",
      durationMs: 200_000,
      url: "https://youtu.be/aaaaaaaaaa",
    });
  });
});

describe("trackFromListen", () => {
  it("volta ao motor o que a sessão compartilhou, sem inventar canal nem versão", () => {
    const track = trackFromListen({
      videoId: "dQw4w9WgXcQ",
      title: "Never Gonna Give You Up",
      artist: "Rick Astley",
      artworkUrl: "https://exemplo.com/capa.jpg",
      durationMs: 213_000,
    });
    expect(track).toMatchObject({
      videoId: "dQw4w9WgXcQ",
      title: "Never Gonna Give You Up",
      artist: "Rick Astley",
      channelName: "",
      artworkUrl: "https://exemplo.com/capa.jpg",
      durationMs: 213_000,
      version: "studio",
      isAlternative: false,
    });
    // Sem link compartilhado, o endereço sai do id — é o que o "Abrir no
    // YouTube" precisa para funcionar.
    expect(track.url).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });

  it("mantém o link quando ele veio na sessão", () => {
    const track = trackFromListen({
      videoId: "dQw4w9WgXcQ",
      title: "X",
      url: "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
    });
    expect(track.url).toBe("https://music.youtube.com/watch?v=dQw4w9WgXcQ");
  });
});

describe("listenStateSignature", () => {
  it("ignora o progresso fino e muda a cada cinco segundos", () => {
    const base = listenStateSignature(state({ positionMs: 1_000 }));
    expect(listenStateSignature(state({ positionMs: 4_999 }))).toBe(base);
    expect(listenStateSignature(state({ positionMs: 5_100 }))).not.toBe(base);
  });

  it("muda quando muda o que os convidados precisam saber", () => {
    const base = listenStateSignature(state());
    expect(listenStateSignature(state({ playing: false }))).not.toBe(base);
    expect(
      listenStateSignature(state({ queue: [{ ...state().queue[0]!, videoId: "bbbbbbbbbb" }] }))
    ).not.toBe(base);
    expect(listenStateSignature(state({ index: 1, queue: [state().queue[0]!] }))).not.toBe(base);
  });
});

describe("publishPlan", () => {
  it("assinatura igual não publica de novo", () => {
    expect(publishPlan("x", "x", 0, 10_000)).toBe("none");
  });

  it("publica na hora quando o intervalo já passou", () => {
    expect(publishPlan("x", "y", 9_000, 10_000)).toBe("now");
  });

  it("antes do intervalo, agenda em vez de descartar", () => {
    expect(publishPlan("x", "y", 9_900, 10_000)).toBe("soon");
  });
});

describe("reações", () => {
  it("nasce com id próprio e deslocamento dentro da faixa", () => {
    const reaction = makeReaction({ emoji: "❤️", name: "Ana", at: 1_000, drift: 12 });
    expect(reaction.emoji).toBe("❤️");
    expect(reaction.name).toBe("Ana");
    expect(reaction.drift).toBe(12);
    expect(makeReaction({ emoji: "🔥", name: "Bia", at: 1_000 }).id).toBeGreaterThan(reaction.id);
  });

  it("descarta o que já viveu o bastante e mantém a ordem", () => {
    const list = [
      makeReaction({ emoji: "❤️", name: "Ana", at: 0 }),
      makeReaction({ emoji: "🔥", name: "Bia", at: 2_000 }),
    ];
    const alive = pruneReactions(list, 3_000, 2_600);
    expect(alive.map((item) => item.emoji)).toEqual(["🔥"]);
  });

  it("põe teto na tela, deixando as mais novas", () => {
    const list = Array.from({ length: CiderListen.MAX_FLOATING_REACTIONS + 5 }, (_item, at) =>
      makeReaction({ emoji: "🎉", name: "N", at })
    );
    const alive = pruneReactions(list, 100, 10_000);
    expect(alive).toHaveLength(CiderListen.MAX_FLOATING_REACTIONS);
    expect(alive[alive.length - 1]!.at).toBe(list.length - 1);
  });
});

describe("código do convite", () => {
  it("lê o que a pessoa digitou com espaço, hífen e minúsculas", () => {
    expect(readListenCode(" ab-cd ef ")).toBe("ABCDEF");
  });

  it("recusa o que não tem cara de código", () => {
    expect(readListenCode("ABC")).toBeNull();
    expect(readListenCode("ABCDE0")).toBeNull();
  });

  it("o texto de compartilhar diz quem chamou e o código", () => {
    const message = inviteMessage("ABCDEF", "Ana");
    expect(message).toContain("Ana");
    expect(message).toContain("ABCDEF");
  });
});
