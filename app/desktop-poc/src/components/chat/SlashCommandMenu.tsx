import { useEffect, useMemo, useRef } from "react";
import { Star, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getRecentCommands,
  type NexoraCommand,
} from "@/lib/commands/registry";

const CATEGORY_META: Record<
  NexoraCommand["category"],
  { label: string; emoji: string }
> = {
  mensagens: { label: "Mensagens", emoji: "💬" },
  mídia: { label: "Mídia", emoji: "📎" },
  enquetes: { label: "Enquetes", emoji: "📊" },
  tópicos: { label: "Tópicos", emoji: "🧵" },
  perfil: { label: "Perfil", emoji: "👤" },
  social: { label: "Social", emoji: "👥" },
  servidor: { label: "Servidor", emoji: "🏠" },
  utilidades: { label: "Utilidades", emoji: "🛠️" },
  diversão: { label: "Diversão", emoji: "🎮" },
};

const CATEGORY_ORDER = [
  "mensagens",
  "mídia",
  "enquetes",
  "tópicos",
  "perfil",
  "social",
  "servidor",
  "utilidades",
  "diversão",
] as const;

type Section = {
  key: string;
  title: string | null;
  start: number;
  commands: NexoraCommand[];
};

export function SlashCommandMenu({
  commands,
  selectedIndex,
  onSelect,
  onHover,
  query,
  favorites,
  onToggleFavorite,
}: {
  commands: NexoraCommand[];
  selectedIndex: number;
  onSelect: (command: NexoraCommand) => void;
  onHover: (index: number) => void;
  query: string;
  favorites: string[];
  onToggleFavorite: (name: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const hasQuery = query.trim().length > 0;
  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);

  const sections = useMemo<Section[]>(() => {
    if (hasQuery) {
      return [
        { key: "results", title: null, start: 0, commands },
      ];
    }
    const byName = new Map(commands.map(c => [c.name, c] as const));
    const built: Omit<Section, "start">[] = [];
    const favoriteCommands = commands.filter(c => favoriteSet.has(c.name));
    if (favoriteCommands.length > 0) {
      built.push({
        key: "favorites",
        title: "⭐ Favoritos",
        commands: favoriteCommands,
      });
    }
    const recentCommands = getRecentCommands()
      .map(name => byName.get(name))
      .filter((c): c is NexoraCommand => Boolean(c));
    if (recentCommands.length > 0) {
      built.push({
        key: "recent",
        title: "🕘 Recentes",
        commands: recentCommands,
      });
    }
    for (const category of CATEGORY_ORDER) {
      const inCategory = commands.filter(c => c.category === category);
      if (inCategory.length === 0) continue;
      const meta = CATEGORY_META[category];
      built.push({
        key: category,
        title: `${meta.emoji} ${meta.label}`,
        commands: inCategory,
      });
    }
    let offset = 0;
    return built.map(section => {
      const withStart = { ...section, start: offset };
      offset += section.commands.length;
      return withStart;
    });
  }, [commands, hasQuery, favoriteSet]);

  const totalRows = sections.reduce(
    (sum, section) => sum + section.commands.length,
    0,
  );
  const activeName =
    selectedIndex >= 0 && selectedIndex < commands.length
      ? commands[selectedIndex]?.name
      : undefined;
  const activeRowId = (() => {
    if (!activeName) return null;
    for (const section of sections) {
      const local = section.commands.findIndex(c => c.name === activeName);
      if (local >= 0) return `${section.start + local}`;
    }
    return null;
  })();

  useEffect(() => {
    if (activeRowId === null) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${activeRowId}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeRowId]);

  const renderCommand = (command: NexoraCommand, flatIndex: number) => {
    const Icon = command.icon;
    const active = String(flatIndex) === activeRowId;
    const isFavorite = favoriteSet.has(command.name);
    return (
      <div
        key={`${command.name}-${flatIndex}`}
        id={`slash-command-${command.name}-${flatIndex}`}
        data-index={flatIndex}
        role="option"
        aria-selected={active}
        aria-label={`/${command.name}: ${command.description}`}
        onClick={() => onSelect(command)}
        onMouseEnter={() => {
          const idx = commands.findIndex(c => c.name === command.name);
          if (idx >= 0) onHover(idx);
        }}
        className={cn(
          "group flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
          active ? "bg-[#5865F2]/20" : "hover:bg-white/[0.04]",
        )}
      >
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            active ? "bg-[#5865F2] text-white" : "bg-white/[0.06] text-muted2",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-bold text-white">
            /{command.name}
          </span>
          <span className="block truncate text-[11px] text-muted2">
            {command.description}
          </span>
        </span>
        <button
          type="button"
          aria-label={
            isFavorite
              ? `Remover /${command.name} dos favoritos`
              : `Adicionar /${command.name} aos favoritos`
          }
          onClick={e => {
            e.stopPropagation();
            onToggleFavorite(command.name);
          }}
          className="shrink-0 rounded p-1 text-muted2 transition-colors hover:text-yellow-300"
        >
          <Star
            className={cn(
              "h-3.5 w-3.5 transition-opacity",
              isFavorite
                ? "fill-yellow-400 text-yellow-400 opacity-100"
                : "opacity-0 group-hover:opacity-70",
            )}
          />
        </button>
        <span className="shrink-0 rounded bg-white/[0.05] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#8e959f]">
          {CATEGORY_META[command.category]?.label ?? command.category}
        </span>
      </div>
    );
  };

  return (
    <div
      role="listbox"
      aria-label={`${totalRows} comandos encontrados`}
      aria-activedescendant={
        activeRowId !== null && activeName
          ? `slash-command-${activeName}-${activeRowId}`
          : undefined
      }
      className="absolute bottom-full left-0 mb-2 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-white/10 bg-panel shadow-2xl z-30 select-none animate-in fade-in slide-in-from-bottom-1 duration-150"
    >
      <div className="border-b border-white/[0.06] px-3 py-2">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-faint">
          <Terminal className="h-3 w-3" />
          Comandos
          <span className="rounded-full bg-white/[0.06] px-1.5 py-px font-bold normal-case tracking-normal text-muted2">
            {totalRows}
          </span>
          {hasQuery && (
            <span className="font-normal normal-case tracking-normal text-muted2">
              · “{query}”
            </span>
          )}
        </p>
      </div>
      <div ref={listRef} className="max-h-72 overflow-y-auto p-1">
        {totalRows === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-muted2">
            Nenhum comando encontrado.
          </p>
        ) : (
          sections.map(section => (
            <div key={section.key}>
              {section.title && (
                <p className="px-2.5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-faint">
                  {section.title}
                </p>
              )}
              {section.commands.map((command, i) =>
                renderCommand(command, section.start + i),
              )}
            </div>
          ))
        )}
      </div>
      <div className="border-t border-white/[0.06] px-3 py-1.5 text-[9px] text-faint">
        ↑↓ navegar · Enter selecionar · Tab completar · Esc fechar
      </div>
    </div>
  );
}
