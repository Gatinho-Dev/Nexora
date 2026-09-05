import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Loader2, ShieldAlert, StickyNote, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const OPEN_USER_ACTION_EVENT = "nexora:open-user-action";

type UserAction = "note" | "restrict" | "block" | "timeout" | "kick" | "ban";
type UserActionRequest = { action: UserAction; userId: number; serverId?: number };

const TIMEOUTS = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "10m": 10 * 60_000,
  "1h": 60 * 60_000,
  "1d": 24 * 60 * 60_000,
  "1w": 7 * 24 * 60 * 60_000,
} as const;

export function UserActionHost() {
  const [request, setRequest] = useState<UserActionRequest | null>(null);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [timeoutPreset, setTimeoutPreset] = useState<keyof typeof TIMEOUTS | "custom">("10m");
  const [customUntil, setCustomUntil] = useState("");
  const profile = trpc.advanced.profile.publicProfile.useQuery(
    { userId: request?.userId ?? 0 },
    { enabled: request != null },
  );
  const savedNote = trpc.advanced.profile.note.useQuery(
    { userId: request?.userId ?? 0 },
    { enabled: request?.action === "note" },
  );

  useEffect(() => {
    const open = (event: Event) => {
      const detail = (event as CustomEvent<UserActionRequest>).detail;
      setRequest(detail);
      setReason("");
      setTimeoutPreset("10m");
      setCustomUntil("");
    };
    window.addEventListener(OPEN_USER_ACTION_EVENT, open);
    return () => window.removeEventListener(OPEN_USER_ACTION_EVENT, open);
  }, []);

  useEffect(() => {
    if (request?.action === "note" && savedNote.data) setNote(savedNote.data.content ?? "");
  }, [request?.action, savedNote.data]);

  const done = (message: string) => {
    toast.success(message);
    setRequest(null);
  };
  const failed = (error: { message: string }) => toast.error(error.message || "Não foi possível concluir a ação.");
  const noteMutation = trpc.advanced.profile.setNote.useMutation({ onSuccess: () => { void savedNote.refetch(); done("Nota privada salva."); }, onError: failed });
  const restrict = trpc.advanced.security.setRestricted.useMutation({ onSuccess: () => done("Usuário restringido."), onError: failed });
  const block = trpc.advanced.security.setBlocked.useMutation({ onSuccess: () => done("Usuário bloqueado."), onError: failed });
  const timeout = trpc.server.timeoutMember.useMutation({ onSuccess: () => done("Timeout aplicado."), onError: failed });
  const kick = trpc.server.kick.useMutation({ onSuccess: () => done("Membro expulso."), onError: failed });
  const ban = trpc.server.ban.useMutation({ onSuccess: () => done("Membro banido."), onError: failed });
  const pending = noteMutation.isPending || restrict.isPending || block.isPending || timeout.isPending || kick.isPending || ban.isPending;
  const name = profile.data?.user.displayName ?? profile.data?.user.username ?? "usuário";
  const title = useMemo(() => ({
    note: "Nota privada",
    restrict: "Restringir usuário",
    block: "Bloquear usuário",
    timeout: "Aplicar timeout",
    kick: "Expulsar membro",
    ban: "Banir membro",
  })[request?.action ?? "note"], [request?.action]);

  const submit = () => {
    if (!request) return;
    if (request.action === "note") return noteMutation.mutate({ userId: request.userId, content: note });
    if (request.action === "restrict") return restrict.mutate({ userId: request.userId, restricted: true, filterMessages: true, muteCalls: true, muteNotifications: true, hidePresence: false });
    if (request.action === "block") return block.mutate({ userId: request.userId, blocked: true });
    if (!request.serverId) return toast.error("Abra o menu dentro de um servidor para moderar.");
    if (request.action === "timeout") {
      const until = timeoutPreset === "custom" ? new Date(customUntil) : new Date(Date.now() + TIMEOUTS[timeoutPreset]);
      if (Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) return toast.error("Escolha um término válido.");
      return timeout.mutate({ serverId: request.serverId, userId: request.userId, until: until.toISOString(), reason: reason.trim() || undefined });
    }
    if (request.action === "kick") return kick.mutate({ serverId: request.serverId, userId: request.userId, reason: reason.trim() || undefined });
    return ban.mutate({ serverId: request.serverId, userId: request.userId, reason: reason.trim() || undefined });
  };

  return (
    <Dialog open={request != null} onOpenChange={open => !open && setRequest(null)}>
      <DialogContent className="border-white/10 bg-panel text-white sm:max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2">{request?.action === "note" ? <StickyNote className="size-5 text-[#8290ff]" /> : request?.action === "timeout" ? <CalendarClock className="size-5 text-amber-300" /> : request?.action === "restrict" ? <ShieldAlert className="size-5 text-amber-300" /> : <UserMinus className="size-5 text-red-400" />}{title}</DialogTitle></DialogHeader>
        <p className="text-xs leading-5 text-muted2">Ação para <span className="font-semibold text-white">{name}</span>. As permissões e a hierarquia serão validadas novamente no servidor.</p>
        {request?.action === "note" ? (
          <><Textarea value={note} onChange={event => setNote(event.target.value)} rows={7} maxLength={2000} placeholder="Somente você poderá ver esta nota." /><p className="text-right text-[10px] text-faint">{note.length}/2000 · criptografada e sincronizada</p></>
        ) : (
          <>
            {request?.action === "timeout" && <><Select value={timeoutPreset} onValueChange={value => setTimeoutPreset(value as typeof timeoutPreset)}><SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1m">1 minuto</SelectItem><SelectItem value="5m">5 minutos</SelectItem><SelectItem value="10m">10 minutos</SelectItem><SelectItem value="1h">1 hora</SelectItem><SelectItem value="1d">1 dia</SelectItem><SelectItem value="1w">1 semana</SelectItem><SelectItem value="custom">Personalizado</SelectItem></SelectContent></Select>{timeoutPreset === "custom" && <Input type="datetime-local" value={customUntil} onChange={event => setCustomUntil(event.target.value)} aria-label="Fim do timeout" />}</>}
            {(request?.action === "timeout" || request?.action === "kick" || request?.action === "ban") && <Textarea value={reason} onChange={event => setReason(event.target.value)} rows={4} maxLength={500} placeholder="Motivo (opcional)" />}
            {request?.action === "block" && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-200">Este usuário não poderá enviar DM ou pedido de amizade. As mensagens dele em servidores compartilhados serão recolhidas.</p>}
            {request?.action === "restrict" && <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-100">Mensagens serão filtradas e chamadas e notificações ficarão silenciadas.</p>}
          </>
        )}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setRequest(null)}>Cancelar</Button><Button variant={request?.action === "block" || request?.action === "kick" || request?.action === "ban" ? "destructive" : "default"} disabled={pending} onClick={submit}>{pending && <Loader2 className="mr-2 size-4 animate-spin" />}{request?.action === "note" ? "Salvar" : "Confirmar"}</Button></div>
      </DialogContent>
    </Dialog>
  );
}
