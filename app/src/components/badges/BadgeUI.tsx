import { useState } from "react";
import type { UserBadgeDTO } from "@contracts/types";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  RARITY_COLORS,
  RARITY_LABELS,
  badgeIconUrl,
} from "./badgeMeta";

/** Ícone do emblema (SVG próprio em /public/badges). */
export function BadgeIcon({
  badge,
  size = 24,
  className,
}: {
  badge: { icon: string; name: string };
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={badgeIconUrl(badge.icon)}
      alt={badge.name}
      width={size}
      height={size}
      loading="lazy"
      className={cn("shrink-0 select-none", className)}
      style={{ width: size, height: size }}
    />
  );
}

/** Modal de detalhes do emblema (nome, imagem, raridade, obtida em…). */
export function BadgeModal({
  badge,
  onClose,
}: {
  badge: UserBadgeDTO | null;
  onClose: () => void;
}) {
  const color = badge ? RARITY_COLORS[badge.rarity] ?? "#B5BAC1" : "#B5BAC1";
  return (
    <Dialog open={badge !== null} onOpenChange={open => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="top-auto bottom-0 left-[50%] max-h-[85dvh] w-full max-w-sm translate-x-[-50%] translate-y-0 gap-0 overflow-y-auto rounded-t-2xl rounded-b-none border-white/10 bg-[#1E2028] p-0 pb-[env(safe-area-inset-bottom)] text-white shadow-2xl data-[state=open]:slide-in-from-bottom-8 sm:bottom-auto sm:top-[50%] sm:-translate-y-1/2 sm:rounded-2xl sm:pb-0"
      >
        {badge && (
          <div className="flex flex-col items-center px-6 py-6 text-center select-none">
            <div
              className="flex h-24 w-24 items-center justify-center rounded-2xl border-2"
              style={{ borderColor: `${color}55`, backgroundColor: `${color}14` }}
            >
              <BadgeIcon badge={badge} size={72} />
            </div>
            <DialogTitle className="mt-4 text-lg font-bold">{badge.name}</DialogTitle>
            <span
              className="mt-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ backgroundColor: `${color}22`, color }}
            >
              {RARITY_LABELS[badge.rarity] ?? badge.rarity}
            </span>
            {badge.description && (
              <p className="mt-3 text-sm leading-6 text-bodyx">{badge.description}</p>
            )}
            <dl className="mt-5 w-full space-y-2 rounded-xl bg-white/[0.04] p-3.5 text-left text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-faint">Obtida em</dt>
                <dd className="font-semibold text-bodyx">
                  {new Date(badge.grantedAt).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-faint">Disponibilidade</dt>
                <dd className="font-semibold text-bodyx">
                  {badge.permanent ? "Permanente" : "Por tempo limitado"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-faint">Como conseguir</dt>
                <dd className="max-w-[60%] text-right font-semibold text-bodyx">
                  {badge.grantType === "SYSTEM"
                    ? "Automaticamente, atendendo os requisitos"
                    : badge.grantType === "EVENT"
                      ? "Eventos especiais da Nexora"
                      : badge.grantType === "STAFF_DIRECTORY"
                        ? "Equipe oficial da Nexora"
                        : "Por concessão da equipe"}
                </dd>
              </div>
            </dl>
            <button
              onClick={onClose}
              className="mt-4 min-h-[44px] w-full rounded-lg bg-white/10 text-sm font-bold text-white transition-colors hover:bg-white/15 active:bg-white/20"
            >
              Fechar
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Grade clicável de emblemas com tooltip + modal de detalhes. */
export function BadgeList({
  badges,
  emptyMessage = "Nenhum emblema ainda.",
  size = 24,
}: {
  badges: UserBadgeDTO[];
  emptyMessage?: string;
  size?: number;
}) {
  const [selected, setSelected] = useState<UserBadgeDTO | null>(null);
  if (badges.length === 0) {
    return (
      <p className="text-xs text-faint select-none">{emptyMessage}</p>
    );
  }
  return (
    <>
      <div className="flex flex-wrap gap-1.5" aria-label="Emblemas do perfil">
        {badges.map(badge => {
          const color = RARITY_COLORS[badge.rarity] ?? "#B5BAC1";
          return (
            <button
              key={badge.id}
              type="button"
              onClick={() => setSelected(badge)}
              aria-label={`${badge.name} — ver detalhes`}
              title={`${badge.name}\n${badge.description ?? ""}`}
              className="group inline-flex min-h-[32px] items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold text-bodyx transition-transform hover:scale-[1.04] active:scale-95"
              style={{ borderColor: `${color}55`, backgroundColor: `${color}14` }}
            >
              <BadgeIcon badge={badge} size={size - 6} />
              {badge.name}
            </button>
          );
        })}
      </div>
      <BadgeModal badge={selected} onClose={() => setSelected(null)} />
    </>
  );
}
