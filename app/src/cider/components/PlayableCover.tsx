/**
 * Capa clicável do que está tocando, com as setas de expandir.
 *
 * É o gesto do Apple Music: passar o mouse na capa do player revela duas setas
 * na diagonal e um clique abre a letra em tela cheia. O componente existe para
 * que a pílula, a página "Tocando agora" e o painel usem **o mesmo** botão —
 * três cópias do mesmo overlay divergiriam no primeiro ajuste.
 *
 * Detalhes que fazem a diferença na implementação:
 *
 * - o overlay é `aria-hidden` e o botão tem rótulo de verdade ("Abrir a letra
 *   em tela cheia"): quem navega por teclado não vê as setas, mas recebe a
 *   mesma ação;
 * - o véu escurece a capa por baixo das setas (é o que faz o ícone claro ficar
 *   legível sobre capas claras);
 * - o overlay aparece no `:hover` **e** no `:focus-visible` — sem isso o botão
 *   ficaria invisível para quem chega nele pelo Tab.
 */

import { Maximize2 } from "lucide-react";
import type { CSSProperties } from "react";

import { CoverArt } from "./CoverArt";

export function PlayableCover({
  url,
  title,
  className,
  imageClassName,
  style,
  label = "Abrir a letra em tela cheia",
  disabled,
  onExpand,
}: {
  url?: string | null;
  title: string;
  /** Classe do botão (cada lugar tem a sua medida: `.pill-cover`, `.np-cover`…). */
  className?: string;
  imageClassName?: string;
  style?: CSSProperties;
  label?: string;
  disabled?: boolean;
  onExpand: () => void;
}) {
  return (
    <button
      type="button"
      className={[className, "playable-cover"].filter(Boolean).join(" ")}
      style={style}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onExpand}
    >
      <CoverArt url={url} title={title} className={imageClassName} />
      <span className="cover-expand" aria-hidden="true">
        <Maximize2 size={18} />
      </span>
    </button>
  );
}
