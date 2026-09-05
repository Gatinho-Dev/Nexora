import { useMemo, useState } from "react";
import { Hash, Loader2, Search, Send, Server, Users } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { groupDisplayName } from "@/lib/groupDisplayName";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function ForwardMessageDialog({
  messageId,
  open,
  onOpenChange,
}: {
  messageId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [serverId, setServerId] = useState<number | null>(null);
  const conversations = trpc.dm.list.useQuery(undefined, { enabled: open });
  const servers = trpc.server.list.useQuery(undefined, { enabled: open });
  const server = trpc.server.get.useQuery(
    { serverId: serverId! },
    { enabled: open && serverId != null },
  );
  const forward = trpc.advanced.messages.forward.useMutation({
    onSuccess: () => {
      toast.success("Mensagem encaminhada.");
      onOpenChange(false);
    },
    onError: error => toast.error(error.message),
  });
  const needle = query.trim().toLocaleLowerCase("pt-BR");
  const dms = useMemo(() => (conversations.data ?? []).filter(item => {
    const name = item.isGroup
      ? groupDisplayName(item)
      : item.otherUser?.name ?? item.otherUser?.username ?? "Conversa";
    return !needle || name.toLocaleLowerCase("pt-BR").includes(needle);
  }), [conversations.data, needle]);
  const serverRows = useMemo(() => (servers.data ?? []).filter(item =>
    !needle || item.name.toLocaleLowerCase("pt-BR").includes(needle)
  ), [servers.data, needle]);
  const channels = (server.data?.channels ?? []).filter(channel =>
    ["TEXT", "ANNOUNCEMENT", "FORUM", "MEDIA"].includes(channel.type) &&
    (!needle || channel.name.toLocaleLowerCase("pt-BR").includes(needle))
  );

  const send = (target: { channelId?: number; conversationId?: number }) =>
    forward.mutate({ messageId, ...target });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(680px,90dvh)] max-w-lg overflow-hidden border-white/10 bg-panel p-0 text-white sm:rounded-2xl">
        <DialogHeader className="border-b border-white/[0.07] px-5 pb-4 pt-5">
          <DialogTitle>Encaminhar mensagem</DialogTitle>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <Input value={query} onChange={event => setQuery(event.target.value)} autoFocus placeholder="Buscar conversa, servidor ou canal" className="pl-9" />
          </div>
        </DialogHeader>
        <div className="max-h-[55dvh] overflow-y-auto p-2">
          {serverId != null && (
            <button type="button" onClick={() => setServerId(null)} className="mb-2 min-h-10 w-full rounded-lg px-3 text-left text-xs font-semibold text-[#aab2ff] hover:bg-white/[0.05]">← Todos os destinos</button>
          )}
          {serverId == null ? (
            <>
              <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-faint">Conversas</p>
              {dms.map(item => {
                const name = item.isGroup ? groupDisplayName(item) : item.otherUser?.name ?? item.otherUser?.username ?? "Conversa";
                return (
                  <button key={`dm-${item.id}`} type="button" disabled={forward.isPending} onClick={() => send({ conversationId: item.id })} className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left hover:bg-white/[0.06] disabled:opacity-50">
                    <span className="grid size-8 place-items-center rounded-xl bg-white/[0.06] text-muted2"><Users className="size-4" /></span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{name}</span>
                    <Send className="size-4 text-faint" />
                  </button>
                );
              })}
              <p className="px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-faint">Servidores</p>
              {serverRows.map(item => (
                <button key={`server-${item.id}`} type="button" onClick={() => setServerId(item.id)} className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left hover:bg-white/[0.06]">
                  <span className="grid size-8 place-items-center rounded-xl bg-[#4654d8]/15 text-[#8290ff]"><Server className="size-4" /></span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{item.name}</span>
                  <span className="text-xs text-faint">Escolher canal →</span>
                </button>
              ))}
            </>
          ) : server.isLoading ? (
            <div className="grid min-h-40 place-items-center"><Loader2 className="size-5 animate-spin text-[#8290ff]" /></div>
          ) : channels.length ? channels.map(channel => (
            <button key={channel.id} type="button" disabled={forward.isPending} onClick={() => send({ channelId: channel.id })} className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left hover:bg-white/[0.06] disabled:opacity-50">
              <Hash className="size-4 text-faint" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{channel.name}</span>
              <Send className="size-4 text-faint" />
            </button>
          )) : <p className="p-8 text-center text-xs text-muted2">Nenhum canal disponível.</p>}
          {!conversations.isLoading && !servers.isLoading && serverId == null && dms.length === 0 && serverRows.length === 0 && (
            <p className="p-8 text-center text-xs text-muted2">Nenhum destino encontrado.</p>
          )}
        </div>
        <div className="border-t border-white/[0.07] px-5 py-3 text-[10px] leading-4 text-faint">
          O encaminhamento mostra uma prévia imutável. A origem só abre para quem já possui permissão.
        </div>
      </DialogContent>
    </Dialog>
  );
}
