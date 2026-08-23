import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { Avatar } from "@/components/Avatar";
import { MessageItem } from "./chat/MessageItem";
import { MessageInput } from "./chat/MessageInput";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft, Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";

/**
 * Thread view: /channels/:serverId/:channelId/t/:threadId
 * Shows only messages bound to the thread, with archive controls for the
 * author or moderators.
 */
export function ThreadView({
  serverId,
  onOpenProfile,
}: {
  serverId: number;
  onOpenProfile?: (userId: number) => void;
}) {
  const params = useParams();
  const navigate = useNavigate();
  const channelId = Number(params.channelId);
  const threadId = Number(params.threadId);
  const me = trpc.auth.me.useQuery().data;
  const [archivedList, setArchivedList] = useState(false);

  const threadQuery = trpc.threads.list.useQuery({
    channelId,
    includeArchived: true,
  });
  const threads = threadQuery.data ?? [];
  const current = threads.find(t => t.id === threadId);

  const list = trpc.message.list.useQuery(
    { channelId, threadId, limit: 100 },
    { enabled: !!current }
  );

  const archive = trpc.threads.archive.useMutation({
    onSuccess: () => {
      toast.success(current?.archivedAt ? "Thread reaberta." : "Thread arquivada.");
      threadQuery.refetch();
    },
    onError: e => toast.error(e.message),
  });

  if (!threadQuery.isLoading && !current) {
    return (
      <div className="flex flex-1 items-center justify-center bg-chat text-sm text-muted2">
        Thread não encontrada ou arquivada.
      </div>
    );
  }

  const canArchive =
    current && (current.createdById === me?.id || !current.archivedAt);

  return (
    <div className="flex min-h-0 flex-1">
      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col bg-chat text-foreground">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-black/20 px-3 select-none shadow-sm">
          <button
            onClick={() => navigate(`/channels/${serverId}/${channelId}`)}
            className="rounded p-1 text-muted2 hover:bg-white/10 hover:text-foreground"
            title="Voltar ao canal"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span aria-hidden>🧵</span>
          <span className="truncate text-sm font-bold">{current?.name ?? "..."}</span>
          {current?.private && (
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-muted2">
              privada
            </span>
          )}
          {canArchive && (
            <Button
              size="sm"
              variant="ghost"
              disabled={archive.isPending}
              onClick={() => archive.mutate({ threadId, archived: !current?.archivedAt })}
              className="ml-auto text-xs text-muted2 hover:text-foreground"
            >
              {current?.archivedAt ? (
                <>
                  <ArchiveRestore className="mr-1 h-3.5 w-3.5" /> Reabrir
                </>
              ) : (
                <>
                  <Archive className="mr-1 h-3.5 w-3.5" /> Arquivar
                </>
              )}
            </Button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {list.isLoading ? (
            <p className="py-8 text-center text-xs text-muted2">Carregando...</p>
          ) : (list.data?.messages.length ?? 0) === 0 ? (
            <p className="py-10 text-center text-xs text-muted2">
              Comece a conversa desta thread.
            </p>
          ) : (
            <div className="space-y-0.5">
              {list.data!.messages.map(m => (
                <MessageItem
                  key={m.id}
                  message={m}
                  grouped={false}
                  myId={me?.id ?? 0}
                  canManageMessages={false}
                  onJumpTo={() => {}}
                  onOpenProfile={onOpenProfile}
                />
              ))}
            </div>
          )}
        </div>

        {!current?.archivedAt ? (
          <MessageInput
            channelId={channelId}
            threadId={threadId}
            placeholder={`Responder em 🧵 ${current?.name ?? ""}`}
          />
        ) : (
          <p className="shrink-0 border-t border-white/[0.06] py-4 text-center text-xs text-muted2">
            Esta thread está arquivada.
          </p>
        )}
      </div>

      {/* Threads sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-l border-black/20 bg-sidebar lg:flex">
        <div className="flex h-12 items-center justify-between border-b border-black/10 px-3">
          <button
            onClick={() => setArchivedList(a => !a)}
            className={cn("text-[11px] font-bold uppercase tracking-wider", archivedList ? "text-primary" : "text-faint")}
          >
            {archivedList ? "Arquivadas" : "Ativas"}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {threads
            .filter(t => (archivedList ? t.archivedAt : !t.archivedAt))
            .map(t => (
              <button
                key={t.id}
                onClick={() => navigate(`/channels/${serverId}/${channelId}/t/${t.id}`)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors",
                  t.id === threadId
                    ? "bg-act text-foreground font-semibold"
                    : "text-muted2 hover:bg-hov hover:text-bodyx",
                )}
              >
                <Avatar userId={t.createdById} name={"?"} src={null} size="xs" showStatus={false} />
                <span className="min-w-0 flex-1 truncate">
                  {t.name} {t.private && "🔒"}
                </span>
              </button>
            ))}
          {threads.length === 0 && (
            <p className="px-2 py-4 text-[11px] text-faint">Nenhuma thread ainda.</p>
          )}
        </div>
      </aside>
    </div>
  );
}
