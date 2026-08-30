import { useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Link2, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/Avatar";

type Kind = "all" | "link" | "image" | "file";

const KINDS: Array<[Kind, string]> = [
  ["all", "Tudo"],
  ["link", "Links"],
  ["image", "Imagens"],
  ["file", "Arquivos"],
];

/**
 * Busca dentro do grupo (item 33): mensagens com filtros
 * de autor e tipo. Clique no resultado pula para a mensagem.
 */
export function GroupSearchModal({
  open,
  onOpenChange,
  conversationId,
  members,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversationId: number;
  members: Array<{ id: number; name: string | null; username: string | null; avatar?: string | null }>;
}) {
  const [query, setQuery] = useState("");
  const [fromUserId, setFromUserId] = useState<number | null>(null);
  const [kind, setKind] = useState<Kind>("all");

  const search = trpc.group.search.useQuery(
    {
      conversationId,
      query: query.trim() || undefined,
      fromUserId: fromUserId ?? undefined,
      kind,
      limit: 30,
    },
    { enabled: open && conversationId > 0 }
  );

  const results = useMemo(() => search.data?.messages ?? [], [search.data]);

  const jumpTo = (messageId: number) => {
    onOpenChange(false);
    setTimeout(() => {
      const el = document.getElementById(`msg-${messageId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.classList.add("bg-primary/10");
      setTimeout(() => el?.classList.remove("bg-primary/10"), 1500);
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80dvh] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" aria-hidden /> Buscar na conversa
          </DialogTitle>
        </DialogHeader>

        <div className="shrink-0 space-y-2">
          <Input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar mensagens..."
            aria-label="Buscar mensagens"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            {KINDS.map(([k, label]) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                className={cn(
                  "rounded-full px-3 py-1 text-[11px] font-bold transition-colors",
                  kind === k
                    ? "bg-primary/15 text-primary"
                    : "bg-secondary text-muted2 hover:text-bodyx"
                )}
              >
                {label}
              </button>
            ))}
            <select
              value={fromUserId ?? ""}
              onChange={e =>
                setFromUserId(e.target.value ? Number(e.target.value) : null)
              }
              aria-label="Filtrar por autor"
              className="ml-auto h-7 rounded-full border border-input bg-panel px-2 text-[11px] font-semibold text-bodyx"
            >
              <option value="">De: todos</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name ?? m.username ?? `#${m.id}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1" role="list" aria-label="Resultados da busca">
          {search.isFetching && (
            <p className="flex items-center justify-center gap-2 py-8 text-xs text-muted2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Buscando...
            </p>
          )}
          {!search.isFetching && results.length === 0 && (
            <p className="py-10 text-center text-xs text-muted2">
              Nenhuma mensagem encontrada.
            </p>
          )}
          <ul className="space-y-1">
            {results.map(m => (
              <li key={m.id} role="listitem">
                <button
                  onClick={() => jumpTo(m.id)}
                  className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/[0.05]"
                >
                  <Avatar
                    userId={m.author.id}
                    name={m.author.name ?? m.author.username}
                    src={m.author.avatar}
                    size="xs"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-bold text-bodyx">
                        {m.author.name ?? m.author.username ?? "Usuário"}
                      </span>
                      <span className="shrink-0 text-[10px] text-faint">
                        {new Date(m.createdAt).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </span>
                      {m.attachments.length > 0 && (
                        <Paperclip className="h-3 w-3 shrink-0 text-faint" aria-label="Com anexo" />
                      )}
                      {/\bhttps?:\/\//.test(m.content) && (
                        <Link2 className="h-3 w-3 shrink-0 text-faint" aria-label="Contém link" />
                      )}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-muted2">
                      {m.content || "(anexo)"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
