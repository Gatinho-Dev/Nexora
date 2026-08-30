import { useMemo, useState } from "react";
import { Check, MessageSquarePlus, Search, Users } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function NewMessageDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [groupName, setGroupName] = useState("");
  const friends = trpc.friend.list.useQuery(undefined, { enabled: open });
  const accepted = useMemo(
    () =>
      (friends.data ?? []).filter(friend => friend.status === "ACCEPTED"),
    [friends.data],
  );
  const visible = accepted.filter(friend => {
    const haystack = `${friend.user.name ?? ""} ${friend.user.username ?? ""}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  const openDm = trpc.dm.open.useMutation({
    onSuccess: data => {
      onOpenChange(false);
      navigate(`/channels/@me/${data.conversationId}`);
    },
    onError: error => toast.error(error.message),
  });
  const createGroup = trpc.group.create.useMutation({
    onSuccess: data => {
      onOpenChange(false);
      navigate(`/channels/@me/${data.conversationId}`);
    },
    onError: error => toast.error(error.message),
  });

  const toggle = (userId: number) => {
    setSelected(current =>
      current.includes(userId)
        ? current.filter(id => id !== userId)
        : [...current, userId],
    );
  };

  const submit = () => {
    if (selected.length === 1) {
      openDm.mutate({ userId: selected[0] });
      return;
    }
    if (selected.length >= 2) {
      createGroup.mutate({
        memberIds: selected,
        name: groupName.trim() || undefined,
      });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        onOpenChange(next);
        if (!next) {
          setQuery("");
          setSelected([]);
          setGroupName("");
        }
      }}
    >
      <DialogContent className="gap-0 overflow-hidden border-white/10 bg-popover p-0 text-foreground sm:max-w-md">
        <DialogHeader className="gap-1 border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageSquarePlus className="h-4 w-4 text-primary" /> Nova mensagem
          </DialogTitle>
          <DialogDescription className="text-xs text-muted2">
            Escolha uma pessoa para uma DM ou várias para criar um grupo.
          </DialogDescription>
        </DialogHeader>

        <div className="border-b border-border p-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <Input
              autoFocus
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Buscar amigos"
              aria-label="Buscar amigos"
              className="h-10 pl-9"
            />
          </label>
        </div>

        <div className="max-h-[42dvh] min-h-56 overflow-y-auto p-2" role="listbox" aria-label="Amigos">
          {friends.isLoading ? (
            <div className="space-y-1" aria-label="Carregando amigos">
              {[1, 2, 3, 4].map(item => (
                <div key={item} className="flex animate-pulse items-center gap-3 rounded-lg px-2 py-2">
                  <div className="h-9 w-9 rounded-full bg-white/[0.07]" />
                  <div className="h-3 w-36 rounded bg-white/[0.07]" />
                </div>
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center gap-2 text-center text-muted2">
              <Users className="h-7 w-7 text-faint" />
              <p className="text-sm font-semibold text-bodyx">Nenhum amigo encontrado</p>
              <p className="max-w-60 text-xs">Adicione uma pessoa primeiro para iniciar uma conversa privada.</p>
            </div>
          ) : (
            visible.map(friend => {
              const checked = selected.includes(friend.user.id);
              return (
                <button
                  key={friend.friendshipId}
                  type="button"
                  role="option"
                  aria-selected={checked}
                  onClick={() => toggle(friend.user.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors",
                    checked ? "bg-primary/15 text-foreground" : "hover:bg-hov",
                  )}
                >
                  <Avatar
                    userId={friend.user.id}
                    name={friend.user.name ?? friend.user.username}
                    src={friend.user.avatar}
                    size="sm"
                    showStatus
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {friend.user.name ?? friend.user.username}
                    </span>
                    <span className="block truncate text-xs text-muted2">@{friend.user.username}</span>
                  </span>
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-md border",
                      checked
                        ? "border-primary bg-primary text-white"
                        : "border-border text-transparent",
                    )}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
                </button>
              );
            })
          )}
        </div>

        {selected.length >= 2 && (
          <div className="border-t border-border px-4 py-3">
            <label htmlFor="new-group-name" className="mb-1.5 block text-xs font-semibold text-muted2">
              Nome do grupo (opcional)
            </label>
            <Input
              id="new-group-name"
              value={groupName}
              onChange={event => setGroupName(event.target.value)}
              maxLength={100}
              placeholder="Nome do grupo"
            />
          </div>
        )}

        <DialogFooter className="border-t border-border px-4 py-3">
          <span className="mr-auto self-center text-xs text-muted2" aria-live="polite">
            {selected.length === 0
              ? "Ninguém selecionado"
              : `${selected.length} selecionado${selected.length === 1 ? "" : "s"}`}
          </span>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={submit}
            disabled={selected.length === 0 || openDm.isPending || createGroup.isPending}
          >
            {selected.length >= 2 ? "Criar grupo" : "Abrir conversa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
