import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { LyricsTimeline } from "./lyricsTimeline";
import { parseLrc } from "./core/lyrics/parser";

/** `parseLrc` devolve o resultado completo; o motor quer as linhas. */
const lines = (lrc: string) => parseLrc(lrc).lines;
import { LyricsSyncEngine } from "./core/lyrics/sync";
import { distributeWords, activeWordIndex } from "./core/lyrics/words";
import { LYRICS_PRESETS, lyricsCssVariables } from "./core/lyrics/presets";

/** LRC mínimo: duas linhas, a primeira com tempo por palavra implícito. */
const LRC = `[00:01.00]Primeira linha com algumas palavras
[00:04.00]Segunda linha depois`;

/** Quatro linhas: só assim dá para provocar um salto que conte como seek. */
const LONG_LRC = `[00:01.00]Primeira linha com algumas palavras
[00:04.00]Segunda linha depois
[00:07.00]Terceira linha em seguida
[00:10.00]Quarta linha no fim`;

describe("motor de sincronia", () => {
  it("ativa a linha certa conforme a posição avança", () => {
    const engine = new LyricsSyncEngine();
    engine.setLines(lines(LRC));

    expect(engine.update(0).activeIndex).toBe(-1);
    expect(engine.update(1_500).activeIndex).toBe(0);
    expect(engine.update(5_000).activeIndex).toBe(1);
  });

  it("trata a linha 0 como jábeginning", () => {
    const engine = new LyricsSyncEngine();
    engine.setLines(lines(LRC));
    const frame = engine.update(1_500);
    expect(frame.lines[0].state).toBe("active");
    expect(frame.lines[1].state).toBe("upcoming");
  });

  it("marca seek quando o salto passa de uma linha", () => {
    const engine = new LyricsSyncEngine();
    engine.setLines(lines(LONG_LRC));
    engine.update(1_500);
    expect(engine.update(1_600).activeIndex).toBe(0);
    // Da linha 0 para a 3: salto maior que um, então é seek.
    engine.update(13_500);
    expect(engine.transition?.seek).toBe(true);
  });

  it("passo de uma linha não é seek — é a transição normal do karaokê", () => {
    const engine = new LyricsSyncEngine();
    engine.setLines(lines(LONG_LRC));
    engine.update(1_500);
    engine.update(5_000);
    expect(engine.transition?.seek).toBe(false);
  });
});

describe("estimativa de tempo por palavra", () => {
  it("distribui a duração da linha entre as palavras", () => {
    const words = distributeWords("uma frase curta", 0, 2_000);
    expect(words).toHaveLength(3);
    expect(words[0].startTimeMs).toBe(0);
    // Cada palavra começa depois da anterior e termina antes da próxima.
    for (let i = 1; i < words.length; i++) {
      expect(words[i].startTimeMs).toBeGreaterThanOrEqual(words[i - 1].endTimeMs);
    }
    expect(words[words.length - 1].endTimeMs).toBeLessThanOrEqual(2_000);
  });

  it("palavras curtas recebem duração menor que palavras longas", () => {
    const words = distributeWords("a elephant", 0, 4_000);
    expect(words[0].text).toBe("a");
    expect(words[1].text).toBe("elephant");
    expect(words[1].endTimeMs - words[1].startTimeMs).toBeGreaterThan(
      words[0].endTimeMs - words[0].startTimeMs
    );
  });

  it("preserva pontuação e espaço entre palavras", () => {
    const words = distributeWords("Olá, mundo", 0, 1_000);
    expect(words[0].punctuation).toBe(",");
    expect(words[1].spaceBefore).toBe(true);
  });

  it("encontra a palavra ativa por busca binária", () => {
    const words = distributeWords("um dois tres quatro", 0, 4_000);
    expect(activeWordIndex(words, 0)).toBe(0);
    expect(activeWordIndex(words, 99_999)).toBe(3);
    expect(activeWordIndex(undefined, 0)).toBe(-1);
  });
});

