import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAppStore } from "@/store/useAppStore";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { X, Megaphone, Info, CheckCircle2, TriangleAlert, OctagonX, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const TYPE_STYLES: Record<string, { bar: string; icon: React.ReactNode }> = {
  INFO: { bar: "from-[#5865F2]/70 to-[#5865F2]/10", icon: <Info className="h-4 w-4 text-[#7383FF]" /> },
  SUCCESS: { bar: "from-[#3BA55C]/70 to-[#3BA55C]/10", icon: <CheckCircle2 className="h-4 w-4 text-[#3BA55C]" /> },
  WARNING: { bar: "from-amber-500/70 to-amber-500/10", icon: <TriangleAlert className="h-4 w-4 text-amber-400" /> },
  ERROR: { bar: "from-red-500/70 to-red-500/10", icon: <OctagonX className="h-4 w-4 text-red-400" /> },
  MAINTENANCE: { bar: "from-[#F0B232]/70 to-[#F0B232]/10", icon: <Wrench className="h-4 w-4 text-[#F0B232]" /> },
  ANNOUNCEMENT: { bar: "from-[#7383FF]/70 to-[#7383FF]/10", icon: <Megaphone className="h-4 w-4 text-[#7383FF]" /> },
};

/**
 * Mensagem global ativa (mais recente, dentro do agendamento, não
 * dispensada). Renderiza Markdown com links clicáveis + CTA opcional.
 * Se `dismissible`, mostra o X e salva a dispensa no servidor.
 */
export function GlobalMessageBanner() {
  const me = trpc.auth.me.useQuery().data;
  const banner = trpc.official.activeBanner.useQuery(undefined, {
    enabled: !!me,
  });
  const dismiss = trpc.official.dismiss.useMutation({
    onSuccess: () => {
      utils.official.activeBanner.invalidate();
      utils.official.list.invalidate();
    },
    onError: e => toast.error(e.message),
  });
  const trackClick = trpc.official.trackClick.useMutation();
  const utils = trpc.useUtils();
  const [closed, setClosed] = useState(false);
  const wsConnected = useAppStore(s => s.wsConnected);

  const message = banner.data;
  if (!me || !message || closed) return null;

  const style = TYPE_STYLES[message.type] ?? TYPE_STYLES.ANNOUNCEMENT;

  return (
    <div className="relative shrink-0 overflow-hidden border-b border-white/[0.06] bg-panel/60 select-none">
      <div className={cn("absolute inset-y-0 left-0 w-1 bg-gradient-to-b", style.bar)} />
      <div className="flex items-start gap-2.5 px-3 py-2 pl-4 sm:px-4">
        <span className="mt-0.5 shrink-0">{style.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-foreground">{message.title}</p>
          {message.contentFormat === "MARKDOWN" ? (
            <MarkdownRenderer content={message.content} className="mt-0.5 text-xs" />
          ) : (
            <p className="mt-0.5 whitespace-pre-wrap break-words text-xs leading-5 text-muted2">
              {message.content}
            </p>
          )}
          {message.buttonLabel && message.buttonUrl && (
            <a
              href={message.buttonUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                // Métrica de cliques (não bloqueia a navegação).
                trackClick.mutate({ announcementId: message.id });
              }}
              className="mt-2 inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[#5865F2] px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[#4752C4] active:scale-[0.98]"
            >
              {message.buttonLabel}
              <span aria-hidden>→</span>
            </a>
          )}
        </div>
        {message.dismissible && (
          <button
            onClick={() => {
              setClosed(true);
              dismiss.mutate({ announcementId: message.id });
            }}
            aria-label="Dispensar mensagem"
            title="Dispensar"
            className="shrink-0 rounded-lg p-1.5 text-muted2 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {!wsConnected && <span className="sr-only">Sem conexão</span>}
    </div>
  );
}
