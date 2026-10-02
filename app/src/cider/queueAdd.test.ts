/**
 * A gaveta "Adicionar músicas à fila" tem duas decisões que são dados, não
 * interface: o que sugerir antes de digitar e o que já está na fila. Ambas são
 * puras (`core/queueAdd.ts`), e é isso que estes testes fixam — a ordem das
 * sugestões e a garantia de que nada repetido chega à fila.
 */

import { describe, expect, it } from "vitest";

import { newIn, queueIds, queueSuggestions, SUGGESTION_LIMIT } from "./core/queueAdd";
import type { CiderTrack } from "./api/query";

/** Faixa mínima válida: só o id importa aqui. */
function track(id: string): CiderTrack {
  return {
    videoId: id,
    title: id.toUpperCase(),
    artist: "",
    channelName: "",
    youtubeTitle: id,
    albumHint: null,
    artworkUrl: "",
    durationMs: 0,
    url: `https://youtu.be/${id}`,
    version: "studio",
    score: 0,
    isAlternative: false,
    isExplicit: false,
  };
}

describe("queueIds", () => {
  it("resume os ids da fila e ignora entradas sem id", () => {
    const ids = queueIds([track("a"), track(""), track("b")]);
    expect([...ids].sort()).toEqual(["a", "b"]);
  });
});

describe("newIn", () => {
  it("deixa passar só o que a fila ainda não tem, na ordem recebida", () => {
    const fresh = newIn([track("a"), track("b"), track("a")], queueIds([track("b")]));
    expect(fresh.map((item) => item.videoId)).toEqual(["a"]);
  });

  it("não repete dentro da própria lista de entrada", () => {
    const fresh = newIn([track("x"), track("x"), track("y")], new Set());
    expect(fresh.map((item) => item.videoId)).toEqual(["x", "y"]);
  });

  it("descarta faixa sem id: sem id não há o que tocar depois", () => {
    expect(newIn([track("")], new Set())).toEqual([]);
  });
});

describe("queueSuggestions", () => {
  const sources = {
    history: [
      { track: track("ouvida-ontem") },
      { track: track("ouvida-antes") },
      { track: track("na-fila") },
    ],
    favorites: [track("favorita"), track("ouvida-antes"), track("na-fila")],
    queue: [track("na-fila")],
  };

  it("põe o histórico na frente dos favoritos", () => {
    const out = queueSuggestions(sources);
    expect(out.map((item) => item.videoId)).toEqual([
      "ouvida-ontem",
      "ouvida-antes",
      "favorita",
    ]);
  });

  it("não sugere o que já está na fila", () => {
    const out = queueSuggestions(sources);
    expect(out.map((item) => item.videoId)).not.toContain("na-fila");
  });

  it("respeita o teto de sugestões", () => {
    const history = Array.from({ length: 20 }, (_item, at) => ({ track: track(`h${at}`) }));
    const out = queueSuggestions({ history, favorites: [], queue: [] });
    expect(out).toHaveLength(SUGGESTION_LIMIT);
  });

  it("sem teto não devolve nada (o teto é um argumento, não uma constante)", () => {
    expect(queueSuggestions(sources, 0)).toEqual([]);
  });

  it("sem histórico, os favoritos sozinhos já sugerem", () => {
    const out = queueSuggestions({ history: [], favorites: [track("f1")], queue: [] });
    expect(out.map((item) => item.videoId)).toEqual(["f1"]);
  });

  it("biblioteca e fila vazias não inventam sugestão", () => {
    expect(queueSuggestions({ history: [], favorites: [], queue: [] })).toEqual([]);
  });
});
