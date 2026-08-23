import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAppStore } from "@/store/useAppStore";
import { Plus, Compass, X } from "lucide-react";
import { CreateServerModal } from "../modals/CreateServerModal";
import { JoinServerModal } from "../modals/JoinServerModal";
import { useState } from "react";
import { NexoraAppIcon } from "../NexoraBrand";

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
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden bg-rail flex flex-col">
      <div className="flex h-14 items-center justify-between border-b border-black/20 px-4 pb-0 pt-[calc(env(safe-area-inset-top))]">
        <h1 className="flex items-center gap-2 text-base font-extrabold">
          <NexoraAppIcon className="h-6 w-6" decorative /> Comunidades
        </h1>
        <button onClick={onClose} aria-label="Fechar" className="rounded-full p-2 text-muted2 hover:bg-white/10">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-[calc(env(safe-area-inset-bottom)+80px)]">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-faint">
          Suas comunidades
        </p>
        <ul className="space-y-1">
          {servers.isLoading && (
            <li className="py-8 text-center text-xs text-muted2">Carregando...</li>
          )}
          {servers.data?.map(sv => {
            const unread = serverUnread[sv.id] ?? 0;
            return (
              <li key={sv.id}>
                <button
                  onClick={() => {
                    onClose();
                    navigate(`/channels/${sv.id}/first`);
                  }}
                  className="flex min-h-[64px] w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-hov"
                >
                  {sv.iconUrl ? (
                    <img src={sv.iconUrl} alt="" loading="lazy" className="h-12 w-12 rounded-2xl object-cover" />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-chat text-sm font-bold text-bodyx">
                      {sv.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{sv.name}</span>
                    <span className="block truncate text-xs text-faint">
                      {unread > 0 ? `${unread} não lidas` : sv.description || "Comunidade"}
                    </span>
                  </span>
                  {unread > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold text-white">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => setCreateOpen(true)}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#5865F2] text-sm font-bold text-white active:scale-[0.98] transition-transform"
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
    </div>
  );
}
