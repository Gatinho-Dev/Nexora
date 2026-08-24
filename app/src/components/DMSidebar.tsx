import { useLocation, useNavigate, useParams } from "react-router";
import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { BadgeCheck, ShieldCheck, Users, Inbox, UserPlus } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { Avatar } from "./Avatar";
import { UserPanel } from "./UserPanel";
import { cn } from "@/lib/utils";
import { NexoraAppIcon } from "@/components/NexoraBrand";
import { CreateGroupModal } from "./groups/CreateGroupModal";
import { GroupAvatar } from "./groups/GroupAvatar";
import { groupDisplayName } from "@/lib/groupDisplayName";

export function DMSidebar({
  onOpenProfile,
}: {
  onOpenProfile?: (userId: number) => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const activeConversationId = params.conversationId
    ? Number(params.conversationId)
    : null;
  const conversations = trpc.dm.list.useQuery(undefined, {
    placeholderData: prev => prev,
  });
  const officialUnread = trpc.official.unreadCount.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const authority = trpc.admin.authority.useQuery();
  const unreadConversations = useAppStore(s => s.unreadConversations);
  const officialActive = location.pathname === "/channels/@me/official";

  return (
    <aside
      aria-label="Mensagens diretas"
      className="flex h-full w-60 flex-col border-r border-black/20 bg-sidebar select-none"
    >
      <div className="flex h-12 items-center gap-2 border-b border-white/5 px-3">
        <button
          onClick={() => navigate("/channels/@me")}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
            !activeConversationId
              ? "bg-act text-foreground"
              : "text-muted2 hover:bg-hov hover:text-bodyx"
          )}
        >
          <Users className="h-4 w-4" /> Amigos
        </button>
        <button
          onClick={() => setCreateGroupOpen(true)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors",
            "text-muted2 hover:bg-hov hover:text-bodyx"
          )}
          aria-label="Criar grupo"
          title="Criar grupo"
        >
          <UserPlus className="h-4 w-4" />
          <span className="hidden xl:inline">Criar grupo</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <p className="px-2 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-faint">
          Mensagens diretas
        </p>
        <button
          onClick={() => navigate("/channels/@me/official")}
          className={cn(
            "group mb-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
            officialActive
              ? "bg-act text-foreground"
              : "text-muted2 hover:bg-hov hover:text-bodyx"
          )}
          aria-current={officialActive ? "page" : undefined}
        >
          <div className="relative shrink-0">
            <NexoraAppIcon className="h-8 w-8" />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-[#2B2D31] bg-[#5865F2] text-white">
              <BadgeCheck className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-xs font-bold text-foreground">Nexora</p>
              <span
                className="rounded-[3px] bg-[#5865F2] px-1 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-white"
                title="Conta oficial e verificada da Nexora"
              >
                Oficial
              </span>
            </div>
            <p className="truncate text-[11px] text-muted2/70">
              Comunicados da plataforma
            </p>
          </div>
          {(officialUnread.data?.count ?? 0) > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full border border-rail bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {(officialUnread.data?.count ?? 0) > 99
                ? "99+"
                : officialUnread.data?.count}
            </span>
          )}
        </button>
        {authority.data?.canAccess && (
          <button
            onClick={() => navigate("/nexora-admin")}
            className={cn(
              "mb-2 flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors",
              location.pathname === "/nexora-admin"
                ? "border-[#5865F2]/40 bg-[#5865F2]/15 text-[#c9cdfb]"
                : "border-transparent text-muted2 hover:border-white/[0.06] hover:bg-hov hover:text-white"
            )}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#5865F2]/15 text-[#9aa5ff]">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold">
                Painel Nexora
              </span>
              <span className="block truncate text-[10px] text-[#8f96a1]">
                Administração da plataforma
              </span>
            </span>
          </button>
        )}
        {conversations.isLoading ? (
          <p className="px-2 py-2 text-xs text-muted2">
            Carregando conversas...
          </p>
        ) : conversations.data?.length === 0 ? (
          <p className="px-2 py-2 text-xs text-muted2">
            Nenhuma conversa. Adicione amigos para começar na Nexora!
          </p>
        ) : (
          <>
            {/* Message requests */}
            {(conversations.data?.filter(c => c.isRequest).length ?? 0) > 0 && (
              <button
                type="button"
                onClick={() => navigate("/channels/@me/requests")}
                className={cn(
                  "mb-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                  location.pathname === "/channels/@me/requests"
                    ? "bg-act text-foreground"
                    : "text-muted2 hover:bg-hov hover:text-bodyx"
                )}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5">
                  <Inbox className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-bold">
                  Solicitações
                </span>
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground border border-rail">
                  {conversations.data!.filter(c => c.isRequest).length}
                </span>
              </button>
            )}
            <p className="px-2 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-faint">
              Mensagens
            </p>
            <div className="space-y-0.5">
              {conversations.data
                ?.filter(c => !c.isRequest)
                .map(conv => {
                  const isGroup = conv.isGroup === true;
                  const other = conv.otherUser;
                  const unread = unreadConversations[conv.id] ?? 0;
                  return (
                    <div
                      key={conv.id}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors group",
                        activeConversationId === conv.id
                          ? "bg-act text-foreground font-medium"
                          : "text-muted2 hover:bg-hov hover:text-bodyx"
                      )}
                    >
                      {isGroup ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/channels/@me/${conv.id}`)}
                          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7383FF]"
                          aria-label={`Abrir grupo`}
                        >
                          <GroupAvatar
                            users={conv.members}
                            src={conv.avatarUrl}
                            name={groupDisplayName(conv)}
                            size="sm"
                          />
                        </button>
                      ) : other?.id ? (
                        <button
                          type="button"
                          onClick={() => onOpenProfile?.(other.id)}
                          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7383FF]"
                          aria-label={`Ver perfil de ${other.name ?? other.username ?? "usuário"}`}
                          title="Ver perfil"
                        >
                          <Avatar
                            userId={other.id}
                            name={other.name ?? other.username}
                            src={other.avatar}
                            size="sm"
                            showStatus
                            statusOverride={other.status ?? "online"}
                          />
                        </button>
                      ) : (
                        <Avatar name="Conversa" size="sm" />
                      )}
                      <button
                        type="button"
                        onClick={() => navigate(`/channels/@me/${conv.id}`)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none"
                        aria-label={
                          isGroup
                            ? `Abrir grupo ${groupDisplayName(conv)}`
                            : `Abrir conversa com ${other?.name ?? other?.username ?? "usuário"}`
                        }
                      >
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "flex items-center gap-1 truncate text-xs font-semibold group-hover:text-white transition-colors",
                              unread > 0 && "text-foreground font-bold"
                            )}
                          >
                            {isGroup && (
                              <span
                                className="inline-flex shrink-0"
                                title="Grupo"
                                aria-label="Grupo"
                              >
                                <Users
                                  className="h-3 w-3 text-faint"
                                  aria-hidden
                                />
                              </span>
                            )}
                            <span className="truncate">
                              {isGroup
                                ? groupDisplayName(conv)
                                : (other?.name ?? other?.username ?? "Conversa")}
                            </span>
                          </p>
                          {conv.lastMessage && (
                            <p className="truncate text-[11px] text-muted2/70">
                              {isGroup &&
                              conv.lastMessage.authorId !== undefined
                                ? `${conv.members.find(m => m.id === conv.lastMessage!.authorId)?.name ?? ""}: `
                                : ""}
                              {conv.lastMessage.content || "📎 Anexo enviado"}
                            </p>
                          )}
                        </div>
                        {unread > 0 && (
                          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground border border-rail">
                            {unread > 99 ? "99+" : unread}
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })}
            </div>
          </>
        )}
      </div>

      <UserPanel />

      <CreateGroupModal
        open={createGroupOpen}
        onOpenChange={setCreateGroupOpen}
      />
    </aside>
  );
}
