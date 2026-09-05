import { useState } from "react";
import { ArrowLeft, LifeBuoy, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const statuses = ["OPEN", "IN_PROGRESS", "WAITING_USER", "RESOLVED", "CLOSED"] as const;
const priorities = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

export function SupportQueueSection() {
  const me = trpc.auth.me.useQuery().data;
  const [filter, setFilter] = useState<(typeof statuses)[number] | "ALL">("ALL");
  const queue = trpc.advanced.support.ticketQueue.useQuery(filter === "ALL" ? {} : { status: filter });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const details = trpc.advanced.support.ticket.useQuery({ id: selectedId ?? 0 }, { enabled: selectedId != null });
  const [reply, setReply] = useState("");
  const update = trpc.advanced.support.updateTicket.useMutation({
    onSuccess: () => { void queue.refetch(); void details.refetch(); toast.success("Ticket atualizado."); },
    onError: error => toast.error(error.message),
  });
  const send = trpc.advanced.support.replyTicket.useMutation({
    onSuccess: () => { setReply(""); void details.refetch(); void queue.refetch(); },
    onError: error => toast.error(error.message),
  });

  if (selectedId != null) return <div className="space-y-4">
    <div className="flex items-center gap-3"><Button size="icon-sm" variant="ghost" onClick={() => setSelectedId(null)}><ArrowLeft className="size-4" /></Button><div><h3 className="text-sm font-bold text-white">{details.data ? `Ticket #${details.data.ticket.id} · ${details.data.ticket.subject}` : "Carregando"}</h3><p className="text-[10px] text-[#858c96]">Atendimento interno com histórico completo</p></div></div>
    {details.isLoading ? <div className="grid min-h-64 place-items-center"><Loader2 className="size-6 animate-spin" /></div> : details.data && <>
      <div className="grid gap-2 sm:grid-cols-3"><Select value={details.data.ticket.status} onValueChange={status => update.mutate({ id: selectedId, status: status as typeof statuses[number], priority: details.data!.ticket.priority, assigneeUserId: details.data!.ticket.assigneeUserId })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statuses.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select><Select value={details.data.ticket.priority} onValueChange={priority => update.mutate({ id: selectedId, status: details.data!.ticket.status, priority: priority as typeof priorities[number], assigneeUserId: details.data!.ticket.assigneeUserId })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{priorities.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select><Button variant="secondary" disabled={!me || details.data.ticket.assigneeUserId === me?.id} onClick={() => me && update.mutate({ id: selectedId, status: "IN_PROGRESS", priority: details.data!.ticket.priority, assigneeUserId: me.id })}>Assumir atendimento</Button></div>
      <div className="max-h-96 space-y-2 overflow-y-auto rounded-xl border border-white/[0.06] bg-[#17191e] p-3">{details.data.messages.map(message => <div key={message.id} className={cn("max-w-[85%] rounded-lg px-3 py-2 text-xs leading-5", message.authorUserId === details.data!.ticket.requesterUserId ? "bg-white/[0.06] text-[#d8dbe1]" : "ml-auto bg-[#4654d8]/25 text-white")}><p className="whitespace-pre-wrap">{message.content}</p><p className="mt-1 text-[9px] text-[#858c96]">{new Date(message.createdAt).toLocaleString("pt-BR")}</p></div>)}</div>
      {!statuses.slice(3).includes(details.data.ticket.status as "RESOLVED" | "CLOSED") && <div className="flex gap-2"><Textarea value={reply} onChange={event => setReply(event.target.value)} rows={3} placeholder="Responder ao usuário" /><Button disabled={!reply.trim() || send.isPending} onClick={() => send.mutate({ ticketId: selectedId, message: reply.trim(), attachmentIds: [] })}><Send className="size-4" /></Button></div>}
    </>}
  </div>;

  return <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 text-sm font-bold text-white"><LifeBuoy className="size-4 text-[#8290ff]" />Fila de suporte</h3><p className="mt-1 text-[10px] text-[#858c96]">Tickets de conta, segurança, cobrança e bugs.</p></div><Select value={filter} onValueChange={value => setFilter(value as typeof filter)}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Todos os status</SelectItem>{statuses.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>{queue.isLoading ? <div className="grid min-h-64 place-items-center"><Loader2 className="size-6 animate-spin" /></div> : queue.data?.length ? <div className="space-y-2">{queue.data.map(ticket => <button key={ticket.id} type="button" onClick={() => setSelectedId(ticket.id)} className="flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-[#1c1e23] p-3 text-left hover:bg-white/[0.04]"><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-white">#{ticket.id} · {ticket.subject}</p><p className="mt-1 text-[10px] text-[#858c96]">{ticket.category} · solicitante {ticket.requesterUserId} · {new Date(ticket.updatedAt).toLocaleString("pt-BR")}</p></div><span className="rounded bg-white/[0.06] px-2 py-1 text-[9px] font-bold text-[#b8bec8]">{ticket.status}</span><span className={cn("rounded px-2 py-1 text-[9px] font-bold", ticket.priority === "URGENT" ? "bg-red-500/15 text-red-300" : "bg-[#4654d8]/15 text-[#aab2ff]")}>{ticket.priority}</span></button>)}</div> : <p className="rounded-xl border border-white/[0.055] bg-[#191b20] py-12 text-center text-xs text-[#858c96]">Nenhum ticket nesta fila.</p>}</div>;
}
