import { useLocation, useNavigate, useParams } from "react-router";
import { useMemo, useState } from "react";
import { BadgeCheck, Inbox, Plus, ShieldCheck, Users } from "lucide-react";
import type { ConversationDTO } from "@contracts/types";
import { trpc } from "@/providers/trpc";
import { UserPanel } from "./UserPanel";
import { cn } from "@/lib/utils";
import { NexoraAppIcon } from "@/components/NexoraBrand";
import { NewMessageDialog } from "./private/NewMessageDialog";
import { DMListItem } from "./private/DMListItem";
import { organizePrivateInbox } from "@/lib/privateInbox";

export function DMSidebar({
  onOpenProfile,
}: {
  onOpenProfile?: (userId: number) => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const activeConversationId = params.conversationId
    ? Number(params.conversationId)
    : null;
  const conversations = trpc.dm.list.useQuery(undefined, {
    placeholderData: previous => previous,
  });
  const friends = trpc.friend.list.useQuery(undefined, {
    placeholderData: previous => previous,
  });
  const officialUnread = trpc.official.unreadCount.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const authority = trpc.admin.authority.useQuery();
  const acceptedFriendIds = useMemo(
    () =>
      new Set(
        (friends.data ?? [])
          .filter(friend => friend.status === "ACCEPTED")
          .map(friend => friend.user.id),
      ),
    [friends.data],
  );
  const { pinned, recent, requests, spam } = organizePrivateInbox(
    conversations.data ?? [],
  );
  const directMessageCount = pinned.length + recent.length;
  const officialActive = location.pathname === "/channels/@me/official";
  const friendsActive =
    location.pathname === "/channels/@me" ||
    location.pathname === "/channels/@me/friends";
  const requestsActive = location.pathname === "/channels/@me/requests";

  return (
    <aside
      aria-label="Navegação privada"
      className="flex h-full w-60 shrink-0 flex-col border-r border-black/20 bg-sidebar select-none"
    >
      <div className="flex h-12 items-center gap-2 border-b border-white/5 px-3">
        <button
          onClick={() => navigate("/channels/@me")}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
            friendsActive
              ? "bg-act text-foreground"
              : "text-muted2 hover:bg-hov hover:text-bodyx",
          )}
        >
          <Users className="h-4 w-4" /> Amigos
        </button>
        <button
          type="button"
          onClick={() => setNewMessageOpen(true)}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-muted2 transition-colors hover:bg-hov hover:text-bodyx"
          aria-label="Nova mensagem"
          title="Nova mensagem"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden xl:inline">Nova</span>
        </button>
      </div>

      <nav className="space-y-0.5 px-2 py-2" aria-label="Área privada">
        <PrivateNavItem
          icon={<Inbox />}
          label="Solicitações de mensagens"
          active={requestsActive}
          badge={requests.length + spam.length}
          onClick={() => navigate("/channels/@me/requests")}
        />
        <button
          type="button"
          onClick={() => navigate("/channels/@me/official")}
          aria-current={officialActive ? "page" : undefined}
          className={cn(
            "group flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-left transition-colors",
            officialActive
              ? "bg-act text-foreground"
              : "text-muted2 hover:bg-hov hover:text-bodyx",
          )}
        >
          <span className="relative shrink-0">
            <NexoraAppIcon className="h-7 w-7" />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-[hsl(var(--sidebar-bg))] bg-primary text-white">
              <BadgeCheck className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold">Nexora Oficial</span>
            <span className="block truncate text-[10px] text-faint">Comunicados da plataforma</span>
          </span>
          {(officialUnread.data?.count ?? 0) > 0 && (
            <CountBadge count={officialUnread.data?.count ?? 0} />
          )}
        </button>
        {authority.data?.canAccess && (
          <PrivateNavItem
            icon={<ShieldCheck />}
            label="Painel Nexora"
            active={location.pathname === "/nexora-admin"}
            onClick={() => navigate("/nexora-admin")}
          />
        )}
      </nav>

      <div className="flex min-h-0 flex-1 flex-col border-t border-white/5">
        <div className="flex h-9 shrink-0 items-center justify-between px-3.5 pt-1">
          <span className="text-[11px] font-semibold text-faint">Mensagens diretas</span>
          <button
            type="button"
            onClick={() => setNewMessageOpen(true)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted2 transition-colors hover:bg-hov hover:text-foreground"
            aria-label="Nova mensagem"
            title="Nova mensagem"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2" aria-label="Lista de mensagens diretas">
          {conversations.isLoading && !conversations.data ? (
            <DMSidebarSkeleton />
          ) : conversations.isError ? (
            <div className="mx-2 mt-4 rounded-xl border border-border px-3 py-5 text-center">
              <p className="text-xs font-semibold text-bodyx">Falha ao carregar conversas</p>
              <button
                type="button"
                onClick={() => conversations.refetch()}
                className="mt-3 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted2 hover:bg-hov hover:text-foreground"
              >
                Tentar novamente
              </button>
            </div>
          ) : directMessageCount === 0 ? (
            <div className="mx-2 mt-4 rounded-xl border border-dashed border-border px-3 py-5 text-center">
              <p className="text-xs font-semibold text-bodyx">Nenhuma conversa ainda</p>
              <p className="mt-1 text-[11px] leading-4 text-muted2">Inicie uma DM ou crie um grupo com seus amigos.</p>
              <button
                type="button"
                onClick={() => setNewMessageOpen(true)}
                className="mt-3 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary/90"
              >
                Nova mensagem
              </button>
            </div>
          ) : (
            <>
              {pinned.length > 0 && (
                <ConversationGroup
                  label="Fixadas"
                  items={pinned}
                  activeConversationId={activeConversationId}
                  acceptedFriendIds={acceptedFriendIds}
                  onOpenProfile={onOpenProfile}
                />
              )}
              <ConversationGroup
                label={pinned.length > 0 ? "Recentes" : undefined}
                items={recent}
                activeConversationId={activeConversationId}
                acceptedFriendIds={acceptedFriendIds}
                onOpenProfile={onOpenProfile}
              />
            </>
          )}
        </div>
      </div>

      <UserPanel />
      <NewMessageDialog open={newMessageOpen} onOpenChange={setNewMessageOpen} />
    </aside>
  );
}

