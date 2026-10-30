import { Crown, Flower2, Headphones, Leaf, Orbit, Sparkles } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import {
  AVATAR_DECORATION_FRAMES,
  AVATAR_DECORATION_GRADIENT,
  AVATAR_DECORATION_GRADIENT_MASK,
  getAvatarDecoration,
  type AvatarDecorationOrnament,
} from "@/lib/avatarDecorations";
import { cn } from "@/lib/utils";

const CAT_EAR_CLIP = "polygon(50% 0%, 100% 100%, 0% 100%)";

/**
 * Avatar com a moldura de decoração.
 *
 * A decoração vem do catálogo (`lib/avatarDecorations`), então o mesmo id
 * desenha a mesma coisa aqui, no cartão de perfil, na lista de conversas e na
 * prévia do modal. Ids desconhecidos — profiles salvos por versões antigas —
 * caem em "Nenhuma" em vez de sumir com o avatar.
 *
 * Os ornamentos usam posições e tamanhos em porcentagem: assim uma única
 * implementação serve para o avatar de 48px do modal e o de 112px do perfil,
 * sem tabela de escalas por tamanho.
 */
export function ProfileAvatar({
  userId,
  name,
  src,
  decoration = "none",
  status,
  size = "xl",
  className,
}: {
  userId?: number;
  name?: string | null;
  src?: string | null;
  decoration?: string | null;
  status?: string;
  size?: "lg" | "xl" | "2xl";
  className?: string;
}) {
  const current = getAvatarDecoration(decoration);
  const gradient = current.frame === "gradient";
  const frame =
    current.frame !== "none" && !gradient
      ? AVATAR_DECORATION_FRAMES[current.frame]
      : undefined;

  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <span className={cn("relative rounded-full", frame)}>
        {gradient && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 z-10 rounded-full"
            style={{
              background: AVATAR_DECORATION_GRADIENT,
              WebkitMask: AVATAR_DECORATION_GRADIENT_MASK,
              mask: AVATAR_DECORATION_GRADIENT_MASK,
            }}
          />
        )}
        <Avatar
          userId={userId}
          name={name}
          src={src}
          size={size}
          statusOverride={status}
          showStatus={Boolean(status)}
        />
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20 drop-shadow-md"
      >
        <DecorationOrnament ornament={current.ornament} />
      </span>
    </span>
  );
}

function DecorationOrnament({ ornament }: { ornament: AvatarDecorationOrnament }) {
  switch (ornament) {
    case "sparkles":
      return (
        <Sparkles className="absolute -right-[6%] -top-[10%] h-[34%] w-[34%] text-violet-200" />
      );
    case "crown":
      return (
        <Crown className="absolute left-1/2 top-[-20%] h-[44%] w-[44%] -translate-x-1/2 text-amber-300" />
      );
    case "orbit":
      return (
        <Orbit className="absolute -bottom-[12%] -right-[10%] h-[40%] w-[40%] text-cyan-200" />
      );
    case "ears":
      return (
        <>
          <span
            className="absolute -top-[14%] left-[12%] h-[30%] w-[24%] -rotate-[16deg] bg-pink-200"
            style={{ clipPath: CAT_EAR_CLIP }}
          />
          <span
            className="absolute -top-[14%] right-[12%] h-[30%] w-[24%] rotate-[16deg] bg-pink-200"
            style={{ clipPath: CAT_EAR_CLIP }}
          />
          <Whiskers side="left" />
          <Whiskers side="right" />
        </>
      );
    case "headset":
      return (
        <Headphones className="absolute left-1/2 top-[-20%] h-[48%] w-[48%] -translate-x-1/2 text-slate-200" />
      );
    case "bloom":
      return (
        <>
          <Flower2 className="absolute -bottom-[8%] -left-[10%] h-[32%] w-[32%] -rotate-12 text-pink-300" />
          <Flower2 className="absolute -bottom-[8%] -right-[10%] h-[32%] w-[32%] rotate-12 text-pink-300" />
        </>
      );
    case "pixels":
      return (
        <>
          <span className="absolute -top-[6%] left-[4%] h-[12%] w-[12%] bg-fuchsia-300" />
          <span className="absolute -top-[6%] right-[4%] h-[12%] w-[12%] bg-fuchsia-300" />
          <span className="absolute -bottom-[6%] left-[4%] h-[12%] w-[12%] bg-fuchsia-300" />
          <span className="absolute -bottom-[6%] right-[4%] h-[12%] w-[12%] bg-fuchsia-300" />
        </>
      );
    case "leaves":
      return (
        <>
          <Leaf className="absolute -bottom-[10%] -left-[12%] h-[34%] w-[34%] -rotate-[18deg] text-emerald-300" />
          <Leaf className="absolute -bottom-[10%] -right-[12%] h-[34%] w-[34%] rotate-[18deg] text-emerald-300" />
        </>
      );
    default:
      return null;
  }
}

function Whiskers({ side }: { side: "left" | "right" }) {
  return (
    <>
      <span
        className={cn(
          "absolute top-[48%] h-[3%] w-[16%] rounded-full bg-pink-100/90",
          side === "left"
            ? "-left-[12%] rotate-[10deg]"
            : "-right-[12%] -rotate-[10deg]",
        )}
      />
      <span
        className={cn(
          "absolute top-[62%] h-[3%] w-[16%] rounded-full bg-pink-100/90",
          side === "left"
            ? "-left-[12%] -rotate-[10deg]"
            : "-right-[12%] rotate-[10deg]",
        )}
      />
    </>
  );
}
