import { useState } from "react";
import { useNavigate } from "react-router";
import type { PublicUser, UserBadgeDTO } from "@contracts/types";
import {
  CalendarDays,
  Check,
  ExternalLink,
  Flag,
  Gamepad2,
  Heart,
  Loader2,
  MessageSquare,
  Pencil,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useAppStore } from "@/store/useAppStore";
import { statusColor } from "@/lib/statusColor";
import { cn } from "@/lib/utils";
import { NexoraMark } from "./NexoraBrand";
import { BadgeList } from "./badges/BadgeUI";
import { UserSettingsModal } from "./modals/UserSettingsModal";
import { ReportDialog } from "./safety/ReportDialog";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import { ProfileAvatar } from "./profile/ProfileAvatar";
import { RichPresenceCard } from "./profile/RichPresenceCard";
import { StyledDisplayName } from "./profile/StyledDisplayName";

const STATUS_LABELS: Record<string, string> = {
  online: "Disponível",
  idle: "Ausente",
  dnd: "Não perturbe",
  invisible: "Invisível",
  offline: "Offline",
};

const THEME_SURFACES: Record<string, string> = {
  cobalt: "from-[#20275a] via-[#171a2b] to-[#11131a]",
  rose: "from-[#7c2d5b] via-[#311a32] to-[#17131b]",
  mint: "from-[#155e75] via-[#17363d] to-[#101718]",
  sunset: "from-[#9a3412] via-[#512139] to-[#181319]",
  midnight: "from-[#312e81] via-[#19182f] to-[#09090b]",
};

const THEME_CANVASES: Record<string, string> = {
  cobalt: "bg-[#f2f3ff]",
  rose: "bg-[#fdeef5]",
  mint: "bg-[#effcf9]",
  sunset: "bg-[#fff3ec]",
  midnight: "bg-[#f0efff]",
};

const THEME_HEADERS: Record<string, string> = {
  cobalt: "bg-[#f2f3ff]/95",
  rose: "bg-[#fdeef5]/95",
  mint: "bg-[#effcf9]/95",
  sunset: "bg-[#fff3ec]/95",
  midnight: "bg-[#f0efff]/95",
};

type ProfileTab = "wall" | "activity" | "wishlist";

function ProfileBanner({ profile }: { profile: PublicUser }) {
  if (profile.banner) {
    return (
      <img
        src={profile.banner}
        alt={`Banner de ${profile.name ?? profile.username ?? "usuário"}`}
        className="h-full w-full object-cover"
      />
    );
  }
  return (
    <div
      className={cn(
        "relative h-full w-full bg-gradient-to-br",
        THEME_SURFACES[profile.profileTheme] ?? THEME_SURFACES.cobalt
      )}
    >
      <NexoraMark
        decorative
        className="absolute -right-8 -top-12 h-52 w-52 rotate-6 opacity-[0.12]"
      />
    </div>
  );
}

function ProfileBadges({ badges }: { badges?: UserBadgeDTO[] }) {
  return (
    <BadgeList
      badges={badges ?? []}
      emptyMessage="Nenhum emblema público ainda."
    />
  );
}