describe("preset de exibição", () => {
  it("karaoke é o preset de efeito mais forte", () => {
    const style = LYRICS_PRESETS.karaoke;
    expect(style.wordGlow).toBeGreaterThanOrEqual(0.7);
    // Decaimento longo é o que faz a palavra cantada continuar acesa.
    expect(style.glowDecayMs).toBeGreaterThan(800);
    expect(style.activeScale).toBeGreaterThan(1);
    expect(style.animation).toBe("high");
  });

  it("minimal quase não se move, para quem prefere letra discreta", () => {
    const style = LYRICS_PRESETS.minimal;
    // O preset pede animação baixa e transição desligada: a linha troca, mas
    // não desliza nem desfoca. `slideDistance` zero é o que garante isso.
    expect(style.lineTransition).toBe("off");
    expect(style.slideDistance).toBe(0);
    expect(style.blurInactivePx).toBe(0);
    expect(style.wordGlow).toBeLessThan(0.25);
  });

  it("classic desliga a animação por inteiro", () => {
    const style = LYRICS_PRESETS.classic;
    expect(style.animation).toBe("off");
    expect(style.lineTransition).toBe("off");
  });

  it("exporta as variáveis CSS com os limites certos", () => {
    const vars = lyricsCssVariables(LYRICS_PRESETS.karaoke);
    expect(vars["--lyrics-size"]).toBe("36px");
    expect(Number(vars["--lyrics-glow"])).toBeLessThanOrEqual(1);
    expect(Number(vars["--lyrics-inactive-opacity"])).toBeLessThanOrEqual(1);
    expect(vars["--lyrics-decay"]).toMatch(/ms$/);
  });

  it("nenhum preset aperta a letra a ponto de colar as palavras", () => {
    // `-0.2em` a 34 px encolhe ~7 px por caractere: as palavras ficam sem
    // espaço nenhum entre si (a letra "toda junto"). O valor é de tracking
    // discreto, no máximo o dobro do `-0.02em` dos títulos.
    for (const [id, style] of Object.entries(LYRICS_PRESETS)) {
      expect(style.letterSpacing, `preset ${id}`).toBeGreaterThan(-0.05);
      expect(style.letterSpacing, `preset ${id}`).toBeLessThanOrEqual(0);
    }
    expect(lyricsCssVariables(LYRICS_PRESETS.karaoke)["--lyrics-letter-spacing"]).toBe("-0.02em");
  });
});

describe("fonte externa da sincronia", () => {
  // O ambiente de teste é node, sem `requestAnimationFrame`; a interpolação só
  // precisa existir, não rodar de verdade.
  beforeAll(() => {
    if (typeof globalThis.requestAnimationFrame === "undefined") {
      globalThis.requestAnimationFrame = () => 0;
      globalThis.cancelAnimationFrame = () => undefined;
    }
  });
  it("avisa os inscritos quando a posição muda", () => {
    const timeline = new LyricsTimeline();
    timeline.setLines(lines(LRC));
    let calls = 0;
    const unsubscribe = timeline.subscribe(() => (calls += 1));

    timeline.setPosition(1_500);
    expect(calls).toBeGreaterThan(0);

    unsubscribe();
    const before = calls;
    timeline.setPosition(5_000);
    expect(calls).toBe(before);
    timeline.dispose();
  });

  it("devolve a linha ativa no snapshot", () => {
    const timeline = new LyricsTimeline();
    timeline.setLines(lines(LRC));
    timeline.setPosition(5_000);
    const frame = timeline.getFrame();
    expect(frame[1].state).toBe("active");
    timeline.dispose();
  });

  it("snapshot é estável entre quadros quando não toca", () => {
    const timeline = new LyricsTimeline();
    timeline.setLines(lines(LRC));
    timeline.setPosition(1_500);
    const first = timeline.getFrame();
    // Pausado: a posição não anda, então o mesmo objeto pode ser reaproveitado.
    const second = timeline.getFrame();
    expect(second).toBe(first);
    timeline.dispose();
  });

  it("sem linhas, o snapshot é vazio e não quebra", () => {
    const timeline = new LyricsTimeline();
    timeline.setPosition(1_000);
    expect(timeline.getFrame()).toEqual([]);
    timeline.dispose();
  });
});

describe("rolagem das letras", () => {
  // O sintoma reportado era a letra "toda junto". Duas causas independentes, e
  // ambas precisam estar cobertas: o container sem altura (tudo empilhado no
  // topo) e a ausência de rolagem automática.
  it("o estilo entrega altura ao container e máscara em gradiente", () => {
    // O que o CSS precisa garantir, sem depender do navegador.
    const css = readFileSync(
      fileURLToPath(new URL("./styles/bridge.css", import.meta.url)),
      "utf-8"
    );
    expect(css).toMatch(/\.cider-root \.lyrics-scope\s*\{[^}]*max-height/s);
    expect(css).toMatch(/\.cider-root \.lyrics-lines\s*\{[^}]*flex:\s*1/s);
    // Sem a máscara em gradiente, a coluna parece uma lista, não um rolo.
    const lyrics = readFileSync(
      fileURLToPath(new URL("./styles/lyrics.css", import.meta.url)),
      "utf-8"
    );
    expect(lyrics).toContain("mask-image");
    expect(lyrics).toContain("lyrics-spacer");
  });

  it("o spacer empurra a coluna para o centro da rolagem", () => {
    // É o que dá espaço acima da primeira linha: sem ele, a linha ativa fica
    // colada no topo e o autoscroll não tem por onde centralizar.
    const lyrics = readFileSync(
      fileURLToPath(new URL("./styles/lyrics.css", import.meta.url)),
      "utf-8"
    );
    expect(lyrics).toMatch(/\.lyrics-spacer\s*\{[^}]*height/s);
  });
});
