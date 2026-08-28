import { useState } from "react";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, TriangleAlert, Loader2 } from "lucide-react";

type Props = {
  src: string;
  alt: string;
  className?: string;
  moderationStatus: "processing" | "approved" | "sensitive" | "blocked";
  /** Reserved for future age-gated variants of the overlay copy. */
  adultOnly?: boolean;
  allowReveal?: boolean;
  /** User preference: hide always / warn / auto-reveal. */
  pref?: "hide" | "warn" | "auto";
};

/**
 * Media wrapper that enforces content-safety presentation:
 * - processing → skeleton "Verificando mídia..." (never shows bytes)
 * - sensitive  → strong blur + 🔞 overlay with reveal/hide
 * - blocked    → opaque placeholder, no reveal path
 * Blur is strong enough that details are unreadable before revealing.
 */
export function SensitiveMedia({
  src,
  alt,
  className,
  moderationStatus,
  adultOnly = false,
  allowReveal = false,
  pref = "warn",
}: Props) {
  const [revealed, setRevealed] = useState(
    moderationStatus === "sensitive" && allowReveal && pref === "auto"
  );
  const [broken, setBroken] = useState(false);
  const [lastKey, setLastKey] = useState(`${pref}:${moderationStatus}:${allowReveal}`);
  const key = `${pref}:${moderationStatus}:${allowReveal}`;
  if (key !== lastKey) {
    // Adjust state during render when the preference/status changes.
    setLastKey(key);
    setRevealed(moderationStatus === "sensitive" && allowReveal && pref === "auto");
  }

  if (moderationStatus === "blocked") {
    return (
      <div
        role="status"
        aria-label="Mídia bloqueada pela segurança do Nexora"
        className={cn(
          "flex min-h-40 w-full max-w-md flex-col items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-6 text-center",
          className
        )}
      >
        <TriangleAlert className="h-8 w-8 text-red-400" aria-hidden />
        <p className="text-sm font-bold text-red-300">Mídia bloqueada</p>
        <p className="max-w-xs text-xs text-muted2">
          Esta mídia viola as Diretrizes da Comunidade do Nexora e não pode ser
          exibida.
        </p>
      </div>
    );
  }

  if (moderationStatus === "processing") {
    return (
      <div
        role="status"
        aria-label="Verificando mídia"
        className={cn(
          "flex min-h-40 w-full max-w-md animate-pulse items-center justify-center gap-2 rounded-xl border border-white/10 bg-sidebar text-sm font-medium text-muted2",
          className
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Verificando mídia...
      </div>
    );
  }

  const needsBlur = moderationStatus === "sensitive";
  const blurred = needsBlur && !revealed;

  return (
    <div className={cn("relative", className)}>
      {blurred ? (
        <div
          className={cn(
            "relative flex min-h-48 w-full sm:w-80 flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-white/10",
            !broken && "bg-sidebar"
          )}
        >
          {!broken && (
            <img
              src={src}
              alt=""
              aria-hidden
              loading="lazy"
              onError={() => setBroken(true)}
              className="absolute inset-0 h-full w-full scale-110 object-cover blur-[35px]"
            />
          )}
          <div className="relative z-10 flex flex-col items-center gap-1.5 rounded-xl bg-black/75 px-4 py-3 text-center">
            <span className="text-lg" aria-hidden>{adultOnly ? "🔞" : "⚠️"}</span>
            <span className="text-xs font-extrabold tracking-widest text-white">
              {adultOnly ? "CONTEÚDO +18" : "CONTEÚDO SENSÍVEL"}
            </span>
            <span className="max-w-56 text-[11px] leading-snug text-bodyx">
              Esta mídia pode conter conteúdo adulto.
            </span>
          </div>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setBroken(true)}
          className={cn(
            "max-h-72 max-w-full rounded-xl border border-white/10 object-contain bg-sidebar",
            broken && "hidden"
          )}
        />
      )}

      {needsBlur && allowReveal && (
        <button
          type="button"
          onClick={() => setRevealed(r => !r)}
          title={revealed ? "Ocultar novamente" : "Mostrar conteúdo"}
          aria-label={revealed ? "Ocultar novamente" : "Mostrar conteúdo"}
          className={cn(
            "z-20 mt-1.5 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-200 ease-out",
            revealed
              ? "bg-white/10 text-bodyx hover:bg-white/15"
              : "absolute left-1/2 top-1/2 -translate-x-1/2 translate-y-[130%] bg-[#5865F2] text-white hover:bg-[#4752C4]"
          )}
        >
          {revealed ? (
            <>
              <EyeOff className="h-3.5 w-3.5" aria-hidden /> Ocultar novamente
            </>
          ) : (
            <>
              <Eye className="h-3.5 w-3.5" aria-hidden /> Mostrar conteúdo
            </>
          )}
        </button>
      )}
      {needsBlur && revealed && adultOnly && (
        <span className="absolute left-2 top-2 rounded-md bg-black/75 px-2 py-1 text-[10px] font-extrabold text-white">
          🔞 +18
        </span>
      )}
    </div>
  );
}
