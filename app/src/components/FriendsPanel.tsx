import { useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import { Check, MessageSquare, UserMinus, UserPlus, X, Ban, Undo2 } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { Avatar } from "./Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { FriendDTO } from "@contracts/types";

type Tab = "all" | "online" | "pending" | "blocked" | "add";

export function FriendsPanel() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("all");
  const friends = trpc.friend.list.useQuery();
  const presence = useAppStore((s) => s.presence);
  const utils = trpc.useUtils();

  const invalidate = () => friends.refetch();

  const accept = trpc.friend.accept.useMutation({ onSuccess: invalidate, onError: (e) => toast.error(e.message) });
  const decline = trpc.friend.decline.useMutation({ onSuccess: invalidate, onError: (e) => toast.error(e.message) });
  const cancel = trpc.friend.cancel.useMutation({ onSuccess: invalidate, onError: (e) => toast.error(e.message) });
  const remove = trpc.friend.remove.useMutation({
    onSuccess: () => {
      toast.success("Amizade removida.");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const unblock = trpc.friend.unblock.useMutation({ onSuccess: invalidate, onError: (e) => toast.error(e.message) });
  const openDm = trpc.dm.open.useMutation({
    onSuccess: (conv) => navigate(`/channels/@me/${conv.id}`),
    onError: (e) => toast.error(e.message),
  });

  const all = friends.data ?? [];
  const accepted = all.filter((f) => f.status === "ACCEPTED");
  const online = accepted.filter((f) => (presence[f.user.id] ?? f.user.status) !== "offline");
  const pending = all.filter((f) => f.status === "PENDING");
  const blocked = all.filter((f) => f.status === "BLOCKED");
  const pendingIncoming = pending.filter((f) => f.direction === "incoming").length;

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "all", label: "Todos" },
    { id: "online", label: "Online" },
    { id: "pending", label: "Pendentes", badge: pendingIncoming },
    { id: "blocked", label: "Bloqueados" },
    { id: "add", label: "Adicionar amigo" },
  ];

  const listForTab: FriendDTO[] =
    tab === "all" ? accepted : tab === "online" ? online : tab === "pending" ? pending : tab === "blocked" ? blocked : [];

  return (
    <div className="flex flex-1 flex-col bg-[var(--chat-bg)] min-w-0">
      <div className="flex h-12 items-center gap-2 border-b border-border px-4 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "relative rounded-md px-2.5 py-1 text-sm font-medium whitespace-nowrap transition-colors",
              tab === t.id
                ? t.id === "add"
                  ? "bg-green-600 text-white"
                  : "bg-[var(--active-bg)] text-foreground"
                : t.id === "add"
                  ? "text-green-500 hover:bg-green-600/10"
                  : "text-muted-foreground hover:bg-[var(--hover-bg)] hover:text-foreground",
            )}
          >
            {t.label}
            {!!t.badge && (
              <span className="ml-1.5 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === "add" ? (
          <AddFriend onDone={() => setTab("pending")} />
        ) : listForTab.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-sm text-muted-foreground">
              {tab === "all" && "Você ainda não tem amigos. Adicione alguém para começar!"}
              {tab === "online" && "Nenhum amigo online no momento."}
              {tab === "pending" && "Nenhum pedido de amizade pendente."}
              {tab === "blocked" && "Nenhum usuário bloqueado."}
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-1">
            <p className="pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {tabs.find((t) => t.id === tab)?.label} — {listForTab.length}
            </p>
            {listForTab.map((f) => (
              <div
                key={f.friendshipId}
                className="flex items-center gap-3 rounded-lg border-t border-border/50 px-2 py-3 hover:bg-[var(--hover-bg)]"
              >
                <Avatar user={f.user} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{f.user.name ?? f.user.username}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    @{f.user.username}
                    {f.status === "PENDING" &&
                      (f.direction === "incoming" ? " · pedido recebido" : " · pedido enviado")}
                  </p>
                </div>
                <div className="flex gap-1">
                  {f.status === "ACCEPTED" && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Enviar mensagem"
                        onClick={() => openDm.mutate({ userId: f.user.id })}
                        disabled={openDm.isPending}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        title="Remover amizade"
                        onClick={() => remove.mutate({ userId: f.user.id })}
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {f.status === "PENDING" && f.direction === "incoming" && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-green-500"
                        title="Aceitar"
                        onClick={() => accept.mutate({ friendshipId: f.friendshipId })}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        title="Recusar"
                        onClick={() => decline.mutate({ friendshipId: f.friendshipId })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {f.status === "PENDING" && f.direction === "outgoing" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      title="Cancelar pedido"
                      onClick={() => cancel.mutate({ friendshipId: f.friendshipId })}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  {f.status === "BLOCKED" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Desbloquear"
                      onClick={() => unblock.mutate({ userId: f.user.id })}
                    >
                      <Undo2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AddFriend({ onDone }: { onDone: () => void }) {
  const [username, setUsername] = useState("");
  const sendRequest = trpc.friend.sendRequest.useMutation({
    onSuccess: (result) => {
      if (result.status === "ACCEPTED") {
        toast.success("Vocês já são amigos agora!");
      } else {
        toast.success("Pedido de amizade enviado!");
      }
      setUsername("");
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-md pt-8">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <UserPlus className="h-5 w-5" /> Adicionar amigo
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Digite o nome de usuário da pessoa que você quer adicionar.
      </p>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (username.trim()) sendRequest.mutate({ username: username.trim() });
        }}
      >
        <Input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="nome.de.usuario"
          maxLength={32}
          autoFocus
        />
        <Button type="submit" disabled={!username.trim() || sendRequest.isPending}>
          {sendRequest.isPending ? "Enviando..." : "Enviar"}
        </Button>
      </form>
      <div className="mt-6 flex items-start gap-2 rounded-lg border border-border p-3 text-xs text-muted-foreground">
        <Ban className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          Você também pode bloquear usuários a partir do perfil deles ou da lista de amigos.
          Usuários bloqueados não podem enviar pedidos nem mensagens para você.
        </p>
      </div>
    </div>
  );
}
