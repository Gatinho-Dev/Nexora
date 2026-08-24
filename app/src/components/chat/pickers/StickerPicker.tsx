import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const STICKERS: { slug: string; name: string }[] = [
  { slug: "wave", name: "Tchau!" },
  { slug: "heart", name: "Coração" },
  { slug: "thumbs-up", name: "De boa!" },
  { slug: "laugh", name: "Rindo alto" },
  { slug: "cry", name: "Chorando" },
  { slug: "fire", name: "Pegando fogo" },
  { slug: "party", name: "Festa!" },
  { slug: "thinking", name: "Pensando..." },
];

const RECENT_KEY = "nexora-recent-stickers";

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecent(slug: string): string[] {
  const next = [slug, ...loadRecent().filter(s => s !== slug)].slice(0, 8);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore storage failures
  }
  return next;
}

/**
 * Sticker picker com catálogo local da Nexora (/stickers/{slug}.svg).
 * O sticker escolhido é enviado como mensagem real (tag "sticker").
 */
export function StickerPicker({
  onPick,
  children,
}: {
  onPick: (slug: string) => void;
  children: React.ReactNode;
}) {
  const [recent, setRecent] = useState<string[]>(() => loadRecent());

  const pick = (slug: string) => {
    setRecent(saveRecent(slug));
    onPick(slug);
  };

  const renderGrid = (slugs: string[], keyPrefix: string) =>
    slugs.length === 0 ? null : (
      <div key={keyPrefix} className="grid grid-cols-3 gap-1.5">
        {slugs.map(slug => {
          const sticker = STICKERS.find(s => s.slug === slug);
          if (!sticker) return null;
          return (
            <button
              key={slug}
              type="button"
              onClick={() => pick(slug)}
              title={sticker.name}
              aria-label={`Enviar sticker ${sticker.name}`}
              className="flex aspect-square items-center justify-center rounded-xl border border-white/[0.06] bg-[#1a1c21] p-2 transition-transform hover:scale-105 active:scale-95"
            >
              <img
                src={`/stickers/${slug}.svg`}
                alt={sticker.name}
                loading="lazy"
                className="h-full w-full object-contain"
              />
            </button>
          );
        })}
      </div>
    );

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-80 bg-[#24262c] border-white/10 p-0"
      >
        <div className="max-h-72 overflow-y-auto p-2">
          {recent.length > 0 && (
            <div className="mb-2">
              <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#8e959f]">
                Recentes
              </p>
              {renderGrid(recent, "recent")}
            </div>
          )}
          <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#8e959f]">
            Nexora
          </p>
          {renderGrid(STICKERS.map(s => s.slug), "all")}
        </div>
      </PopoverContent>
    </Popover>
  );
}
