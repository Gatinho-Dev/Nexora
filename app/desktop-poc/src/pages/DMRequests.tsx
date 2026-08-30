import { useState, type ReactNode } from "react";
import { useNavigate, useOutletContext } from "react-router";
import {
  ArrowLeft,
  Ban,
  Check,
  Inbox,
  ShieldAlert,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import type { ConversationDTO } from "@contracts/types";
import type { AppOutletContext } from "@/lib/appOutletContext";
import { trpc } from "@/providers/trpc";
import { useIsMobile } from "@/hooks/use-mobile";
import { DMSidebar } from "@/components/DMSidebar";
import { SidebarPortal } from "@/components/SidebarPortal";
import { Avatar } from "@/components/Avatar";
import { NexoraAppIcon } from "@/components/NexoraBrand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RequestTab = "requests" | "spam";

export function DMRequests() {
  const { onOpenProfile } = useOutletContext<AppOutletContext>();
  const isMobile = useIsMobile();

  return (
    <div className="flex min-h-0 flex-1">
      {!isMobile && (
        <SidebarPortal>
          <DMSidebar onOpenProfile={onOpenProfile} />
        </SidebarPortal>
      )}
      <RequestsPanel onOpenProfile={onOpenProfile} />
    </div>
  );
}

function RequestsPanel({
  onOpenProfile,
}: {
  onOpenProfile?: (userId: number) => void;
}) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<RequestTab>("requests");
  const utils = trpc.useUtils();
  const conversations = trpc.dm.list.useQuery();
  const requestAction = trpc.dm.requestAction.useMutation({
    onSuccess: () => {
      void Promise.all([
        utils.dm.list.invalidate(),
        utils.message.unread.invalidate(),
        utils.friend.list.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });

  const allRequests = (conversations.data ?? []).filter(
    conversation => conversation.isRequest,
  );
  const requests = allRequests.filter(conversation => !conversation.isSpam);
  const spam = allRequests.filter(conversation => conversation.isSpam);
  const visible = tab === "spam" ? spam : requests;

  const act = async (
    conversation: ConversationDTO,
    action: "accept" | "ignore" | "spam" | "block",
  ) => {
    if (action === "block") {
      const name =
        conversation.otherUser?.name ??
        conversation.otherUser?.username ??
        "esta pessoa";
      if (!window.confirm(`Bloquear ${name}?`)) return;
    }
    await requestAction.mutateAsync({
      conversationId: conversation.id,
      action,
    });
    if (action === "accept") {
      toast.success("Solicitação aceita.");
      navigate(`/channels/@me/${conversation.id}`);
    } else if (action === "spam") {
      toast.success("Conversa movida para Spam.");
      setTab("spam");
    } else if (action === "ignore") {
      toast.success("Solicitação ignorada.");
    } else {
      toast.success("Pessoa bloqueada.");
    }
  };

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-chat text-foreground">
      <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-border/80 px-3 md:px-6">
        <button
          type="button"
          onClick={() => navigate("/channels/@me")}
          className="grid h-9 w-9 place-items-center rounded-lg text-muted2 hover:bg-hov hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          aria-label="Voltar para mensagens"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Inbox className="h-5 w-5 text-primary" aria-hidden="true" />
        <div className="min-w-0">
          <h1 className="truncate text-sm font-bold">Solicitações de mensagem</h1>
          <p className="hidden text-xs text-muted2 sm:block">
            Decida quem pode entrar na sua caixa privada.
          </p>
        </div>
      </header>

      <section className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/[0.07] px-4 py-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-xs leading-relaxed text-muted2">
              Mensagens de pessoas fora da sua lista ficam separadas. Aceitar
              libera a conversa; ignorar apenas a oculta e não apaga o histórico.
            </p>
          </div>

          <nav
            aria-label="Categorias de solicitações"
            className="mt-5 flex gap-1 border-b border-border"
          >
            <RequestTabButton
              active={tab === "requests"}
              onClick={() => setTab("requests")}
              label="Pedidos"
              count={requests.length}
            />
            <RequestTabButton
              active={tab === "spam"}
              onClick={() => setTab("spam")}
              label="Spam"
              count={spam.length}
            />
          </nav>

          {conversations.isLoading ? (
            <RequestSkeleton />
          ) : conversations.isError ? (
            <RequestEmpty
              spam={tab === "spam"}
              title="Não foi possível carregar as solicitações"
              description="Confira sua conexão e tente novamente."
              action={
                <Button size="sm" variant="outline" onClick={() => conversations.refetch()}>
                  Tentar novamente
                </Button>
              }
            />
          ) : visible.length === 0 ? (
            <RequestEmpty spam={tab === "spam"} />
          ) : (
            <div className="divide-y divide-border/70">
              {visible.map(conversation => (
                <RequestRow
                  key={conversation.id}
                  conversation={conversation}
                  pending={requestAction.isPending}
                  onOpenProfile={onOpenProfile}
                  onAccept={() => void act(conversation, "accept")}
                  onIgnore={() => void act(conversation, "ignore")}
                  onSpam={() => void act(conversation, "spam")}
                  onBlock={() => void act(conversation, "block")}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function RequestTabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative -mb-px flex min-h-11 items-center gap-2 border-b-2 px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted2 hover:text-foreground",
      )}
    >
      {label}
      {count > 0 && (
        <span className="min-w-5 rounded-full bg-act px-1.5 py-0.5 text-[10px] font-bold text-foreground">
          {count}
        </span>
      )}
    </button>
  );
}

function RequestRow({
  conversation,
  pending,
  onOpenProfile,
  onAccept,
  onIgnore,
  onSpam,
  onBlock,
}: {
  conversation: ConversationDTO;
  pending: boolean;
  onOpenProfile?: (userId: number) => void;
  onAccept: () => void;
  onIgnore: () => void;
  onSpam: () => void;
  onBlock: () => void;
}) {
  const person = conversation.otherUser;
  const displayName = person?.name ?? person?.username ?? "Usuário";
  return (
    <article className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {person ? (
          <button
            type="button"
            onClick={() => onOpenProfile?.(person.id)}
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Ver perfil de ${displayName}`}
          >
            <Avatar
              userId={person.id}
              name={displayName}
              src={person.avatar}
              size="md"
              showStatus
            />
          </button>
        ) : (
          <div className="h-10 w-10 rounded-full bg-act" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{displayName}</p>
          <p className="truncate text-xs text-muted2">
            {conversation.lastMessage?.content || "Anexo enviado"}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-[52px] sm:pl-0">
        <Button
          type="button"
          size="sm"
          onClick={onAccept}
          disabled={pending}
          className="bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Check className="h-3.5 w-3.5" /> Aceitar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onIgnore}
          disabled={pending}
          className="text-xs text-muted2"
        >
          <UserX className="h-3.5 w-3.5" /> Ignorar
        </Button>
        {!conversation.isSpam && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onSpam}
            disabled={pending}
            className="text-xs text-muted2"
          >
            <ShieldAlert className="h-3.5 w-3.5" /> Spam
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onBlock}
          disabled={pending}
          className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Ban className="h-3.5 w-3.5" /> Bloquear
        </Button>
      </div>
    </article>
  );
}

function RequestEmpty({
  spam,
  title,
  description,
  action,
}: {
  spam: boolean;
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
      <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary">
        <NexoraAppIcon className="h-9 w-9 opacity-25" decorative />
        {spam ? (
          <ShieldAlert className="absolute h-6 w-6" />
        ) : (
          <Inbox className="absolute h-6 w-6" />
        )}
      </div>
      <h2 className="mt-4 text-sm font-semibold">
        {title ?? (spam ? "Nada marcado como spam" : "Nenhuma solicitação")}
      </h2>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted2">
        {description ??
          (spam
            ? "Conversas suspeitas movidas por você aparecem aqui."
            : "Novos pedidos de pessoas fora da sua lista aparecem aqui.")}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function RequestSkeleton() {
  return (
    <div className="divide-y divide-border/70" aria-label="Carregando solicitações">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex min-h-[72px] items-center gap-3 py-4">
          <div className="h-10 w-10 animate-pulse rounded-full bg-act" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-28 animate-pulse rounded bg-act" />
            <div className="h-2.5 w-48 max-w-1/2 animate-pulse rounded bg-act/70" />
          </div>
          <div className="h-8 w-24 animate-pulse rounded-lg bg-act" />
        </div>
      ))}
    </div>
  );
}
