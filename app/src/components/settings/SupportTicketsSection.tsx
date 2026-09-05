import { useRef, useState } from "react";
import { ArrowLeft, LifeBuoy, Loader2, Paperclip, Plus, Send, TicketCheck, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { apiUrl } from "@/lib/endpoints";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Attachment = { id: number; filename: string };
const CATEGORY_LABELS: Record<string, string> = { account: "Conta", moderation: "Moderação", report: "Denúncia", bug: "Bug", billing: "Cobrança", security: "Segurança", ban: "Banimento" };
const STATUS_LABELS: Record<string, string> = { OPEN: "Aberto", IN_PROGRESS: "Em atendimento", WAITING_USER: "Aguardando você", RESOLVED: "Resolvido", CLOSED: "Fechado" };

export function SupportTicketsSection() {
  const me = trpc.auth.me.useQuery().data;
  const tickets = trpc.advanced.support.myTickets.useQuery();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const ticket = trpc.advanced.support.ticket.useQuery({ id: selectedId ?? 0 }, { enabled: selectedId != null });
  const [createOpen, setCreateOpen] = useState(false);
  const [category, setCategory] = useState<"account" | "moderation" | "report" | "bug" | "billing" | "security" | "ban">("account");
  const [priority, setPriority] = useState<"LOW" | "NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const create = trpc.advanced.support.createTicket.useMutation({
    onSuccess: result => {
      toast.success(`Ticket #${result.id} criado.`);
      setCreateOpen(false); setSubject(""); setMessage(""); setAttachments([]); setSelectedId(result.id);
      void tickets.refetch();
    },
    onError: error => toast.error(error.message),
  });
  const sendReply = trpc.advanced.support.replyTicket.useMutation({
    onSuccess: () => { setReply(""); setAttachments([]); void ticket.refetch(); void tickets.refetch(); },
    onError: error => toast.error(error.message),
  });

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData(); form.append("file", file);
      const response = await fetch(apiUrl("/api/upload"), { method: "POST", body: form, credentials: "include" });
      const data = await response.json() as { id?: number; filename?: string; error?: string };
      if (!response.ok || !data.id) throw new Error(data.error || "Falha no upload.");
      setAttachments(current => [...current, { id: data.id!, filename: data.filename || file.name }].slice(0, 10));
    } catch (error) { toast.error(error instanceof Error ? error.message : "Falha no upload."); }
    finally { setUploading(false); if (fileInput.current) fileInput.current.value = ""; }
  };

  if (selectedId != null) {
    const closed = ticket.data ? ["RESOLVED", "CLOSED"].includes(ticket.data.ticket.status) : false;
    return <div className="flex min-h-[520px] flex-col">
      <div className="mb-4 flex items-center gap-3"><Button size="icon-sm" variant="ghost" onClick={() => setSelectedId(null)} aria-label="Voltar aos tickets"><ArrowLeft className="size-4" /></Button><div className="min-w-0"><h2 className="truncate text-lg font-bold text-white">{ticket.data ? `#${ticket.data.ticket.id} · ${ticket.data.ticket.subject}` : "Carregando ticket"}</h2>{ticket.data && <p className="text-[11px] text-muted2">{STATUS_LABELS[ticket.data.ticket.status]} · {CATEGORY_LABELS[ticket.data.ticket.category]}</p>}</div></div>
      {ticket.isLoading ? <div className="grid flex-1 place-items-center"><Loader2 className="size-6 animate-spin text-[#8290ff]" /></div> : ticket.data ? <>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl border border-white/[0.07] bg-black/10 p-3">
          {ticket.data.messages.map(item => <article key={item.id} className={cn("max-w-[86%] rounded-xl px-3 py-2", item.authorUserId === me?.id ? "ml-auto bg-[#4654d8]/25" : "bg-white/[0.06]")}><p className="whitespace-pre-wrap text-sm leading-5 text-bodyx">{item.content}</p><p className="mt-1 text-[9px] text-faint">{item.authorUserId === me?.id ? "Você" : "Equipe Nexora"} · {new Date(item.createdAt).toLocaleString("pt-BR")}</p>{item.attachmentIds?.length ? <p className="mt-1 text-[10px] text-[#aab2ff]">{item.attachmentIds.length} anexo(s)</p> : null}</article>)}
        </div>
        {!closed ? <div className="mt-3 space-y-2"><Textarea value={reply} onChange={event => setReply(event.target.value)} rows={3} maxLength={5000} placeholder="Responder ao atendimento" /><div className="flex items-center justify-between"><AttachmentControls attachments={attachments} uploading={uploading} inputRef={fileInput} onUpload={upload} onRemove={id => setAttachments(current => current.filter(item => item.id !== id))} /><Button disabled={!reply.trim() || sendReply.isPending} onClick={() => sendReply.mutate({ ticketId: selectedId, message: reply.trim(), attachmentIds: attachments.map(item => item.id) })}><Send className="mr-2 size-4" />Enviar</Button></div></div> : <p className="mt-3 rounded-lg bg-emerald-500/10 p-3 text-center text-xs text-emerald-200">Este atendimento foi encerrado.</p>}
      </> : <p className="text-sm text-red-300">Não foi possível carregar o ticket.</p>}
    </div>;
  }

  return <div className="space-y-5">
    <div className="flex items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-xl font-bold text-white"><LifeBuoy className="size-5 text-[#8290ff]" />Suporte Nexora</h2><p className="mt-1 text-xs text-muted2">Abra e acompanhe seus atendimentos internos.</p></div><Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 size-4" />Novo ticket</Button></div>
    {tickets.isLoading ? <div className="grid min-h-72 place-items-center"><Loader2 className="size-6 animate-spin text-[#8290ff]" /></div> : tickets.data?.length ? <div className="space-y-2">{tickets.data.map(item => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-sidebar p-3 text-left hover:bg-white/[0.04]"><TicketCheck className="size-5 shrink-0 text-[#8290ff]" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">#{item.id} · {item.subject}</p><p className="mt-1 text-[10px] text-muted2">{CATEGORY_LABELS[item.category]} · {STATUS_LABELS[item.status]} · {new Date(item.updatedAt).toLocaleString("pt-BR")}</p></div><span className={cn("rounded-full px-2 py-1 text-[9px] font-bold", item.status === "WAITING_USER" ? "bg-amber-500/15 text-amber-200" : item.status === "RESOLVED" || item.status === "CLOSED" ? "bg-emerald-500/15 text-emerald-200" : "bg-[#4654d8]/15 text-[#aab2ff]")}>{STATUS_LABELS[item.status]}</span></button>)}</div> : <div className="grid min-h-72 place-items-center rounded-xl border border-dashed border-white/10 text-center"><div><LifeBuoy className="mx-auto size-10 text-faint" /><p className="mt-3 text-sm font-bold">Nenhum ticket aberto</p><p className="mt-1 text-xs text-muted2">Crie um atendimento quando precisar de ajuda.</p></div></div>}
    <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto border-white/10 bg-panel text-white sm:max-w-lg"><DialogHeader><DialogTitle>Novo ticket</DialogTitle></DialogHeader><div className="grid gap-3 sm:grid-cols-2"><Select value={category} onValueChange={value => setCategory(value as typeof category)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><Select value={priority} onValueChange={value => setPriority(value as typeof priority)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="LOW">Baixa</SelectItem><SelectItem value="NORMAL">Normal</SelectItem><SelectItem value="HIGH">Alta</SelectItem><SelectItem value="URGENT">Urgente</SelectItem></SelectContent></Select></div><Input value={subject} onChange={event => setSubject(event.target.value)} maxLength={160} placeholder="Assunto" /><Textarea value={message} onChange={event => setMessage(event.target.value)} maxLength={5000} rows={7} placeholder="Explique como podemos ajudar." /><AttachmentControls attachments={attachments} uploading={uploading} inputRef={fileInput} onUpload={upload} onRemove={id => setAttachments(current => current.filter(item => item.id !== id))} /><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancelar</Button><Button disabled={subject.trim().length < 3 || !message.trim() || create.isPending} onClick={() => create.mutate({ category, priority, subject: subject.trim(), message: message.trim(), attachmentIds: attachments.map(item => item.id) })}>{create.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}Criar ticket</Button></div></DialogContent></Dialog>
  </div>;
}

function AttachmentControls({ attachments, uploading, inputRef, onUpload, onRemove }: { attachments: Attachment[]; uploading: boolean; inputRef: React.RefObject<HTMLInputElement | null>; onUpload: (file: File) => void; onRemove: (id: number) => void }) {
  return <div className="min-w-0"><input ref={inputRef} className="hidden" type="file" onChange={event => event.target.files?.[0] && onUpload(event.target.files[0])} /><div className="flex flex-wrap items-center gap-1"><Button type="button" variant="ghost" size="sm" disabled={uploading || attachments.length >= 10} onClick={() => inputRef.current?.click()}>{uploading ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Paperclip className="mr-1 size-3" />}Anexar</Button>{attachments.map(item => <span key={item.id} className="inline-flex max-w-40 items-center gap-1 rounded-full bg-white/[0.06] px-2 py-1 text-[10px]"><span className="truncate">{item.filename}</span><button type="button" onClick={() => onRemove(item.id)} aria-label={`Remover ${item.filename}`}><X className="size-3" /></button></span>)}</div></div>;
}
