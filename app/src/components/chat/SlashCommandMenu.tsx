import { useEffect, useRef } from "react";
import { Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NexoraCommand } from "@/lib/commands/registry";

/**
 * Autocomplete de slash commands: lista filtrada com navegação por teclado
 * (setas/Enter/Tab/Esc tratados no composer). Anuncia contagem para leitores
 * de tela via role="listbox" + aria-activedescendant.
 */
export function SlashCommandMenu({
  commands,
  selectedIndex,
  onSelect,
  onHover,
  query,
}: {
  commands: NexoraCommand[];
  selectedIndex: number;
  onSelect: (command: NexoraCommand) => void;
  onHover: (index: number) => void;
  query: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${selectedIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  return (
    <div
      role="listbox"
      aria-label={`${commands.length} comandos encontrados`}
      aria-activedescendant={`slash-command-${commands[selectedIndex]?.name ?? ""}`}
      className="absolute bottom-full left-0 mb-2 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-white/10 bg-panel shadow-2xl z-30 select-none animate-in fade-in slide-in-from-bottom-1 duration-150"
    >
      <div className="border-b border-white/[0.06] px-3 py-2">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-faint">
          <Terminal className="h-3 w-3" />
          Comandos
          {query && (
            <span className="font-normal normal-case tracking-normal text-muted2">
              · “{query}”
            </span>
          )}
        </p>
      </div>
      <div ref={listRef} className="max-h-64 overflow-y-auto p-1">
        {commands.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-muted2">
            Nenhum comando encontrado.
          </p>
        ) : (
          commands.map((command, index) => {
            const Icon = command.icon;
            const active = index === selectedIndex;
            return (
              <button
                key={command.name}
                id={`slash-command-${command.name}`}
                data-index={index}
                role="option"
                aria-selected={active}
                onClick={() => onSelect(command)}
                onMouseEnter={() => onHover(index)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
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
                <span className="shrink-0 rounded bg-white/[0.05] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#8e959f]">
                  {command.app}
                </span>
              </button>
            );
          })
        )}
      </div>
      <div className="border-t border-white/[0.06] px-3 py-1.5 text-[9px] text-faint">
        ↑↓ navegar · Enter selecionar · Tab completar · Esc fechar
      </div>
    </div>
  );
}