export function ProfileCard({
  userId,
  onClose,
}: {
  userId: number | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [tab, setTab] = useState<ProfileTab>("wall");
  const utils = trpc.useUtils();
  const query = trpc.account.getPublicUser.useQuery(
    { userId: userId ?? 0 },
    { enabled: userId !== null }
  );
  const friends = trpc.friend.list.useQuery(undefined, {
    enabled: userId !== null && userId !== me?.id,
  });
  const badges = trpc.badge.forUser.useQuery(
    { userId: userId ?? 0 },
    { enabled: userId !== null }
  );
  const presence = trpc.integrations.userPresence.useQuery(
    { userId: userId ?? 0 },
    { enabled: userId !== null, refetchInterval: 60_000 }
  );
  const connections = trpc.integrations.publicConnections.useQuery(
    { userId: userId ?? 0 },
    { enabled: userId !== null }
  );
  const liveStatus = useAppStore(state =>
    userId ? state.presence[userId] : undefined
  );
  const liveActivities = useAppStore(state =>
    userId ? state.richPresence[userId] : undefined
  );

  const profile = query.data ?? null;
  const isOwn = Boolean(me && userId === me.id);
  const friendship = friends.data?.find(item => item.user.id === userId);
  const activities = liveActivities ?? presence.data ?? [];
  const displayName = profile?.name ?? profile?.username ?? "Usuário Nexora";
  const currentStatus = liveStatus ?? profile?.status ?? "offline";

  const sendRequest = trpc.friend.sendRequest.useMutation({
    onSuccess: async result => {
      await utils.friend.list.invalidate();
      toast.success(
        result.status === "ACCEPTED"
          ? "Vocês agora são amigos."
          : "Pedido de amizade enviado."
      );
    },
    onError: error => toast.error(error.message),
  });
  const acceptRequest = trpc.friend.accept.useMutation({
    onSuccess: async () => {
      await utils.friend.list.invalidate();
      toast.success("Pedido de amizade aceito.");
    },
    onError: error => toast.error(error.message),
  });
  const openDm = trpc.dm.open.useMutation({
    onSuccess: conversation => {
      onClose();
      navigate(`/channels/@me/${conversation.conversationId}`);
    },
    onError: error => toast.error(error.message),
  });

  const openProfileSettings = () => {
    onClose();
    requestAnimationFrame(() => setSettingsOpen(true));
  };

  const joinedLabel = profile?.createdAt
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(profile.createdAt))
    : null;

  return (
    <>
      <Dialog
        open={userId !== null}
        onOpenChange={open => {
          if (!open) onClose();
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="top-auto bottom-0 left-1/2 max-h-[94dvh] w-full max-w-none -translate-x-1/2 translate-y-0 gap-0 overflow-hidden rounded-t-3xl rounded-b-none border-white/10 bg-[#151720] p-0 text-white shadow-2xl sm:bottom-auto sm:top-1/2 sm:h-[min(760px,calc(100dvh-1rem))] sm:w-[min(1080px,calc(100vw-1rem))] sm:max-w-[1080px] sm:-translate-y-1/2 sm:rounded-3xl"
        >
          <DialogTitle className="sr-only">Perfil de {displayName}</DialogTitle>
          <DialogDescription className="sr-only">
            Perfil público, atividades, conexões e lista de desejos.
          </DialogDescription>
          <DialogClose asChild>
            <button
              className="absolute right-3 top-3 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/70 backdrop-blur hover:bg-black/60 hover:text-white"
              aria-label="Fechar perfil"
            >
              <X className="h-4 w-4" />
            </button>
          </DialogClose>

          {query.isLoading ? (
            <div className="grid h-[620px] place-items-center">
              <Loader2 className="h-6 w-6 animate-spin text-[#7383FF]" />
            </div>
          ) : query.error || !profile ? (
            <div className="grid h-96 place-items-center px-6 text-center">
              <div>
                <p className="font-bold">Não foi possível abrir este perfil.</p>
                <p className="mt-1 text-xs text-white/45">
                  {query.error?.message}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid h-full min-h-0 grid-cols-1 overflow-y-auto sm:grid-cols-[minmax(300px,0.78fr)_minmax(0,1.22fr)] sm:overflow-hidden">
              <aside
                className={cn(
                  "relative min-h-full bg-gradient-to-b",
                  THEME_SURFACES[profile.profileTheme] ?? THEME_SURFACES.cobalt
                )}
              >
                {profile.profileEffect !== "none" && (
                  <div
                    className={cn(
                      "pointer-events-none absolute inset-0 opacity-35",
                      profile.profileEffect === "aurora" &&
                        "bg-[radial-gradient(circle_at_25%_15%,rgba(115,131,255,.8),transparent_36%),radial-gradient(circle_at_75%_55%,rgba(34,211,238,.45),transparent_36%)]",
                      profile.profileEffect === "stardust" &&
                        "bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,.8)_0_1px,transparent_2px)] bg-[length:34px_34px]",
                      profile.profileEffect === "bubbles" &&
                        "bg-[radial-gradient(circle_at_25%_25%,rgba(255,255,255,.28),transparent_13%),radial-gradient(circle_at_75%_65%,rgba(255,255,255,.2),transparent_18%)]"
                    )}
                  />
                )}
                <div className="relative h-40 overflow-hidden">
                  <ProfileBanner profile={profile} />
                </div>
                <div className="relative px-5 pb-6 sm:px-7">
                  <div className="-mt-12 flex items-end justify-between gap-3">
                    <ProfileAvatar
                      userId={profile.id}
                      name={displayName}
                      src={profile.avatar}
                      decoration={profile.avatarDecoration}
                      status={currentStatus}
                      size="2xl"
                    />
                    <div className="mb-1 flex gap-2">
                      {isOwn ? (
                        <Button
                          onClick={openProfileSettings}
                          size="sm"
                          className="h-9 rounded-xl bg-white px-3 text-xs font-bold text-[#171923] hover:bg-white/90"
                        >
                          <Pencil className="mr-1.5 h-3.5 w-3.5" />
                          Editar
                        </Button>
                      ) : (
                        <>
                          <Button
                            onClick={() => userId && openDm.mutate({ userId })}
                            disabled={openDm.isPending}
                            size="sm"
                            className="h-9 rounded-xl bg-[#5865F2] px-3 text-xs hover:bg-[#4752C4]"
                          >
                            <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                            Mensagem
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => setReportOpen(true)}
                            className="h-9 w-9 rounded-xl border border-white/10 bg-black/25 p-0 text-red-200 hover:bg-red-400/10"
                          >
                            <Flag className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 min-w-0">
                    <StyledDisplayName
                      font={profile.nameFont}
                      effect={profile.nameEffect}
                      colorA={profile.nameColorA}
                      colorB={profile.nameColorB}
                      className="text-2xl"
                    >
                      {displayName}
                    </StyledDisplayName>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/65">
                      <span>@{profile.username ?? "sem-usuario"}</span>
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            statusColor(currentStatus)
                          )}
                        />
                        {STATUS_LABELS[currentStatus] ?? "Offline"}
                      </span>
                    </div>
                  </div>

                  {profile.customStatus && (
                    <p className="mt-4 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-xs text-white/80">
                      {profile.customStatus}
                    </p>
                  )}
                  <p
                    className={cn(
                      "mt-5 whitespace-pre-wrap text-sm leading-6",
                      profile.bio ? "text-white/80" : "text-white/40"
                    )}
                  >
                    {profile.bio ||
                      "Este usuário ainda não escreveu uma biografia."}
                  </p>

                  {!isOwn && !friendship && profile.username && (
                    <Button
                      onClick={() =>
                        sendRequest.mutate({ username: profile.username! })
                      }
                      disabled={sendRequest.isPending}
                      variant="secondary"
                      className="mt-4 h-9 w-full rounded-xl border border-white/10 bg-white/[0.08] text-xs text-white hover:bg-white/[0.12]"
                    >
                      <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                      Adicionar amigo
                    </Button>
                  )}
                  {friendship?.status === "PENDING" &&
                    friendship.direction === "incoming" && (
                      <Button
                        onClick={() =>
                          acceptRequest.mutate({
                            friendshipId: friendship.friendshipId,
                          })
                        }
                        disabled={acceptRequest.isPending}
                        className="mt-4 h-9 w-full rounded-xl bg-emerald-500/20 text-xs text-emerald-200 hover:bg-emerald-500/30"
                      >
                        <Check className="mr-1.5 h-3.5 w-3.5" />
                        Aceitar pedido
                      </Button>
                    )}

                  {connections.data && connections.data.length > 0 && (
                    <section className="mt-6">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">
                        Conexões
                      </h3>
                      <div className="mt-2 space-y-1.5">
                        {connections.data.slice(0, 6).map(connection => (
                          <a
                            key={connection.provider}
                            href={connection.profileUrl ?? undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-xs text-white/70 hover:text-white"
                          >
                            {connection.avatarUrl ? (
                              <img
                                src={connection.avatarUrl}
                                alt=""
                                className="h-5 w-5 rounded object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <ExternalLink className="h-4 w-4" />
                            )}
                            <span className="truncate">
                              {connection.displayName ??
                                connection.username ??
                                connection.provider}
                            </span>
                            <ExternalLink className="ml-auto h-3 w-3 opacity-40" />
                          </a>
                        ))}
                      </div>
                    </section>
                  )}

                  <section className="mt-6">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">
                      Emblemas
                    </h3>
                    <div className="mt-2">
                      <ProfileBadges badges={badges.data} />
                    </div>
                  </section>
                  {joinedLabel && (
                    <p className="mt-6 inline-flex items-center gap-1.5 text-[11px] text-white/45">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Na Nexora desde {joinedLabel}
                    </p>
                  )}
                </div>
              </aside>

              <main
                className={cn(
                  "min-h-[560px] text-[#171923] sm:min-h-0 sm:overflow-y-auto",
                  THEME_CANVASES[profile.profileTheme] ?? THEME_CANVASES.cobalt
                )}
              >
                <div
                  className={cn(
                    "sticky top-0 z-20 flex gap-1 border-b border-black/10 px-4 pt-4 backdrop-blur sm:px-7",
                    THEME_HEADERS[profile.profileTheme] ?? THEME_HEADERS.cobalt
                  )}
                >
                  <TabButton
                    active={tab === "wall"}
                    onClick={() => setTab("wall")}
                  >
                    Mural
                  </TabButton>
                  <TabButton
                    active={tab === "activity"}
                    onClick={() => setTab("activity")}
                    count={activities.length}
                  >
                    Atividade
                  </TabButton>
                  <TabButton
                    active={tab === "wishlist"}
                    onClick={() => setTab("wishlist")}
                    count={profile.profileWishlist.length}
                  >
                    Lista de desejos
                  </TabButton>
                </div>
                <div className="space-y-4 p-4 pb-10 sm:p-7">
                  {tab === "wall" && (
                    <>
                      {profile.profileWidgets.includes("activity") &&
                        activities.length > 0 && (
                          <ProfileSection title="Agora">
                            <div className="space-y-2">
                              {activities.map(activity => (
                                <RichPresenceCard
                                  key={activity.id}
                                  activity={activity}
                                />
                              ))}
                            </div>
                          </ProfileSection>
                        )}
                      {profile.profileWidgets.includes("games") && (
                        <ProfileSection
                          title="Jogos que eu gosto"
                          subtitle={`${profile.profileGames.length}/20 jogos`}
                        >
                          {profile.profileGames.length ? (
                            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                              {profile.profileGames.slice(0, 8).map(game => (
                                <GameCard key={game.id} game={game} />
                              ))}
                            </div>
                          ) : (
                            <EmptyState
                              icon={<Gamepad2 />}
                              text="Nenhum jogo adicionado."
                            />
                          )}
                        </ProfileSection>
                      )}
                      {profile.profileWidgets.includes("favorite") && (
                        <FavoriteWidget profile={profile} />
                      )}
                      {profile.profileWidgets.includes("connections") &&
                        connections.data &&
                        connections.data.length > 0 && (
                          <ProfileSection title="Conexões">
                            <div className="grid gap-2 sm:grid-cols-2">
                              {connections.data.map(connection => (
                                <a
                                  key={connection.provider}
                                  href={connection.profileUrl ?? undefined}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 rounded-xl border border-black/8 bg-white p-3 text-xs font-bold hover:border-[#5865F2]/40"
                                >
                                  {connection.avatarUrl ? (
                                    <img
                                      src={connection.avatarUrl}
                                      alt=""
                                      className="h-8 w-8 rounded-lg object-cover"
                                    />
                                  ) : (
                                    <ExternalLink className="h-4 w-4" />
                                  )}
                                  <span className="truncate">
                                    {connection.displayName ??
                                      connection.provider}
                                  </span>
                                </a>
                              ))}
                            </div>
                          </ProfileSection>
                        )}
                    </>
                  )}
                  {tab === "activity" && (
                    <ProfileSection
                      title="Atividade recente"
                      subtitle="Até duas atividades simultâneas são exibidas."
                    >
                      {activities.length ? (
                        <div className="space-y-3">
                          {activities.map(activity => (
                            <RichPresenceCard
                              key={activity.id}
                              activity={activity}
                            />
                          ))}
                        </div>
                      ) : (
                        <EmptyState
                          icon={<Gamepad2 />}
                          text="Nenhuma atividade visível agora."
                        />
                      )}
                    </ProfileSection>
                  )}
                  {tab === "wishlist" && (
                    <ProfileSection
                      title="Lista de desejos"
                      subtitle={`${profile.profileWishlist.length} itens`}
                    >
                      {profile.profileWishlist.length ? (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {profile.profileWishlist.map(game => (
                            <GameCard key={game.id} game={game} />
                          ))}
                        </div>
                      ) : (
                        <EmptyState
                          icon={<Heart />}
                          text="A lista de desejos está vazia."
                        />
                      )}
                    </ProfileSection>
                  )}
                </div>
              </main>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <UserSettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        initialTab="profile"
      />
      {userId !== null && !isOwn && (
        <ReportDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          target={{ type: "user", id: userId, label: displayName }}
        />
      )}
    </>
  );
}

function TabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "min-h-11 whitespace-nowrap border-b-2 px-3 text-xs font-black",
        active
          ? "border-[#4654D8] text-[#343eb7]"
          : "border-transparent text-[#686c79] hover:text-[#171923]"
      )}
    >
      {children}
      {typeof count === "number" && (
        <span className="ml-1.5 text-[10px] opacity-55">{count}</span>
      )}
    </button>
  );
}

function ProfileSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-black/8 bg-[#ffffffaa] p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-black">{title}</h3>
        {subtitle && (
          <p className="mt-0.5 text-[10px] text-[#737785]">{subtitle}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="grid min-h-32 place-items-center rounded-xl border border-dashed border-black/10 bg-white/50 text-center text-[#777b89]">
      <div>
        <span className="mx-auto flex h-9 w-9 items-center justify-center">
          {icon}
        </span>
        <p className="mt-1 text-xs font-semibold">{text}</p>
      </div>
    </div>
  );
}

function GameCard({ game }: { game: PublicUser["profileGames"][number] }) {
  return (
    <div className="min-w-0">
      <div className="aspect-[3/4] overflow-hidden rounded-xl border border-black/8 bg-[#e5e7ef]">
        {game.imageUrl ? (
          <img
            src={game.imageUrl}
            alt={game.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full items-center justify-center">
            <Gamepad2 className="h-6 w-6 text-[#8b8f9d]" />
          </span>
        )}
      </div>
      <p className="mt-1.5 truncate text-[11px] font-bold" title={game.name}>
        {game.name}
      </p>
    </div>
  );
}

function FavoriteWidget({ profile }: { profile: PublicUser }) {
  const favorite = profile.profileGames.find(
    game => game.id === profile.favoriteGameId
  );
  if (!favorite) return null;
  return (
    <ProfileSection title="Jogo favorito">
      <div className="flex gap-4">
        <div className="w-20 shrink-0">
          <GameCard game={favorite} />
        </div>
        <div className="min-w-0 py-1">
          <p className="text-base font-black">{favorite.name}</p>
          <p className="mt-2 text-xs italic leading-relaxed text-[#646876]">
            {profile.favoriteGameNote || "Meu favorito no momento."}
          </p>
        </div>
      </div>
    </ProfileSection>
  );
}
