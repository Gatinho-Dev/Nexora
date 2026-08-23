import { useState } from "react";
import { useNavigate } from "react-router";
import type { PublicUser } from "@contracts/types";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useAppStore } from "@/store/useAppStore";
import { Avatar } from "./Avatar";
import { NexoraMark } from "./NexoraBrand";
import { UserSettingsModal } from "./modals/UserSettingsModal";
import { statusColor } from "@/lib/statusColor";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BadgeCheck,
  CalendarDays,
  Check,
  Clock3,
  Loader2,
  MessageSquare,
  Pencil,
  ShieldCheck,
  Sparkles,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";

type ProfileBadgeData = {
  id?: number;
  slug?: string;
  label: string;
  description?: string | null;
  color?: string | null;
  isStaff?: boolean;
};

type ProfileDetails = PublicUser & {
  banner?: string | null;
  createdAt?: string | Date | null;
  badges?: ProfileBadgeData[];
};

const STATUS_LABELS: Record<string, string> = {
  online: "Online",
  idle: "Ausente",
  dnd: "Não perturbe",
  invisible: "Invisível",
  offline: "Offline",
};

function badgeColor(value?: string | null) {
  return value && /^#[\da-f]{6}$/i.test(value) ? value : "#7383FF";
}

function ProfileBanner({ profile }: { profile: ProfileDetails | null }) {
  if (profile?.banner) {
    return (
      <img
        src={profile.banner}
        alt={`Banner de ${profile.name ?? profile.username ?? "usuário"}`}
        className="h-full w-full object-cover"
      />
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#1B2037]">
      <NexoraMark
        decorative
        className="absolute -right-7 -top-10 h-52 w-52 rotate-6 opacity-[0.12]"
      />
      <div className="absolute bottom-0 left-0 h-1 w-2/3 bg-[#4654D8]" />
      <div className="absolute bottom-0 right-0 h-1 w-1/3 bg-[#7383FF]" />
    </div>
  );
}

function ProfileBadges({ badges }: { badges?: ProfileBadgeData[] }) {
  if (!badges?.length) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.025] px-3.5 py-3 text-left">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-[#949BA4]">
          <BadgeCheck className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#DBDEE1]">
            Espaço para emblemas
          </p>
          <p className="mt-0.5 text-[11px] leading-4 text-[#949BA4]">
            Emblemas oficiais aparecerão aqui quando forem concedidos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2" aria-label="Emblemas do perfil">
      {badges.map((badge, index) => {
        const color = badgeColor(badge.color);
        const Icon = badge.isStaff ? ShieldCheck : Sparkles;
        return (
          <span
            key={badge.id ?? badge.slug ?? `${badge.label}-${index}`}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold"
            style={{
              borderColor: `${color}66`,
              backgroundColor: `${color}1f`,
              color,
            }}
            title={badge.description ?? badge.label}
          >
            <Icon className="h-3.5 w-3.5" />
            {badge.label}
          </span>
        );
      })}
    </div>
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
  const liveStatus = useAppStore(s =>
    userId ? s.presence[userId] : undefined
  );

  const profile = (query.data ?? null) as ProfileDetails | null;
  const isOwn = !!me && userId === me.id;
  const friendship = friends.data?.find(item => item.user.id === userId);

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

  const currentStatus = liveStatus ?? profile?.status ?? "offline";
  const displayName = profile?.name ?? profile?.username ?? "Usuário Nexora";
  const joinedLabel = profile?.createdAt
    ? new Intl.DateTimeFormat("pt-BR", {
        month: "long",
        year: "numeric",
      }).format(new Date(profile.createdAt))
    : null;

  const openProfileSettings = () => {
    onClose();
    requestAnimationFrame(() => setSettingsOpen(true));
  };

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
          className="max-h-[92dvh] w-[min(720px,calc(100vw-1rem))] max-w-none gap-0 overflow-y-auto rounded-2xl border-white/10 bg-[#1E2028] p-0 text-white shadow-2xl sm:max-w-[720px]"
        >
          <DialogTitle className="sr-only">Perfil de {displayName}</DialogTitle>
          <DialogDescription className="sr-only">
            Informações públicas e ações disponíveis para este perfil da Nexora.
          </DialogDescription>

          <div className="relative h-32 shrink-0 sm:h-44">
            <ProfileBanner profile={profile} />
            <DialogClose asChild>
              <button
                type="button"
                className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#11131A]/80 text-[#DBDEE1] transition-colors hover:bg-[#11131A] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7383FF]"
                aria-label="Fechar perfil"
                title="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
          </div>

          {query.isLoading ? (
            <div className="space-y-5 px-5 pb-7 sm:px-8">
              <div className="-mt-12 h-24 w-24 animate-pulse rounded-full border-[6px] border-[#1E2028] bg-[#343743] sm:h-28 sm:w-28" />
              <div className="h-6 w-52 animate-pulse rounded bg-white/10" />
              <div className="h-28 animate-pulse rounded-xl bg-white/[0.05]" />
            </div>
          ) : query.error || !profile ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-semibold text-white">
                Não foi possível abrir este perfil.
              </p>
              <p className="mt-1 text-xs text-[#949BA4]">
                {query.error?.message ?? "O usuário não está mais disponível."}
              </p>
            </div>
          ) : (
            <div className="relative px-5 pb-6 sm:px-8 sm:pb-8">
              <div className="-mt-12 flex items-end justify-between gap-4 sm:-mt-14">
                <div className="rounded-full border-[6px] border-[#1E2028] bg-[#1E2028] shadow-xl">
                  <Avatar
                    userId={profile.id}
                    name={displayName}
                    src={profile.avatar}
                    size="2xl"
                    showStatus
                    statusOverride={currentStatus}
                  />
                </div>

                <div className="mb-1 flex flex-wrap justify-end gap-2">
                  {isOwn ? (
                    <Button
                      onClick={openProfileSettings}
                      className="h-10 rounded-lg bg-[#4654D8] px-4 text-xs font-semibold text-white hover:bg-[#3D49BF]"
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar perfil
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={() => userId && openDm.mutate({ userId })}
                        disabled={openDm.isPending}
                        className="h-10 rounded-lg bg-[#4654D8] px-4 text-xs font-semibold text-white hover:bg-[#3D49BF]"
                      >
                        {openDm.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <MessageSquare className="mr-2 h-4 w-4" />
                        )}
                        Mensagem
                      </Button>

                      {!friendship && profile.username && (
                        <Button
                          variant="secondary"
                          onClick={() =>
                            sendRequest.mutate({ username: profile.username! })
                          }
                          disabled={sendRequest.isPending}
                          className="h-10 rounded-lg border border-white/10 bg-white/[0.07] px-4 text-xs font-semibold text-white hover:bg-white/[0.12]"
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          Adicionar
                        </Button>
                      )}

                      {friendship?.status === "PENDING" &&
                        friendship.direction === "incoming" && (
                          <Button
                            variant="secondary"
                            onClick={() =>
                              acceptRequest.mutate({
                                friendshipId: friendship.friendshipId,
                              })
                            }
                            disabled={acceptRequest.isPending}
                            className="h-10 rounded-lg border border-[#3BA55D]/30 bg-[#3BA55D]/15 px-4 text-xs font-semibold text-[#57D984] hover:bg-[#3BA55D]/25"
                          >
                            <Check className="mr-2 h-4 w-4" />
                            Aceitar pedido
                          </Button>
                        )}
                    </>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h2 className="truncate text-xl font-bold tracking-[-0.02em] text-white sm:text-2xl">
                    {displayName}
                  </h2>
                  {friendship?.status === "ACCEPTED" && !isOwn && (
                    <span
                      className="inline-flex items-center gap-1 rounded-md bg-[#3BA55D]/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#57D984]"
                      title="Vocês são amigos"
                    >
                      <Check className="h-3 w-3" /> Amigos
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#B5BAC1]">
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

              <div className="mt-6 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.72fr)]">
                <section className="rounded-xl border border-white/[0.08] bg-[#171920] p-4 sm:p-5">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#949BA4]">
                    Sobre mim
                  </h3>
                  <p
                    className={cn(
                      "mt-2 whitespace-pre-wrap text-sm leading-6",
                      profile.bio ? "text-[#DBDEE1]" : "text-[#777E8B]"
                    )}
                  >
                    {profile.bio ||
                      "Este usuário ainda não adicionou uma biografia."}
                  </p>
                </section>

                <section className="rounded-xl border border-white/[0.08] bg-[#171920] p-4 sm:p-5">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#949BA4]">
                    Emblemas
                  </h3>
                  <div className="mt-2.5">
                    <ProfileBadges badges={badges.data} />
                  </div>
                </section>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/[0.07] pt-4 text-[11px] text-[#949BA4]">
                {joinedLabel ? (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-[#7383FF]" />
                    Na Nexora desde {joinedLabel}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="h-3.5 w-3.5 text-[#7383FF]" />
                    Perfil Nexora
                  </span>
                )}
                {friendship?.status === "PENDING" &&
                  friendship.direction === "outgoing" && (
                    <span>Pedido de amizade enviado</span>
                  )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <UserSettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        initialTab="profile"
      />
    </>
  );
}
