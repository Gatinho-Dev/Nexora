import { MessageContent } from "./chat/MessageContent";
import { cn } from "@/lib/utils";

/**
 * Renderer de Markdown seguro e reutilizável (mensagens globais,
 * anúncios, descrições, changelogs). Reusa o tokenizer React do chat —
 * NUNCA interpreta HTML (sem dangerouslySetInnerHTML), logo scripts/
 * iframes/handlers inline são renderizados como texto puro.
 *
 * Suporta: **negrito**, *itálico*, __sublinhado__, ~~riscado~~, `código`,
 * blocos ``` ```, # títulos, > citações, listas (- e 1.), links
 * [texto](https://…), URLs nuas clicáveis, spoiler ||texto||.
 */
export function MarkdownRenderer({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "markdown-renderer break-words text-sm leading-6 text-bodyx [&_.chat-link]:font-medium [&_.chat-link]:text-[#7383FF] [&_.chat-link]:underline [&_.chat-link]:decoration-[#7383FF]/50 hover:[&_.chat-link]:decoration-[#7383FF] [&_.message-header]:mt-2 [&_.message-header]:font-bold [&_.message-header]:text-foreground [&_.message-h1]:text-lg [&_.message-h2]:text-base [&_.message-h3]:text-sm [&_.message-quote]:border-l-4 [&_.message-quote]:border-white/20 [&_.message-quote]:pl-3 [&_.message-quote]:text-muted2 [&_.inline-code]:rounded [&_.inline-code]:bg-black/30 [&_.inline-code]:px-1 [&_.inline-code]:py-0.5 [&_.inline-code]:font-mono [&_.inline-code]:text-[0.85em]",
        className,
      )}
    >
      <MessageContent content={content} />
    </div>
  );
}
