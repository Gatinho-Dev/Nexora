/**
 * A fila tem duas origens, e é isso que o desenho do iOS 18 separa:
 * "Tocar depois" de "Adicionar à fila", e "Limpar" (o que foi posto à mão) de
 * "parar e esvaziar". Estes testes cobrem essa distinção inteira porque ela é
 * lógica pura — o motor só a conecta ao player.
 */

import { describe, expect, it } from "vitest";

import {
  appendToQueue,
  clearManual,
  insertAfterCurrent,
  manualIndexes,
  manualLosses,
  queueFrom,
  removeAt,
  type QueueState,
} from "./core/queue";
import type { CiderTrack } from "./api/query";

/** Faixa mínima válida: só o que a fila usa (id, título e o resto do tipo). */
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

const ids = (state: QueueState) => state.entries.map((entry) => entry.track.videoId);

/** O álbum de três faixas, tocando a primeira. */
const context = (): QueueState => queueFrom([track("a"), track("b"), track("c")]);

describe("fila: contexto e adicionadas à mão", () => {
  it("começa sem nada à mão", () => {
    const state = context();
    expect(ids(state)).toEqual(["a", "b", "c"]);
    expect(state.index).toBe(0);
    expect(manualIndexes(state.entries)).toEqual([]);
  });

  it("“Adicionar à fila” vai para o fim e fica marcada", () => {
    const state = appendToQueue(context(), [track("x")]);
    expect(ids(state)).toEqual(["a", "b", "c", "x"]);
    expect(manualIndexes(state.entries)).toEqual([3]);
    // A faixa que toca não se mexe.
    expect(state.index).toBe(0);
  });

  it("“Tocar depois” entra logo depois da atual", () => {
    const state = insertAfterCurrent(context(), [track("x")]);
    expect(ids(state)).toEqual(["a", "x", "b", "c"]);
    expect(manualIndexes(state.entries)).toEqual([1]);
    expect(state.index).toBe(0);
  });

  it("as duas ações divergem quando a mão já estava na fila", () => {
    // É a diferença que o iOS 18 veio deixar clara: "depois" fica na frente do
    // que já estava à mão, "na fila" vai para o fim de tudo.
    const withManual = appendToQueue(context(), [track("x")]);
    expect(ids(appendToQueue(withManual, [track("y")]))).toEqual(["a", "b", "c", "x", "y"]);
    expect(ids(insertAfterCurrent(withManual, [track("y")]))).toEqual(["a", "y", "b", "c", "x"]);
  });

  it("“Tocar depois” de uma faixa que já está na fila a **move** para a frente", () => {
    // Ela continua sendo do contexto (a marca é a da entrada original), mas a
    // ordem que a pessoa pediu vale: nada de duplicar o mesmo vídeo.
    const state = insertAfterCurrent(context(), [track("c")]);
    expect(ids(state)).toEqual(["a", "c", "b"]);
    expect(manualIndexes(state.entries)).toEqual([]);
    expect(state.index).toBe(0);
  });

  it("“Tocar depois” da própria faixa que toca não muda nada", () => {
    const state = context();
    expect(insertAfterCurrent(state, [track("a")]).entries).toBe(state.entries);
  });

  it("nunca duplica o que já está na fila", () => {
    const state = appendToQueue(context(), [track("a"), track("d")]);
    expect(ids(state)).toEqual(["a", "b", "c", "d"]);
    // Um vídeo sem id não entra.
    expect(ids(appendToQueue(state, [track("")]))).toEqual(["a", "b", "c", "d"]);
    // Nada novo devolve a **mesma** fila: o motor usa isso para não publicar.
    const same = appendToQueue(state, [track("b")]);
    expect(same.entries).toBe(state.entries);
  });

  it("sem nada tocando, “tocar depois” começa a fila", () => {
    const idle: QueueState = { entries: [], index: -1 };
    const state = insertAfterCurrent(idle, [track("x"), track("y")]);
    expect(ids(state)).toEqual(["x", "y"]);
    expect(state.index).toBe(0);
    // E o que entra assim também conta como posto à mão.
    expect(manualIndexes(state.entries)).toEqual([0, 1]);
  });

  it("remover antes da atual desloca o índice", () => {
    const state = removeAt({ ...context(), index: 2 }, 0);
    expect(ids(state)).toEqual(["b", "c"]);
    expect(state.index).toBe(1);
    expect(state.entries[state.index]?.track.videoId).toBe("c");
  });

  it("a faixa que toca não sai da fila", () => {
    const state = context();
    expect(removeAt(state, 0).entries).toBe(state.entries);
  });

  it("“Limpar” tira o que foi posto à mão e preserva o contexto", () => {
    const withManual = appendToQueue(insertAfterCurrent(context(), [track("x")]), [track("y")]);
    expect(ids(withManual)).toEqual(["a", "x", "b", "c", "y"]);

    const state = clearManual({ ...withManual, index: 2 });
    expect(ids(state)).toEqual(["a", "b", "c"]);
    expect(state.index).toBe(1);
    expect(state.entries[state.index]?.track.videoId).toBe("b");
  });

  it("“Limpar” não tira a faixa que está tocando, mesmo à mão", () => {
    // O áudio já está carregado: dizer que nada toca seria mentira.
    const both = appendToQueue({ entries: [], index: -1 }, [track("x"), track("y")]);
    expect(manualIndexes(both.entries)).toEqual([0, 1]);
    const state = clearManual({ ...both, index: 1 });
    expect(ids(state)).toEqual(["y"]);
    expect(state.index).toBe(0);
  });

  it("“Limpar” numa fila só de contexto não muda nada", () => {
    const state = context();
    const cleared = clearManual({ ...state, index: 1 });
    expect(cleared.entries).toBe(state.entries);
    expect(cleared.index).toBe(1);
  });
});

describe("fila: a conta que decide se a interface pergunta", () => {
  const queue = [track("a"), track("b"), track("c")];
  // Índices 1 e 2 foram colocados à mão.
  const manual = [1, 2];

  it("conta só o que realmente sai", () => {
    // Tocar a lista inteira de novo não perde nada: nada a perguntar.
    expect(manualLosses(queue, manual, queue)).toBe(0);
    // Uma lista que já inclui o que estava à mão também não perde nada.
    expect(manualLosses(queue, manual, [track("c"), track("z")])).toBe(1);
    expect(manualLosses(queue, manual, [track("z")])).toBe(2);
  });

  it("fila sem nada à mão nunca pergunta", () => {
    expect(manualLosses(queue, [], [track("z")])).toBe(0);
  });
});
