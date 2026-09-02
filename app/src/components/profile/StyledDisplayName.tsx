import { cn } from "@/lib/utils";

const FONT_CLASSES: Record<string, string> = {
  sans: "font-sans",
  serif: "font-serif tracking-wide",
  rounded: "font-sans tracking-wide",
  mono: "font-mono tracking-tight",
  display: "font-serif font-black tracking-wider",
  handwritten: "font-serif italic tracking-wide",
};

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
  if (effect === "gradient" || effect === "prism") {
    style.backgroundImage =
      effect === "prism"
        ? `linear-gradient(90deg, ${first}, #67e8f9, #a78bfa, #f472b6, ${second})`
        : `linear-gradient(90deg, ${first}, ${second})`;
    style.backgroundClip = "text";
    style.WebkitBackgroundClip = "text";
    style.color = "transparent";
  } else if (effect === "neon") {
    style.textShadow = `0 0 5px ${first}, 0 0 16px ${second}`;
  } else if (effect === "outline") {
    style.color = "transparent";
    style.WebkitTextStroke = `1px ${first}`;
  } else if (effect === "pop") {
    style.textShadow = `2px 2px 0 ${second}`;
  }
  return (
    <span
      className={cn(
        "inline-block max-w-full truncate font-bold",
        FONT_CLASSES[font || "sans"] ?? FONT_CLASSES.sans,
        className
      )}
      style={style}
    >
      {children}
    </span>
  );
}
