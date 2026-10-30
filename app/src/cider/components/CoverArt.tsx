/**
 * Capa da faixa, com reserva de identidade.
 *
 * `referrerPolicy="no-referrer"` não é detalhe: sem ele, o navegador manda a
 * URL da página para o host da imagem a cada capa carregada.
 */

import type { CSSProperties } from "react";
import { Disc3 } from "lucide-react";

export function CoverArt({
  url,
  title,
  size,
  className,
  style,
  round,
}: {
  url?: string | null;
  title: string;
  size?: number | string;
  className?: string;
  style?: CSSProperties;
  round?: boolean;
}) {
  const dimension = size === undefined ? undefined : typeof size === "number" ? `${size}px` : size;
  const merged: CSSProperties = { width: dimension, height: dimension, ...style };

  if (!url) {
    return (
      <div
        className={["cover-thumb", round ? "round" : "", className ?? ""].filter(Boolean).join(" ")}
        style={{
          ...merged,
          display: "grid",
          placeItems: "center",
          background: "var(--cider-gradient-brand)",
          color: "var(--cider-on-accent)",
        }}
        aria-hidden="true"
      >
        <Disc3 size={dimension ? "60%" : 18} />
      </div>
    );
  }

  return (
    <img
      className={["cover-thumb", round ? "round" : "", className ?? ""].filter(Boolean).join(" ")}
      src={url}
      alt=""
      title={title}
      loading="lazy"
      referrerPolicy="no-referrer"
      draggable={false}
      style={merged}
    />
  );
}
