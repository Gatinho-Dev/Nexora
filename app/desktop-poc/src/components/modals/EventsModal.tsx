import { useState } from "react";
import { trpc } from "@/providers/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarClock, Loader2, Plus, X } from "lucide-react";
import { IconHash, IconMegaphone } from "../icons/channelIcons";
import { toast } from "sonner";
import type { ServerDetailsDTO } from "@contracts/types";

export function EventsModal({
  open,
  onOpenChange,
  details,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  details: ServerDetailsDTO;
}) {
  const utils = trpc.useUtils();
  const canManage = details.myPermissions.includes("MANAGE_CHANNELS");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [channelId, setChannelId] = useState<string>("none");

  const eventsQuery = trpc.server.listEvents.useQuery(
    { serverId: details.server.id },
    { enabled: open }
  );

  const createEvent = trpc.server.createEvent.useMutation({
    onSuccess: () => {
      utils.server.listEvents.invalidate({ serverId: details.server.id });
      setName("");
      setDescription("");
      setStartsAt("");
      setChannelId("none");
      setCreating(false);
    },
    onError: e => toast.error(e.message),
  });

  const cancelEvent = trpc.server.cancelEvent.useMutation({
    onSuccess: () =>
      utils.server.listEvents.invalidate({ serverId: details.server.id }),
    onError: e => toast.error(e.message),
  });

  const submit = () => {
    if (!name.trim() || !startsAt) return;
    createEvent.mutate({
      serverId: details.server.id,
      name: name.trim(),
      description: description.trim() || undefined,
      startsAt: new Date(startsAt).toISOString(),
      channelId: channelId !== "none" ? Number(channelId) : undefined,
    });
  };

  const channelName = (id: number | null) =>
    id === null
      ? null
      : (details.channels.find(c => c.id === id)?.name ?? null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-chat border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-[#5865F2]" />
            Eventos de {details.server.name}
          </DialogTitle>
        </DialogHeader>

        {canManage && !creating && (
          <Button
            size="sm"
            onClick={() => setCreating(true)}
            className="w-fit bg-[#5865F2] hover:bg-[#4752C4] font-semibold"
          >
            <Plus className="mr-1 h-4 w-4" /> Criar evento
          </Button>
        )}

        {creating && (
          <form
            className="space-y-3 rounded-xl border border-white/10 bg-sidebar p-3"
            onSubmit={e => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="event-name">Nome do evento</Label>
              <Input
                id="event-name"
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex.: Noite de jogos"
                maxLength={120}
                required
                className="bg-[#383A40] border-transparent"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-desc">Descrição</Label>
              <textarea
                id="event-desc"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="O que vai acontecer no evento?"
                rows={2}
                maxLength={2000}
                className="w-full resize-none rounded-md bg-[#383A40] px-3 py-2 text-sm outline-none placeholder:text-faint"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="event-date">Início</Label>
                <Input
                  id="event-date"
                  type="datetime-local"
                  value={startsAt}
                  onChange={e => setStartsAt(e.target.value)}
                  required
                  className="bg-[#383A40] border-transparent text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Canal</Label>
                <Select value={channelId} onValueChange={setChannelId}>
                  <SelectTrigger className="bg-[#383A40] border-transparent text-sm">
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum canal</SelectItem>
                    {details.channels.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.type === "VOICE" || c.type === "STAGE"
                          ? c.name
                          : `#${c.name}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setCreating(false)}
                className="text-muted2 hover:text-white"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!name.trim() || !startsAt || createEvent.isPending}
                className="bg-[#5865F2] hover:bg-[#4752C4] font-semibold"
              >
                {createEvent.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Agendar"
                )}
              </Button>
            </div>
          </form>
        )}

        {/* Event list */}
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {eventsQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted2" />
            </div>
          ) : (eventsQuery.data?.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-xs text-muted2">
              Nenhum evento agendado ainda.
            </p>
          ) : (
            eventsQuery.data!.map(ev => {
              const chName = channelName(ev.channelId);
              const starts = new Date(ev.startsAt);
              return (
                <div
                  key={ev.id}
                  className="rounded-xl border border-white/[0.06] bg-sidebar p-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{ev.name}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted2">
                        <span className="text-emerald-400">
                          {starts.toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {chName && (
                          <span className="inline-flex items-center gap-1">
                            {details.channels.find(c => c.id === ev.channelId)
                              ?.type === "VOICE" ||
                            details.channels.find(c => c.id === ev.channelId)
                              ?.type === "STAGE" ? (
                              <IconMegaphone className="h-3.5 w-3.5" />
                            ) : (
                              <IconHash className="h-3.5 w-3.5" />
                            )}
                            {chName}
                          </span>
                        )}
                      </p>
                      {ev.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-bodyx/80">
                          {ev.description}
                        </p>
                      )}
                    </div>
                    {canManage && (
                      <button
                        title="Cancelar evento"
                        aria-label={`Cancelar evento ${ev.name}`}
                        disabled={cancelEvent.isPending}
                        onClick={() => cancelEvent.mutate({ eventId: ev.id })}
                        className="rounded p-1 text-muted2 transition-colors hover:bg-red-500/10 hover:text-red-400"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
