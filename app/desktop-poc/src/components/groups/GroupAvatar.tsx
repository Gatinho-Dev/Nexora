import { cn } from "@/lib/utils";
import type { PublicUser } from "@contracts/types";

/**
 * Avatar visual de grupo: quando não há imagem personalizada, monta um grid
 * 2×2 com os avatares dos participantes (item 37). Puro CSS/UI — nada de IA.
 */

type AvatarUser = Pick<PublicUser, "id" | "name" | "avatar" | "username">;

const sizeMap = {
  xs: { box: "h-6 w-6 text-[8px]", cell: "text-[7px]" },
  sm: { box: "h-8 w-8 text-[10px]", cell: "text-[9px]" },
  md: { box: "h-10 w-10 text-xs", cell: "text-[10px]" },
  lg: { box: "h-12 w-12 text-sm", cell: "text-xs" },
  xl: { box: "h-20 w-20 text-xl", cell: "text-base" },
} as const;

const tints = [
  "bg-[#5865F2]",
  "bg-[#3BA55C]",
  "bg-[#FAA61A]",
  "bg-[#ED4245]",
];

function initial(name: string | null | undefined): string {
  return (name ?? "?").trim().charAt(0).toUpperCase() || "?";
}

export function GroupAvatar({
  users,
  src,
  name,
  size = "md",
  className,
}: {
  /** Participantes (ordem estável preferida). */
  users?: AvatarUser[] | null;
  /** Imagem personalizada do grupo — tem prioridade. */
  src?: string | null;
  name?: string | null;
  size?: keyof typeof sizeMap;
  className?: string;
}) {
  const s = sizeMap[size];

  if (src) {
    return (
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-full bg-secondary select-none",
          s.box,
          className,
        )}
      >
        <img
          src={src}
          alt={name ?? "Grupo"}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  const picked = (users ?? []).filter(u => u.id).slice(0, 4);
  if (picked.length === 0) {
    return (
      <div
        aria-hidden
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-secondary font-bold text-muted2 select-none",
          s.box,
          className,
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-[58%] w-[58%]"
          aria-hidden
        >
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid shrink-0 grid-cols-2 overflow-hidden rounded-full bg-panel ring-1 ring-black/20 select-none",
        s.box,
        className,
      )}
      role="img"
      aria-label={name ? `Grupo ${name}` : "Avatar do grupo"}
    >
      {picked.map((u, i) => (
        <div
          key={u.id}
          className={cn(
            "flex items-center justify-center font-bold text-white/95 overflow-hidden",
            tints[i % tints.length],
            picked.length === 2 && "h-full",
            picked.length === 3 && i === 0 && "col-span-2 h-1/2",
            picked.length === 3 && i > 0 && "h-1/2",
            picked.length === 4 && "h-1/2",
          )}
        >
          {u.avatar ? (
            <img
              src={u.avatar}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className={s.cell}>{initial(u.name ?? u.username)}</span>
          )}
        </div>
      ))}
    </div>
  );
}

