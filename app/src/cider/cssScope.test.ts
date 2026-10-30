/**
 * Guarda de escopo do CSS do Cider.
 *
 * O CSS de `/cider` **não sai do documento** quando a pessoa volta para a
 * Nexora: o módulo já foi importado e as folhas continuam valendo. Um seletor
 * global aqui (`body`, `html`, `#root`, `*`, `a`, `img`, `::selection`…) passa a
 * valer no site inteiro, e foi exatamente isso que quebrou a Nexora: o
 * `html, body, #root { height: 100% }` + `body { overflow: hidden }` tiravam a
 * rolagem, e o `#root { zoom }` deformava a escala. O `.hidden` dos utilitários,
 * por sua vez, vencia os `hidden md:flex` do Tailwind e colunas do layout
 * sumiam, deixando só a lista de amigos online à vista.
 *
 * A regra que este teste protege é simples: **todo seletor de primeiro nível
 * precisa de uma classe (`.algo`) ou de um atributo (`[data-…]`)** — e os
 * blocos de `:root` ficam de fora porque são eles que entregam os tokens
 * `--cider-*` para o que vive fora da rota (o mini-player e o dock).
 */

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const STYLES_DIR = join(dirname(fileURLToPath(import.meta.url)), "styles");

/** Seletores de teste global achados no arquivo, com o motivo. */
function globalSelectors(css: string): string[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const found: string[] = [];
  let prelude = "";
  // Nome de cada bloco aberto: `null` para regra comum, o nome do at-rule para
  // `@media`/`@keyframes`/`@scope`. Dentro de `@keyframes` os "seletores" são
  // passos de animação (`from`, `to`, `40%`) e não casam com elemento nenhum.
  const blocks: Array<string | null> = [];

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") {
      const text = prelude.trim();
      if (text.startsWith("@")) {
        blocks.push(text.split(/[\s({]/)[0].toLowerCase());
      } else {
        blocks.push(null);
        const insideKeyframes = blocks
          .slice(0, -1)
          .some((name) => name?.startsWith("@keyframes"));
        if (text && !insideKeyframes) {
          for (const part of text.split(",")) {
            const selector = part.trim();
            if (!selector) continue;
            // `:root` (e variantes como `:root[data-theme-mode="light"]`)
            // declaram apenas variáveis `--cider-*`, que o mini-player precisa
            // ler mesmo fora de `/cider`.
            if (selector.startsWith(":root")) continue;
            if (!selector.includes(".") && !selector.includes("[")) {
              found.push(selector);
            }
          }
        }
      }
      prelude = "";
      continue;
    }
    if (char === "}") {
      blocks.pop();
      prelude = "";
      continue;
    }
    if (char === ";" && blocks.length === 0) {
      prelude = "";
      continue;
    }
    prelude += char;
  }

  return found;
}

describe("escopo do CSS do Cider", () => {
  const files = readdirSync(STYLES_DIR).filter((name) => name.endsWith(".css"));

  it("tem arquivos para checar", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  for (const file of files) {
    it(`${file} não traz seletor global`, () => {
      const offenders = globalSelectors(readFileSync(join(STYLES_DIR, file), "utf8"));
      expect(offenders, `${file} vaza para a Nexora: ${offenders.join(" | ")}`).toEqual([]);
    });
  }
});

describe("dock do player", () => {
  const indexCss = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "index.css"),
    "utf8"
  );

  it("esconde o dock em qualquer página, não só em /cider", () => {
    // O visual completo do dock mora em `styles/web.css`, que só carrega com a
    // rota. Sem estas regras no CSS global, o `<iframe>` do YouTube aparecia
    // cru no meio de qualquer tela da Nexora.
    expect(indexCss).toContain(".cider-audio-dock");
    expect(indexCss).toMatch(/\.cider-audio-dock\s*\{[^}]*opacity:\s*0/);
    expect(indexCss).toMatch(/\.cider-audio-dock\s*\{[^}]*position:\s*fixed/);
  });
});
