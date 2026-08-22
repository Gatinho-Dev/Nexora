import { useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import {
  Check,
  MessageSquare,
  UserMinus,
  UserPlus,
  X,
  Undo2,
  Users,
} from "lucide-react";
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
  const presence = useAppStore(s => s.presence);

  const invalidate = () => friends.refetch();

  const accept = trpc.friend.accept.useMutation({
    onSuccess: invalidate,
    onError: e => toast.error(e.message),
  });
  const decline = trpc.friend.decline.useMutation({
    onSuccess: invalidate,
    onError: e => toast.error(e.message),
  });
  const cancel = trpc.friend.cancel.useMutation({
    onSuccess: invalidate,
    onError: e => toast.error(e.message),
  });
  const remove = trpc.friend.remove.useMutation({
    onSuccess: () => {
      toast.success("Amizade removida.");
      invalidate();
    },
    onError: e => toast.error(e.message),
  });
  const unblock = trpc.friend.unblock.useMutation({
    onSuccess: invalidate,
    onError: e => toast.error(e.message),
  });
  const openDm = trpc.dm.open.useMutation({
    onSuccess: conv => navigate(`/channels/@me/${conv.conversationId}`),
    onError: e => toast.error(e.message),
  });

  const all = friends.data ?? [];
  const accepted = all.filter(f => f.status === "ACCEPTED");
  const online = accepted.filter(
    f => (presence[f.user.id] ?? f.user.status) !== "offline"
  );
  const pending = all.filter(f => f.status === "PENDING");
  const blocked = all.filter(f => f.status === "BLOCKED");
  const pendingIncoming = pending.filter(
    f => f.direction === "incoming"
  ).length;

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "all", label: "Todos" },
    { id: "online", label: "Online" },
    { id: "pending", label: "Pendentes", badge: pendingIncoming },
    { id: "blocked", label: "Bloqueados" },
    { id: "add", label: "Adicionar amigo" },
  ];

  const listForTab: FriendDTO[] =
    tab === "all"
      ? accepted
      : tab === "online"
        ? online
        : tab === "pending"
          ? pending
          : tab === "blocked"
            ? blocked
            : [];

  return (
    <main className="flex flex-1 flex-col bg-[#313338] min-w-0 select-none">
      <div className="flex h-12 items-center gap-2 border-b border-black/20 px-4 overflow-x-auto bg-[#313338]">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "relative rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors",
              tab === t.id
                ? t.id === "add"
                  ? "bg-[#248046] text-white"
                  : "bg-[#404249] text-white"
                : t.id === "add"
                  ? "text-[#23A559] hover:bg-[#23A559]/10"
                  : "text-[#B5BAC1] hover:bg-[#35373C] hover:text-white"
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

      <div className="flex-1 overflow-y-auto p-6">
        {tab === "add" ? (
          <AddFriend onDone={() => setTab("pending")} />
        ) : listForTab.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-8 text-[#B5BAC1] gap-3">
            <div className="h-16 w-16 rounded-full bg-[#2B2D31] flex items-center justify-center text-[#B5BAC1]">
              <Users className="h-8 w-8" />
            </div>
            <p className="text-sm font-medium">
              {tab === "all" &&
                "Ainda não há ninguém por aqui. Adicione amigos para começar a conversar na Nexora!"}
              {tab === "online" && "Nenhum amigo online no momento."}
              {tab === "pending" && "Nenhum pedido de amizade pendente."}
              {tab === "blocked" && "Nenhum usuário bloqueado."}
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-1">
            <p className="pb-3 text-xs font-bold uppercase tracking-wide text-[#949BA4]">
              {tabs.find(t => t.id === tab)?.label} - {listForTab.length}
            </p>
            {listForTab.map(f => (
              <div
                key={f.friendshipId}
                className="flex min-h-14 items-center gap-3 rounded-md border-t border-white/5 px-3 py-2.5 hover:bg-[#35373C] transition-colors"
              >
                <Avatar
                  userId={f.user.id}
                  name={f.user.name ?? f.user.username}
                  src={f.user.avatar}
                  size="md"
                  showStatus
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-white">
                    {f.user.name ?? f.user.username}
                  </p>
                  <p className="truncate text-[11px] text-[#B5BAC1]">
                    @{f.user.username}
                    {f.status === "PENDING" &&
                      (f.direction === "incoming"
                        ? " · pedido recebido"
                        : " · pedido enviado")}
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
                        className="text-[#5865F2] hover:bg-[#5865F2]/10 hover:text-[#5865F2]"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
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
                        className="text-[#23A559] hover:bg-[#23A559]/10"
                        title="Aceitar"
                        onClick={() =>
                          accept.mutate({ friendshipId: f.friendshipId })
                        }
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-400 hover:bg-red-500/10"
                        title="Recusar"
                        onClick={() =>
                          decline.mutate({ friendshipId: f.friendshipId })
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {f.status === "PENDING" && f.direction === "outgoing" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-400 hover:bg-red-500/10"
                      title="Cancelar pedido"
                      onClick={() =>
                        cancel.mutate({ friendshipId: f.friendshipId })
                      }
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
                      className="text-[#B5BAC1] hover:text-white"
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
    </main>
  );
}

function AddFriend({ onDone }: { onDone: () => void }) {
  const [username, setUsername] = useState("");
  const sendRequest = trpc.friend.sendRequest.useMutation({
    onSuccess: result => {
      if (result.status === "ACCEPTED") {
        toast.success("Vocês já são amigos agora na Nexora!");
      } else {
        toast.success("Pedido de amizade enviado!");
      }
      setUsername("");
      onDone();
    },
    onError: e => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-md pt-6">
      <h2 className="text-lg font-bold text-white flex items-center gap-2">
        <UserPlus className="h-5 w-5 text-[#23A559]" /> Adicionar amigo
      </h2>
      <p className="mt-1 text-xs text-[#B5BAC1]">
        Digite o nome de usuário exato da pessoa que você quer adicionar na
        Nexora.
      </p>
      <form
        className="mt-4 flex gap-2"
        onSubmit={e => {
          e.preventDefault();
          if (username.trim())
            sendRequest.mutate({ username: username.trim() });
        }}
      >
        <Input
          className="h-11 bg-[#1E1F22] border-black/20 text-white placeholder:text-[#949BA4]"
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder="nome.de.usuario"
          maxLength={32}
          autoFocus
        />
        <Button
          type="submit"
          className="h-11 bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold"
          disabled={!username.trim() || sendRequest.isPending}
        >
          {sendRequest.isPending ? "Enviando..." : "Enviar pedido"}
        </Button>
      </form>
    </div>
  );
}