function ConversationGroup({
  label,
  items,
  activeConversationId,
  acceptedFriendIds,
  onOpenProfile,
}: {
  label?: string;
  items: ConversationDTO[];
  activeConversationId: number | null;
  acceptedFriendIds: Set<number>;
  onOpenProfile?: (userId: number) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section aria-label={label ?? "Conversas"} className="mb-1">
      {label && <p className="px-3 pb-1 pt-2 text-[10px] font-semibold text-faint">{label}</p>}
      <div className="space-y-0.5">
        {items.map(conversation => (
          <DMListItem
            key={conversation.id}
            conversation={conversation}
            active={activeConversationId === conversation.id}
            isFriend={!!conversation.otherUser && acceptedFriendIds.has(conversation.otherUser.id)}
            onOpenProfile={onOpenProfile}
          />
        ))}
      </div>
    </section>
  );
}

function PrivateNavItem({
  icon,
  label,
  active,
  badge = 0,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[13px] font-semibold transition-colors [&_svg]:h-4 [&_svg]:w-4",
        active
          ? "bg-act text-foreground"
          : "text-muted2 hover:bg-hov hover:text-bodyx",
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge > 0 && <CountBadge count={badge} />}
    </button>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--mention-badge)] px-1 text-[10px] font-bold text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function DMSidebarSkeleton() {
  return (
    <div className="space-y-1 px-1 py-1" aria-label="Carregando conversas">
      {[1, 2, 3, 4, 5, 6].map(item => (
        <div key={item} className="flex animate-pulse items-center gap-2.5 rounded-lg px-2 py-1.5">
          <div className="h-8 w-8 rounded-full bg-white/[0.07]" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-2.5 w-2/3 rounded bg-white/[0.07]" />
            <div className="h-2 w-4/5 rounded bg-white/[0.045]" />
          </div>
        </div>
      ))}
    </div>
  );
}
