import { cn } from "@/lib/utils";
import { getNameFont } from "@/lib/nameStyle";

/**
 * Renderiza o nome de exibição com a fonte, o efeito e as cores escolhidos no
 * estúdio de perfil.
 *
 * Tudo aqui é CSS puro para o mesmo nome aparecer igual no cartão, na prévia do
 * modal de estilo e nos tiles de seleção — se a prévia mentisse, o usuário
 * escolheria um estilo e veria outra coisa no perfil.
 *
 * Fontes e efeitos vêm de `@/lib/nameStyle`; uma fonte desconhecida cai na
 * padrão e um efeito desconhecido cai em sólido, então um perfil salvo por uma
 * versão antiga do app continua renderizando em vez de quebrar.
 */
export function StyledDisplayName({
  children,
  font = "sans",
  effect = "solid",
  colorA = "#F4F7FB",
  colorB = "#7383FF",
  className,
}: {
  children: React.ReactNode;
  font?: string | null;
  effect?: string | null;
  colorA?: string | null;
  colorB?: string | null;
  className?: string;
}) {
  const first = colorA || "#F4F7FB";
  const second = colorB || "#7383FF";
  const style: React.CSSProperties = { color: first };

  if (effect === "gradient" || effect === "prism" || effect === "gummy") {
    style.backgroundImage =
      effect === "prism"
        ? `linear-gradient(90deg, ${first}, #67e8f9, #a78bfa, #f472b6, ${second})`
        : `linear-gradient(90deg, ${first}, ${second})`;
    style.backgroundClip = "text";
    style.WebkitBackgroundClip = "text";
    style.color = "transparent";
  }

  // O brilho do gummy precisa vir por baixo do gradiente, então entra depois.
  if (effect === "gummy") {
    style.filter = "drop-shadow(0 2px 0 rgba(0,0,0,.35)) saturate(1.3)";
  }

  if (effect === "neon") {
    style.textShadow = `0 0 5px ${first}, 0 0 16px ${second}`;
  } else if (effect === "outline") {
    style.color = "transparent";
    style.WebkitTextStroke = `1px ${first}`;
  } else if (effect === "sketch") {
    // "Desenho": contorno com um deslocamento, como se passado à mão.
    style.color = "transparent";
    style.WebkitTextStroke = `1.5px ${first}`;
    style.textShadow = `2px 2px 0 ${second}`;
  } else if (effect === "pop") {
    style.textShadow = `2px 2px 0 ${second}`;
  }

  return (
    <span
      className={cn(
        "inline-block max-w-full truncate font-bold",
        getNameFont(font).className,
        className
      )}
      style={style}
    >
      {children}
    </span>
  );
}
