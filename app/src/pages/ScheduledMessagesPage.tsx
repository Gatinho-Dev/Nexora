import { useState } from "react";
import { CalendarClock, Loader2, Pencil, Trash2 } from "lucide-react";
import { useOutletContext } from "react-router";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { DMSidebar } from "@/components/DMSidebar";
import { SidebarPortal } from "@/components/SidebarPortal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AppOutletContext } from "@/lib/appOutletContext";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../api/router";

type ScheduledRow = inferRouterOutputs<AppRouter>["advanced"]["messages"]["scheduled"][number];

function localInput(date: string | Date) {
  const value = new Date(date);
  return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function ScheduledMessagesPage() {
  const { onOpenProfile } = useOutletContext<AppOutletContext>();
  const scheduled = trpc.advanced.messages.scheduled.useQuery();
  const [editing, setEditing] = useState<ScheduledRow | null>(null);
  const [content, setContent] = useState("");
  const [when, setWhen] = useState("");
  const cancel = trpc.advanced.messages.cancelScheduled.useMutation({ onSuccess: () => { toast.success("Agendamento cancelado."); void scheduled.refetch(); }, onError: error => toast.error(error.message) });
  const update = trpc.advanced.messages.schedule.useMutation({ onSuccess: () => { toast.success("Agendamento atualizado."); setEditing(null); void scheduled.refetch(); }, onError: error => toast.error(error.message) });
  const startEdit = (row: ScheduledRow) => { setEditing(row); setContent(row.content); setWhen(localInput(row.scheduledFor)); };
  return <div className="flex min-h-0 flex-1"><SidebarPortal><DMSidebar onOpenProfile={onOpenProfile} /></SidebarPortal><main className="flex min-w-0 flex-1 flex-col bg-chat text-white"><header className="border-b border-white/[0.06] px-4 py-4 sm:px-7"><h1 className="flex items-center gap-2 text-base font-bold"><CalendarClock className="size-5 text-[#8290ff]" /> Mensagens agendadas</h1><p className="mt-1 text-xs text-muted2">O servidor envia no horário escolhido, mesmo com seus dispositivos offline.</p></header><section className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{scheduled.isLoading ? <div className="grid min-h-72 place-items-center"><Loader2 className="size-6 animate-spin text-[#8290ff]" /></div> : scheduled.data?.length ? <div className="mx-auto max-w-3xl space-y-2">{scheduled.data.map(row => <article key={row.id} className="rounded-2xl border border-white/[0.07] bg-sidebar p-4"><div className="flex items-start gap-3"><CalendarClock className="mt-0.5 size-5 text-[#8290ff]" /><div className="min-w-0 flex-1"><p className="whitespace-pre-wrap text-sm leading-6 text-bodyx">{row.content}</p><p className="mt-2 text-[10px] font-semibold text-muted2">{new Date(row.scheduledFor).toLocaleString("pt-BR")} · {row.timezone} · {row.state === "FAILED" ? "falhou, edite para tentar novamente" : row.state.toLowerCase()}</p>{row.failureReason && <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-[11px] text-red-300">{row.failureReason}</p>}</div><div className="flex gap-1"><Button size="icon-sm" variant="ghost" onClick={() => startEdit(row)} aria-label="Editar agendamento" title="Editar"><Pencil className="size-4" /></Button><Button size="icon-sm" variant="ghost" disabled={cancel.isPending} onClick={() => cancel.mutate({ id: row.id })} aria-label="Cancelar agendamento" title="Cancelar"><Trash2 className="size-4 text-red-400" /></Button></div></div></article>)}</div> : <div className="grid min-h-72 place-items-center text-center"><div><CalendarClock className="mx-auto size-10 text-faint" /><p className="mt-3 text-sm font-bold">Nenhuma mensagem agendada</p><p className="mt-1 text-xs text-muted2">Use o ícone de relógio ao lado do botão Enviar.</p></div></div>}</section></main>
    <Dialog open={editing != null} onOpenChange={open => !open && setEditing(null)}><DialogContent className="border-white/10 bg-panel text-white sm:max-w-md"><DialogHeader><DialogTitle>Editar mensagem agendada</DialogTitle></DialogHeader><Textarea value={content} onChange={event => setContent(event.target.value)} rows={6} maxLength={4000} /><Input type="datetime-local" value={when} onChange={event => setWhen(event.target.value)} /><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setEditing(null)}>Fechar</Button><Button disabled={!editing || !content.trim() || !when || update.isPending} onClick={() => editing && update.mutate({ id: editing.id, channelId: editing.channelId ?? undefined, conversationId: editing.conversationId ?? undefined, content: content.trim(), attachmentIds: editing.attachmentIds ?? [], scheduledFor: new Date(when).toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })}>Salvar</Button></div></DialogContent></Dialog>
  </div>;
}
