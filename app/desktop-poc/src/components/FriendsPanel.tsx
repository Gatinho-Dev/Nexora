import { useId, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  Ban,
  Check,
  CircleHelp,
  Info,
  MessageSquare,
  MoreHorizontal,
  Search,
  Undo2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { FriendDTO } from "@contracts/types";
import { trpc } from "@/providers/trpc";
import { useAppStore } from "@/store/useAppStore";
import { Avatar } from "./Avatar";
import { RobloxActivityInline } from "./roblox/RobloxActivityCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Tab = "online" | "all" | "pending" | "blocked" | "add";

const tabs: { id: Tab; label: string }[] = [
  { id: "online", label: "Disponível" },
  { id: "all", label: "Todos" },
  { id: "pending", label: "Pendente" },
  { id: "blocked", label: "Bloqueados" },
  { id: "add", label: "Adicionar amigo" },
];

export function FriendsPanel({
  onOpenProfile,
}: {
  onOpenProfile?: (userId: number) => void;
}) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("online");
  const [search, setSearch] = useState("");
  const friends = trpc.friend.list.useQuery();
  const presence = useAppStore(state => state.presence);
  const refresh = () => friends.refetch();

  const accept = trpc.friend.accept.useMutation({
    onSuccess: refresh,
    onError: error => toast.error(error.message),
  });
  const decline = trpc.friend.decline.useMutation({
    onSuccess: refresh,
    onError: error => toast.error(error.message),
  });
  const cancel = trpc.friend.cancel.useMutation({
    onSuccess: refresh,
    onError: error => toast.error(error.message),
  });
  const remove = trpc.friend.remove.useMutation({
    onSuccess: () => {
      toast.success("Amizade removida.");
      void refresh();
    },
    onError: error => toast.error(error.message),
  });
  const block = trpc.friend.block.useMutation({
    onSuccess: () => {
      toast.success("Pessoa bloqueada.");
      void refresh();
    },
    onError: error => toast.error(error.message),
  });
  const unblock = trpc.friend.unblock.useMutation({
    onSuccess: refresh,
    onError: error => toast.error(error.message),
  });
  const openDm = trpc.dm.open.useMutation({
    onSuccess: conversation =>
      navigate(`/channels/@me/${conversation.conversationId}`),
    onError: error => toast.error(error.message),
  });

  const all = friends.data ?? [];
  const accepted = all.filter(friend => friend.status === "ACCEPTED");
  const online = accepted.filter(
    friend =>
      (presence[friend.user.id] ?? friend.user.status ?? "offline") !==
      "offline",
  );
  const pending = all.filter(friend => friend.status === "PENDING");
  const blocked = all.filter(friend => friend.status === "BLOCKED");
  const incomingCount = pending.filter(
    friend => friend.direction === "incoming",
  ).length;

  const visibleFriends = useMemo(() => {
    const base =
      tab === "online"
        ? online
        : tab === "all"
          ? accepted
          : tab === "pending"
            ? pending
            : tab === "blocked"
              ? blocked
              : [];
    const query = search.trim().toLocaleLowerCase("pt-BR");
    if (!query) return base;
    return base.filter(friend => {
      const name = friend.user.name ?? "";
      const username = friend.user.username ?? "";
      return `${name} ${username}`.toLocaleLowerCase("pt-BR").includes(query);
    });
  }, [accepted, blocked, online, pending, search, tab]);

  const actionPending =
    accept.isPending ||
    decline.isPending ||
    cancel.isPending ||
    remove.isPending ||
    block.isPending ||
    unblock.isPending ||
    openDm.isPending;

  const removeFriend = (friend: FriendDTO) => {
    if (
      window.confirm(
        `Remover ${friend.user.name ?? friend.user.username} dos seus amigos?`,
      )
    ) {
      remove.mutate({ userId: friend.user.id });
    }
  };
  const blockFriend = (friend: FriendDTO) => {
    if (
      window.confirm(
        `Bloquear ${friend.user.name ?? friend.user.username}? Essa pessoa não poderá conversar com você.`,
      )
    ) {
      block.mutate({ userId: friend.user.id });
    }
  };

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-chat text-foreground">
      <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-border/80 px-3 md:px-5">
        <div className="mr-1 hidden items-center gap-2 border-r border-border pr-4 text-sm font-bold sm:flex">
          <Users className="h-5 w-5 text-primary" aria-hidden="true" />
          Amigos
        </div>
        <nav
          aria-label="Categorias de amigos"
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-2"
        >
          {tabs.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "relative shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                tab === item.id
                  ? item.id === "add"
                    ? "bg-primary text-primary-foreground"
                    : "bg-act text-foreground"
                  : item.id === "add"
                    ? "text-primary hover:bg-primary/10"
                    : "text-muted2 hover:bg-hov hover:text-foreground",
              )}
            >
              {item.label}
              {item.id === "pending" && incomingCount > 0 && (
                <span className="ml-1.5 rounded-full bg-mention-badge px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {incomingCount}
                </span>
              )}
            </button>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => toast.info("Use a busca e os filtros para organizar seus contatos.")}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted2 transition-colors hover:bg-hov hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Ajuda sobre amigos"
          title="Ajuda"
        >
          <CircleHelp className="h-4 w-4" />
        </button>
      </header>

      {tab === "add" ? (
        <AddFriend onDone={() => setTab("pending")} />
      ) : (
        <div className="flex min-h-0 flex-1">
          <section className="min-w-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
            <InfoBanner />
            <label className="relative mt-4 block max-w-3xl">
              <span className="sr-only">Buscar amigos</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted2"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Buscar por nome ou usuário"
                className="h-10 border-border bg-input pl-9 pr-9 text-sm"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted2 hover:bg-hov hover:text-foreground"
                  aria-label="Limpar busca"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </label>

            <div className="mt-5 max-w-3xl">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-faint">
                {tabs.find(item => item.id === tab)?.label} · {visibleFriends.length}
              </p>

              {friends.isLoading ? (
                <FriendListSkeleton />
              ) : friends.isError ? (
                <EmptyFriends
                  title="Não foi possível carregar seus amigos"
                  description="Confira a conexão e tente novamente."
                  action={
                    <Button size="sm" variant="outline" onClick={() => friends.refetch()}>
                      Tentar novamente
                    </Button>
                  }
                />
              ) : visibleFriends.length === 0 ? (
                <EmptyFriends
                  title={search ? "Nenhum resultado" : emptyCopy(tab).title}
                  description={
                    search
                      ? `Nenhum amigo corresponde a “${search}”.`
                      : emptyCopy(tab).description
                  }
                />
              ) : (
                <div className="divide-y divide-border/70 border-t border-border/70">
                  {visibleFriends.map(friend => (
                    <FriendRow
                      key={friend.friendshipId}
                      friend={friend}
                      pending={actionPending}
                      onOpenProfile={onOpenProfile}
                      onMessage={() => openDm.mutate({ userId: friend.user.id })}
                      onAccept={() =>
                        accept.mutate({ friendshipId: friend.friendshipId })
                      }
                      onDecline={() =>
                        decline.mutate({ friendshipId: friend.friendshipId })
                      }
                      onCancel={() =>
                        cancel.mutate({ friendshipId: friend.friendshipId })
                      }
                      onRemove={() => removeFriend(friend)}
                      onBlock={() => blockFriend(friend)}
                      onUnblock={() => unblock.mutate({ userId: friend.user.id })}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          <ActiveNowPanel
            friends={online}
            onMessage={userId => openDm.mutate({ userId })}
            onOpenProfile={onOpenProfile}
          />
        </div>
      )}
    </main>
  );
}

function InfoBanner() {
  const [visible, setVisible] = useState(
    () => localStorage.getItem("nexora:friends-info-dismissed") !== "1",
  );
  if (!visible) return null;
  return (
    <div className="relative flex max-w-3xl gap-3 rounded-xl border border-primary/25 bg-primary/[0.07] px-4 py-3 pr-11 text-sm">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <div>
        <p className="font-semibold text-foreground">Seu espaço de contatos</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted2">
          Encontre quem está disponível, retome conversas e gerencie pedidos sem
          sair da sua caixa privada.
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem("nexora:friends-info-dismissed", "1");
          setVisible(false);
        }}
        className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md text-muted2 hover:bg-primary/10 hover:text-foreground"
        aria-label="Fechar aviso"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function FriendRow({
  friend,
  pending,
  onOpenProfile,
  onMessage,
  onAccept,
  onDecline,
  onCancel,
  onRemove,
  onBlock,
  onUnblock,
}: {
  friend: FriendDTO;
  pending: boolean;
  onOpenProfile?: (userId: number) => void;
  onMessage: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onCancel: () => void;
  onRemove: () => void;
  onBlock: () => void;
  onUnblock: () => void;
}) {
  const displayName = friend.user.name ?? friend.user.username ?? "Usuário";
  return (
    <article className="group flex min-h-[64px] items-center gap-3 px-2 py-2.5 transition-colors hover:bg-hov/70 sm:px-3">
      <button
        type="button"
        onClick={() => onOpenProfile?.(friend.user.id)}
        className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Ver perfil de ${displayName}`}
      >
        <Avatar
          userId={friend.user.id}
          name={displayName}
          src={friend.user.avatar}
          size="md"
          showStatus
        />
      </button>
      <button
        type="button"
        onClick={() => onOpenProfile?.(friend.user.id)}
        className="min-w-0 flex-1 text-left focus-visible:outline-none"
      >
        <span className="block truncate text-sm font-semibold text-foreground">
          {displayName}
        </span>
        <span className="block truncate text-xs text-muted2">
          @{friend.user.username}
          {friend.status === "PENDING"
            ? friend.direction === "incoming"
              ? " · pedido recebido"
              : " · pedido enviado"
            : ""}
        </span>
        {friend.status === "ACCEPTED" && (
          <RobloxActivityInline userId={friend.user.id} />
        )}
      </button>

      <div className="flex shrink-0 items-center gap-1">
        {friend.status === "ACCEPTED" && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onMessage}
            disabled={pending}
            className="rounded-full text-muted2 hover:bg-primary/10 hover:text-primary"
            title="Enviar mensagem"
            aria-label={`Enviar mensagem para ${displayName}`}
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
        )}
        {friend.status === "PENDING" && friend.direction === "incoming" && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onAccept}
              disabled={pending}
              className="rounded-full text-primary hover:bg-primary/10"
              title="Aceitar pedido"
              aria-label={`Aceitar pedido de ${displayName}`}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onDecline}
              disabled={pending}
              className="rounded-full text-muted2 hover:bg-destructive/10 hover:text-destructive"
              title="Recusar pedido"
              aria-label={`Recusar pedido de ${displayName}`}
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        )}
        {friend.status === "PENDING" && friend.direction === "outgoing" && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onCancel}
            disabled={pending}
            className="rounded-full text-muted2 hover:bg-destructive/10 hover:text-destructive"
            title="Cancelar pedido"
            aria-label={`Cancelar pedido para ${displayName}`}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        {friend.status === "BLOCKED" ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onUnblock}
            disabled={pending}
            className="rounded-full text-muted2 hover:bg-hov hover:text-foreground"
            title="Desbloquear"
            aria-label={`Desbloquear ${displayName}`}
          >
            <Undo2 className="h-4 w-4" />
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full text-muted2 hover:bg-hov hover:text-foreground"
                aria-label={`Mais ações para ${displayName}`}
                title="Mais ações"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuItem onSelect={() => onOpenProfile?.(friend.user.id)}>
                <Users /> Ver perfil
              </DropdownMenuItem>
              {friend.status === "ACCEPTED" && (
                <>
                  <DropdownMenuItem onSelect={onMessage}>
                    <MessageSquare /> Enviar mensagem
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={onRemove}>
                    <UserMinus /> Remover amizade
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem variant="destructive" onSelect={onBlock}>
                <Ban /> Bloquear
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </article>
  );
}

function ActiveNowPanel({
  friends,
  onMessage,
  onOpenProfile,
}: {
  friends: FriendDTO[];
  onMessage: (userId: number) => void;
  onOpenProfile?: (userId: number) => void;
}) {
  return (
    <aside className="hidden w-[292px] shrink-0 border-l border-border/80 px-5 py-6 xl:block">
      <h2 className="text-sm font-bold text-foreground">Ativos agora</h2>
      {friends.length === 0 ? (
        <div className="mt-12 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <p className="mt-3 text-sm font-semibold">Tudo tranquilo por aqui</p>
          <p className="mt-1 text-xs leading-relaxed text-muted2">
            Atividades de amigos disponíveis aparecem neste painel.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {friends.slice(0, 8).map(friend => {
            const name = friend.user.name ?? friend.user.username ?? "Usuário";
            return (
              <article
                key={friend.friendshipId}
                className="rounded-xl border border-border bg-card/70 p-3 transition-colors hover:border-primary/30"
              >
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onOpenProfile?.(friend.user.id)}
                    className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Ver perfil de ${name}`}
                  >
                    <Avatar
                      userId={friend.user.id}
                      name={name}
                      src={friend.user.avatar}
                      size="sm"
                      showStatus
                    />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{name}</p>
                    <RobloxActivityInline userId={friend.user.id} />
                  </div>
                  <button
                    type="button"
                    onClick={() => onMessage(friend.user.id)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted2 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Conversar com ${name}`}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </aside>
  );
}

function AddFriend({ onDone }: { onDone: () => void }) {
  const inputId = useId();
  const [username, setUsername] = useState("");
  const sendRequest = trpc.friend.sendRequest.useMutation({
    onSuccess: result => {
      toast.success(
        result.status === "ACCEPTED"
          ? "Vocês já são amigos na Nexora."
          : "Pedido de amizade enviado.",
      );
      setUsername("");
      onDone();
    },
    onError: error => toast.error(error.message),
  });

  return (
    <section className="flex-1 overflow-y-auto px-5 py-8 md:px-8">
      <div className="max-w-xl">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Adicionar amigo</h1>
            <p className="mt-1 text-sm leading-relaxed text-muted2">
              Envie um pedido usando o nome de usuário exato da pessoa.
            </p>
          </div>
        </div>
        <form
          className="mt-7 rounded-xl border border-border bg-card p-4"
          onSubmit={event => {
            event.preventDefault();
            const value = username.trim();
            if (value) sendRequest.mutate({ username: value });
          }}
        >
          <label htmlFor={inputId} className="text-xs font-semibold text-foreground">
            Nome de usuário
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Input
              id={inputId}
              value={username}
              onChange={event => setUsername(event.target.value)}
              placeholder="nome.de.usuario"
              maxLength={32}
              autoFocus
              autoComplete="off"
              className="h-11 flex-1 border-border bg-input"
            />
            <Button
              type="submit"
              disabled={!username.trim() || sendRequest.isPending}
              className="h-11 bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary/90"
            >
              {sendRequest.isPending ? "Enviando..." : "Enviar pedido"}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}

function FriendListSkeleton() {
  return (
    <div className="divide-y divide-border/70 border-t border-border/70" aria-label="Carregando amigos">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex min-h-[64px] items-center gap-3 px-3 py-2.5">
          <div className="h-10 w-10 animate-pulse rounded-full bg-act" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 animate-pulse rounded bg-act" />
            <div className="h-2.5 w-20 animate-pulse rounded bg-act/70" />
          </div>
          <div className="h-9 w-9 animate-pulse rounded-full bg-act" />
        </div>
      ))}
    </div>
  );
}

function EmptyFriends({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Users className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-sm font-semibold text-foreground">{title}</h2>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted2">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function emptyCopy(tab: Tab) {
  if (tab === "online") {
    return {
      title: "Ninguém disponível agora",
      description: "Seus amigos aparecem aqui assim que entram na Nexora.",
    };
  }
  if (tab === "pending") {
    return {
      title: "Nenhum pedido pendente",
      description: "Pedidos enviados e recebidos serão organizados aqui.",
    };
  }
  if (tab === "blocked") {
    return {
      title: "Nenhuma pessoa bloqueada",
      description: "As pessoas que você bloquear aparecem nesta lista.",
    };
  }
  return {
    title: "Sua lista ainda está vazia",
    description: "Adicione amigos para começar novas conversas privadas.",
  };
}
