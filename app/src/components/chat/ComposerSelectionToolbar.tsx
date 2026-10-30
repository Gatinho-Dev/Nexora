import {
  Bold,
  Code,
  EyeOff,
  FileCode,
  Italic,
  Link2,
  Quote,
  Strikethrough,
  Underline,
} from "lucide-react";

export type ComposerFormatAction =
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "spoiler"
  | "code"
  | "codeblock"
  | "link"
  | "quote";

const ACTIONS = [
  { icon: Bold, label: "Negrito", hint: "**texto**", action: "bold" },
  { icon: Italic, label: "Itálico", hint: "*texto*", action: "italic" },
  { icon: Underline, label: "Sublinhado", hint: "__texto__", action: "underline" },
  { icon: Strikethrough, label: "Tachado", hint: "~~texto~~", action: "strike" },
  { icon: EyeOff, label: "Spoiler", hint: "||texto||", action: "spoiler" },
  { icon: Code, label: "Código inline", hint: "`código`", action: "code" },
  { icon: FileCode, label: "Bloco de código", hint: "```código```", action: "codeblock" },
  { icon: Link2, label: "Link", hint: "[texto](url)", action: "link" },
  { icon: Quote, label: "Citação", hint: "> texto", action: "quote" },
] as const satisfies ReadonlyArray<{
  icon: typeof Bold;
  label: string;
  hint: string;
  action: ComposerFormatAction;
}>;

export function ComposerSelectionToolbar({
  onAction,
}: {
  onAction: (action: ComposerFormatAction) => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Formatar texto selecionado"
      className="absolute bottom-[calc(100%+8px)] left-1/2 z-40 flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-0.5 overflow-x-auto rounded-xl border border-border/80 bg-popover/95 p-1.5 text-popover-foreground shadow-2xl backdrop-blur-xl md:left-3 md:translate-x-0"
      onPointerDown={event => event.preventDefault()}
    >
      {ACTIONS.map(({ icon: Icon, label, hint, action }) => (
        <button
          key={action}
          type="button"
          title={`${label} (${hint})`}
          aria-label={label}
          onMouseDown={event => {
            event.preventDefault();
            onAction(action);
          }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7383FF]"
        >
          <Icon className="h-4 w-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}
