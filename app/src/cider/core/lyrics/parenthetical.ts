/**
 * Subletra: o canto de apoio entre parênteses.
 *
 * Muita fonte escreve o backing vocal **na mesma linha** da letra principal —
 * `But show me, can you keep it up? (It up)`. O Apple Music não desenha isso em
 * fila: ele põe o parêntese **embaixo** da letra, bem menor, que é como a música
 * soa (voz principal na frente, resposta atrás).
 *
 * Este módulo só decide **o que é de quem**: as palavras de cada lado e o texto
 * do apoio já sem os parênteses (na referência eles não aparecem). Quem desenha
 * é o `LyricsView`, e cada palavra continua com o seu tempo, então a subletra
 * acende junto com a música como qualquer outra palavra.
 *
 * Duas decisões que evitam estrago:
 *
 * - **parêntese desbalanceado não é subletra**: uma linha com um `(` solto
 *   seguiria engolindo o resto da linha. Nesse caso a linha fica como veio;
 * - **palavra que mistura os dois lados** (`passion(ooh)`, sem espaço) fica na
 *   letra principal inteira: ela é uma só unidade de tempo, e cortá-la deixaria
 *   metade da palavra sem tempo. Na letra **sem** tempo o corte pode ser dentro
 *   da palavra, porque ali não há sincronia para quebrar.
 */

import type { LyricsWord } from "./types";

/** Como desenhar uma palavra do apoio: sem os parênteses. */
export interface BackingWordDisplay {
  text: string;
  punctuation?: string;
  spaceBefore: boolean;
}

/** Onde cada palavra da linha é desenhada. */
export interface ParentheticalParts {
  /** Índices, na linha, das palavras da letra principal. */
  main: number[];
  /** Índices das palavras do canto de apoio (a subletra de baixo). */
  backing: number[];
  /** Texto de cada índice de `backing`, com os parênteses já fora. */
  backingDisplay: Map<number, BackingWordDisplay>;
}

/** Texto de uma linha sem palavras marcadas (letra sem tempo). */
export interface ParentheticalText {
  main: string;
  backing: string;
}

const OPEN = "(";
const CLOSE = ")";
/** Mesma cauda de pontuação que o tokenizador usa (veja `words.ts`). */
const TRAILING = /([.,!?;:…"')\]]+)$/;

/** Um passo da varredura: o que ficou fora e o que ficou dentro dos parênteses. */
interface Step {
  outside: string;
  inside: string;
  depth: number;
}

function consume(raw: string, depth: number): Step {
  let outside = "";
  let inside = "";
  let level = depth;
  for (const char of raw) {
    if (char === OPEN) level += 1;
    else if (char === CLOSE) level = Math.max(0, level - 1);
    else if (level > 0) inside += char;
    else outside += char;
  }
  return { outside, inside, depth: level };
}

/** `true` quando há parênteses na linha — ou seja, há o que separar. */
export function hasParenthetical(words: LyricsWord[] | undefined): boolean {
  return Boolean(
    words?.some((word) => /[()]/.test(`${word.text}${word.punctuation ?? ""}`))
  );
}

/**
 * Separa as palavras da linha em letra principal e canto de apoio.
 *
 * Devolve `null` quando não há subletra: sem parênteses, com parênteses
 * desbalanceados ou quando só sobraram parênteses vazios. Assim o `LyricsView`
 * desenha a linha normal sem precisar repetir a regra.
 */
export function splitParenthetical(words: LyricsWord[]): ParentheticalParts | null {
  if (!hasParenthetical(words)) return null;

  const main: number[] = [];
  const backing: number[] = [];
  const backingDisplay = new Map<number, BackingWordDisplay>();
  let depth = 0;

  words.forEach((word, index) => {
    const raw = `${word.text}${word.punctuation ?? ""}`;
    // O lado é decidido pelo **começo** da palavra: `(It` abre o parêntese e
    // `up)` já está dentro dele. Quem mistura os dois lados fica na principal.
    const belongs = depth > 0 || raw.startsWith(OPEN);
    const step = consume(raw, depth);
    depth = step.depth;

    if (!belongs) {
      main.push(index);
      return;
    }
    const inside = step.inside.trim();
    // Sobrou só o parêntese: ele não é desenhado em lugar nenhum.
    if (!inside) return;
    const punctuation = TRAILING.exec(inside)?.[1] ?? "";
    backing.push(index);
    backingDisplay.set(index, {
      text: inside.slice(0, inside.length - punctuation.length),
      punctuation: punctuation || undefined,
      // A primeira palavra do apoio encosta na margem da linha, não no espaço
      // que ela tinha depois do parêntese.
      spaceBefore: backing.length === 1 ? false : Boolean(word.spaceBefore),
    });
  });

  if (depth !== 0 || backing.length === 0) return null;
  return { main, backing, backingDisplay };
}

/**
 * A mesma separação para linhas **sem palavra marcada** (letra sem tempo, que
 * aparece inteira): o texto de apoio sai de baixo, também sem os parênteses.
 */
export function splitParentheticalText(text: string): ParentheticalText | null {
  if (!text.includes(OPEN) && !text.includes(CLOSE)) return null;

  const { outside, inside, depth } = consume(text, 0);
  if (depth !== 0) return null;

  const backing = inside.replace(/\s+/g, " ").trim();
  if (!backing) return null;

  return { main: outside.replace(/\s+/g, " ").trim(), backing };
}
