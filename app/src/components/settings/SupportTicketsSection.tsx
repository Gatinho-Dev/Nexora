import { Loader2, AlertCircle, MessageSquare, Plus } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useState } from "react";

/** Espelha os enums `category` e `status` de schema.tickets no backend. */
type TicketCategory =
  | "account"
  | "moderation"
  | "report"
  | "bug"
  | "billing"
  | "security"
  | "ban";
type TicketStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_USER"
  | "RESOLVED"
  | "CLOSED";

const TICKET_CATEGORIES: { value: TicketCategory; label: string }[] = [
  { value: "report", label: "Geral" },
  { value: "bug", label: "Bug report" },
  { value: "account", label: "Conta" },
  { value: "security", label: "Segurança" },
  { value: "moderation", label: "Moderação" },
  { value: "ban", label: "Banimento" },
  { value: "billing", label: "Pagamento" },
];

const STATUS_STYLES: Record<TicketStatus, string> = {
  OPEN: "bg-emerald-500/20 text-emerald-300",
  IN_PROGRESS: "bg-amber-500/20 text-amber-300",
  WAITING_USER: "bg-sky-500/20 text-sky-300",
  RESOLVED: "bg-emerald-500/20 text-emerald-300",
  CLOSED: "bg-slate-500/20 text-slate-300",
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Aberto",
  IN_PROGRESS: "Em andamento",
  WAITING_USER: "Aguardando você",
  RESOLVED: "Resolvido",
  CLOSED: "Fechado",
};

export function SupportTicketsSection() {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<TicketCategory>("report");

  const tickets = trpc.advanced.support.myTickets.useQuery(undefined, {
    enabled: !!user,
  });

  const createTicket = trpc.advanced.support.createTicket.useMutation({
    onSuccess: () => {
      toast.success("Ticket criado com sucesso.");
      setSubject("");
      setMessage("");
      setShowForm(false);
      tickets.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Central de suporte</h2>
          <p className="mt-1 text-xs text-muted2">
            Acompanhe seus tickets ou crie um novo.
          </p>
        </div>
        <Button
          variant={showForm ? "secondary" : "default"}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? <MessageSquare className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
          {showForm ? "Cancelar" : "Novo ticket"}
        </Button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-white/[0.08] bg-sidebar p-5 space-y-4">
          <h3 className="font-bold">Novo ticket</h3>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TicketCategory)}
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
            >
              {TICKET_CATEGORIES.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Assunto</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Resuma o problema"
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              placeholder="Descreva o problema em detalhes..."
              maxLength={5000}
            />
          </div>
          <Button onClick={() => createTicket.mutate({ subject, message, category })} disabled={createTicket.isPending || !subject.trim() || !message.trim()}>
            {createTicket.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
            Enviar ticket
          </Button>
        </div>
      )}

      {tickets.isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-8 w-8 animate-spin text-[#7383FF]" />
        </div>
      ) : tickets.error ? (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-5 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-red-400" />
          <p className="mt-2 text-sm text-red-300">Erro ao carregar tickets.</p>
        </div>
      ) : tickets.data?.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center">
          <MessageSquare className="mx-auto h-10 w-10 text-muted2" />
          <p className="mt-2 text-xs text-muted2">Nenhum ticket aberto.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.data?.map((ticket) => (
            <div
              key={ticket.id}
              className="rounded-xl border border-white/10 bg-sidebar/50 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-bold text-white">{ticket.subject}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        STATUS_STYLES[ticket.status] ?? "bg-slate-500/20 text-slate-300"
                      }`}
                    >
                      {STATUS_LABELS[ticket.status] ?? ticket.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted2 line-clamp-2">
                    {TICKET_CATEGORIES.find(c => c.value === ticket.category)?.label ?? ticket.category}
                  </p>
                  <p className="mt-1 text-[10px] text-muted2">
                    {new Date(ticket.createdAt).toLocaleString("pt-BR")}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}