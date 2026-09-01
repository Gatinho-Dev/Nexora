import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Compass, Search } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { groupDisplayName } from "@/lib/groupDisplayName";
import { Avatar } from "@/components/Avatar";
import { GroupAvatar } from "@/components/groups/GroupAvatar";

type SearchScope = "all" | "people" | "servers";

function parseQuery(value: string): { scope: SearchScope; query: string } {
  const trimmed = value.trimStart();
  if (trimmed.startsWith("@")) {
    return { scope: "people", query: trimmed.slice(1).trim() };
  }
  if (trimmed.startsWith("!")) {
    return { scope: "servers", query: trimmed.slice(1).trim() };
  }
  return { scope: "all", query: trimmed.trim() };
}

export function QuickSwitcherModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const servers = trpc.server.list.useQuery(undefined, { enabled: open });
  const dms = trpc.dm.list.useQuery(undefined, { enabled: open });
  const parsed = parseQuery(query);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange]);

  const filteredDMs = useMemo(() => {
    if (parsed.scope === "servers") return [];
    const term = parsed.query.toLocaleLowerCase("pt-BR");
    return (dms.data ?? [])
      .filter(conversation => !conversation.isRequest)
      .filter(conversation => {
        const name = conversation.isGroup
          ? groupDisplayName(conversation)
          : (conversation.friendNickname ??
            conversation.otherUser?.name ??
            conversation.otherUser?.username ??
            "");
        return name.toLocaleLowerCase("pt-BR").includes(term);
      });
  }, [dms.data, parsed.query, parsed.scope]);

  const filteredServers = useMemo(() => {
    if (parsed.scope === "people") return [];
    const term = parsed.query.toLocaleLowerCase("pt-BR");
    return (servers.data ?? []).filter(server =>
      server.name.toLocaleLowerCase("pt-BR").includes(term),
    );
  }, [parsed.query, parsed.scope, servers.data]);

  const go = (path: string) => {
    navigate(path);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen) setQuery("");
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="gap-0 overflow-hidden rounded-2xl border-border bg-panel p-0 text-foreground shadow-2xl sm:max-w-[680px]">
        <DialogTitle className="sr-only">Busca rápida do Nexora</DialogTitle>
        <div className="p-4 pb-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
            <input
              autoFocus
              className="h-16 w-full rounded-xl border border-border bg-input pl-12 pr-4 text-base font-medium text-foreground outline-none placeholder:text-muted2 focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Aonde você gostaria de ir?"
              value={query}
              onChange={event => setQuery(event.target.value)}
              aria-label="Buscar conversas e comunidades"
            />
          </label>
        </div>

        <div className="max-h-[430px] min-h-72 overflow-y-auto px-3 pb-3">
          {filteredDMs.length > 0 && (
            <section aria-label="Conversas recentes">
              <p className="px-2 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-wide text-faint">
                Conversas recentes
              </p>
              {filteredDMs.slice(0, 10).map(conversation => {
                const name = conversation.isGroup
                  ? groupDisplayName(conversation)
                  : (conversation.friendNickname ??
                    conversation.otherUser?.name ??
                    conversation.otherUser?.username ??
                    "Conversa");
                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => go(`/channels/@me/${conversation.id}`)}
                    className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-hov focus:bg-hov"
                  >
                    {conversation.isGroup ? (
                      <GroupAvatar
                        users={conversation.members}
                        src={conversation.avatarUrl}
                        name={name}
                        size="sm"
                      />
                    ) : (
                      <Avatar
                        userId={conversation.otherUser?.id}
                        name={name}
                        src={conversation.otherUser?.avatar}
                        size="sm"
                        showStatus
                        statusOverride={conversation.otherUser?.status}
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {name}
                      </span>
                      <span className="block truncate text-[11px] text-muted2">
                        {conversation.isGroup
                          ? `${conversation.memberCount ?? conversation.members.length} participantes`
                          : `@${conversation.otherUser?.username ?? "usuário"}`}
                      </span>
                    </span>
                  </button>
                );
              })}
            </section>
          )}

          {filteredServers.length > 0 && (
            <section aria-label="Comunidades">
              <p className="px-2 pb-1.5 pt-3 text-[10px] font-bold uppercase tracking-wide text-faint">
                Comunidades
              </p>
              {filteredServers.slice(0, 10).map(server => (
                <button
                  key={server.id}
                  type="button"
                  onClick={() => go(`/channels/${server.id}/first`)}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-hov focus:bg-hov"
                >
                  {server.iconUrl ? (
                    <img
                      src={server.iconUrl}
                      alt=""
                      className="h-8 w-8 rounded-xl object-cover"
                    />
                  ) : (
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/15 text-primary">
                      <Compass className="h-4 w-4" />
                    </span>
                  )}
                  <span className="truncate text-sm font-semibold">
                    {server.name}
                  </span>
                </button>
              ))}
            </section>
          )}

          {!servers.isLoading &&
            !dms.isLoading &&
            filteredDMs.length === 0 &&
            filteredServers.length === 0 && (
              <div className="flex min-h-64 flex-col items-center justify-center gap-2 px-6 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Search className="h-5 w-5" />
                </span>
                <p className="text-sm font-bold">Nenhum resultado</p>
                <p className="text-xs text-muted2">
                  Tente outro nome ou remova o filtro da busca.
                </p>
              </div>
            )}
        </div>

        <footer className="border-t border-border bg-chat/45 px-4 py-2.5 text-[10px] text-muted2">
          <span className="font-bold text-primary">Dica:</span> use
          <kbd className="mx-1 rounded bg-hov px-1.5 py-0.5 text-foreground">@</kbd>
          para conversas e
          <kbd className="mx-1 rounded bg-hov px-1.5 py-0.5 text-foreground">!</kbd>
          para comunidades.
        </footer>
      </DialogContent>
    </Dialog>
  );
}
