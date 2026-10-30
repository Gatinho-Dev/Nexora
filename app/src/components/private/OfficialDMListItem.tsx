import { useNavigate } from "react-router";
import { cn } from "@/lib/utils";
import { NexoraAppIcon } from "@/components/NexoraBrand";
import { IconOfficial } from "@/components/icons/figmaChannelIcons";
import { UnreadIndicator } from "@/components/private/UnreadIndicator";

/**
 * Os comunicados oficiais da Nexora aparecem na lista de mensagens diretas,
 * como uma conversa da própria plataforma.
 *
 * O componente é apresentacional: quem decide a posição na lista é a sidebar,
 * via `buildPrivateInboxEntries` — assim a conversa oficial desce sozinha
 * conforme você conversa com outras pessoas e sobe quando chega aviso novo,
 * do mesmo jeito que no Discord.
 *
 * Não pode ser dispensada, fixada nem silenciada: é o canal de avisos de
 * segurança da plataforma.
 */
export function OfficialDMListItem({
  active,
  unread,
  preview,
}: {
  active: boolean;
  unread: number;
  preview: string;
}) {
  const navigate = useNavigate();

  return (
    <div
      className={cn(
        "group relative mb-1 flex min-h-12 w-full items-center rounded-lg pr-1 text-left transition-colors duration-150",
        active
          ? "bg-act text-foreground"
          : unread > 0
            ? "bg-white/[0.035] text-foreground hover:bg-hov"
            : "text-muted2 hover:bg-hov hover:text-bodyx"
      )}
      data-unread={unread > 0 ? "true" : "false"}
      data-selected={active ? "true" : "false"}
      data-testid="official-dm-item"
    >
      <UnreadIndicator visible={unread > 0} className="self-stretch" />

      <button
        type="button"
        onClick={() => navigate("/channels/@me/official")}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md py-1.5 pl-1 focus-visible:outline-none"
        aria-current={active ? "page" : undefined}
        aria-label={
          unread > 0
            ? `${unread} ${unread === 1 ? "comunicado não lido" : "comunicados não lidos"}. Abrir comunicados oficiais da Nexora`
            : "Abrir comunicados oficiais da Nexora"
        }
      >
        <span className="relative shrink-0">
          <NexoraAppIcon className="h-8 w-8" />
          <span
            className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-[hsl(var(--sidebar-bg))] bg-[#5865F2] text-white"
            aria-hidden="true"
          >
            <IconOfficial className="h-2.5 w-2.5 text-white" />
          </span>
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "flex min-w-0 items-center gap-1.5 truncate text-[13px] leading-4",
              unread > 0 ? "font-bold text-foreground" : "font-semibold"
            )}
          >
            <span className="truncate">Nexora</span>
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-[4px] bg-[#5865F2] px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.08em] text-white"
              aria-label="Conta oficial e verificada da Nexora"
            >
              <IconOfficial className="h-2.5 w-2.5" aria-hidden="true" />
              Oficial
            </span>
          </span>
          <span
            className={cn(
              "mt-0.5 block truncate text-[11px] leading-3.5",
              unread > 0 ? "text-bodyx" : "text-faint"
            )}
            title={preview}
          >
            {preview}
          </span>
        </span>
      </button>

      {unread > 0 && (
        <span className="ml-1 flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-[var(--mention-badge)] px-1 text-[10px] font-bold text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </div>
  );
}
