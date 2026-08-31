import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAppStore } from "@/store/useAppStore";
import { Plus, Compass, Volume2, X } from "lucide-react";
import { CreateServerModal } from "../modals/CreateServerModal";
import { JoinServerModal } from "../modals/JoinServerModal";
import { useState } from "react";
import { NexoraAppIcon } from "../NexoraBrand";
import { Avatar } from "../Avatar";
import { ServerBadge } from "../server/ServerBadge";
import {
  ServerContextMenu,
  type ServerMenuAction,
} from "../server/ServerContextMenu";
import {
  ServerActionModalHost,
  type ActiveServerMenuAction,
} from "../server/ServerActionModalHost";

/**
 * "Comunidades" layer: full-screen list of the user's servers with unread
 * counts. Tapping one enters it (deep navigation), keeping the desktop rail
 * untouched.
 */
export function ServersSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const servers = trpc.server.list.useQuery();
  const serverUnread = useAppStore(s => s.serverUnread);
  const serverMentions = useAppStore(s => s.serverMentions);
  const voiceSummaries = useAppStore(s => s.serverVoiceSummaries);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [activeAction, setActiveAction] =
    useState<ActiveServerMenuAction>(null);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-rail md:hidden">
      <div className="flex h-14 items-center justify-between border-b border-border px-4 pb-0 pt-[calc(env(safe-area-inset-top))]">
        <h1 className="flex items-center gap-2 text-base font-extrabold">
          <NexoraAppIcon className="h-6 w-6" decorative /> Comunidades
        </h1>
        <button onClick={onClose} aria-label="Fechar" className="rounded-full p-2 text-muted-foreground hover:bg-accent">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-[calc(env(safe-area-inset-bottom)+80px)]">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-faint">
          Suas comunidades
        </p>
        <p className="-mt-1 mb-3 text-xs text-muted-foreground">
          Toque e segure para abrir as ações do servidor.
        </p>
        <ul className="space-y-1">
          {servers.isLoading && (
            <>
              {[1, 2, 3].map(i => (
                <li key={i} className="flex items-center gap-3 rounded-xl p-3 animate-pulse select-none">
                  <div className="h-12 w-12 shrink-0 rounded-2xl bg-white/[0.06]" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3.5 w-36 rounded bg-white/[0.08]" />
                    <div className="h-3 w-24 rounded bg-white/[0.05]" />
                  </div>
                </li>
              ))}
            </>
          )}
          {servers.data?.map(sv => {
            const unread = serverUnread[sv.id] ?? 0;
            const mentions = serverMentions[sv.id] ?? 0;
            const voice = voiceSummaries[sv.id];
            const voiceCount = voice?.count ?? sv.activeVoiceCount ?? 0;
            const preview = voice?.preview ?? sv.voicePreviewMembers ?? [];
            return (
              <li key={sv.id}>
                <ServerContextMenu
                  server={sv}
                  onAction={(action: ServerMenuAction, server) =>
                    setActiveAction({ action, server })
                  }
                >
                  <button
                    onClick={() => {
                      onClose();
                      navigate(`/channels/${sv.id}/first`);
                    }}
                    aria-label={`${sv.name}${unread ? `, ${unread} não lidas` : ""}${mentions ? `, ${mentions} menções` : ""}${voiceCount ? `, ${voiceCount} em chamada` : ""}`}
                    className="flex min-h-[72px] w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7383FF]"
                  >
                    <span className="relative shrink-0">
                      {sv.iconUrl ? (
                        <img
                          src={sv.iconUrl}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-12 w-12 rounded-2xl object-cover"
                        />
                      ) : (
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-chat text-sm font-bold text-foreground">
                          {sv.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      {voiceCount > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-rail bg-[#4654D8] text-white">
                          <Volume2 className="h-2.5 w-2.5" aria-hidden />
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-1.5">
                        {sv.partnered && (
                          <ServerBadge
                            type="partner"
                            className="h-4 w-4 shrink-0"
                          />
                        )}
                        <span className="truncate text-sm font-bold">
                          {sv.name}
                        </span>
                      </span>
                      {voiceCount > 0 ? (
                        <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex -space-x-1.5" aria-hidden>
                            {preview.slice(0, 3).map(person => (
                              <Avatar
                                key={person.userId}
                                userId={person.userId}
                                name={person.name}
                                src={person.avatar}
                                size="xs"
                                showStatus={false}
                                className="ring-2 ring-rail"
                              />
                            ))}
                          </span>
                          <span>{voiceCount} em chamada</span>
                        </span>
                      ) : (
                        <span className="block truncate text-xs text-muted-foreground">
                          {unread > 0
                            ? `${unread} não lidas`
                            : sv.description || "Comunidade"}
                        </span>
                      )}
                    </span>
                    {mentions > 0 ? (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold text-white">
                        {mentions > 99 ? "99+" : mentions}
                      </span>
                    ) : unread > 0 ? (
                      <span
                        className="h-2.5 w-2.5 rounded-full bg-[#7383FF]"
                        aria-hidden
                      />
                    ) : null}
                  </button>
                </ServerContextMenu>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => setCreateOpen(true)}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#4654D8] text-sm font-bold text-white active:scale-[0.98] transition-transform"
          >
            <Plus className="h-4 w-4" /> Criar
          </button>
          <button
            onClick={() => setJoinOpen(true)}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-panel text-sm font-bold text-bodyx ring-1 ring-white/10 active:scale-[0.98] transition-transform"
          >
            <Compass className="h-4 w-4" /> Entrar
          </button>
        </div>
      </div>

      <CreateServerModal open={createOpen} onOpenChange={setCreateOpen} />
      <JoinServerModal open={joinOpen} onOpenChange={setJoinOpen} />
      <ServerActionModalHost
        activeAction={activeAction}
        onClose={() => setActiveAction(null)}
      />
    </div>
  );
}
