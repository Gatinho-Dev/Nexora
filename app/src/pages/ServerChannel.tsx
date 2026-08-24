import { useEffect, useState } from "react";
import { useNavigate, useParams, useOutletContext } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAppStore } from "@/store/useAppStore";
import { ChannelSidebar } from "@/components/ChannelSidebar";
import { MemberList } from "@/components/MemberList";
import { ChatArea } from "@/components/chat/ChatArea";
import { VoiceView } from "@/components/VoiceView";
import { ForumView } from "@/components/ForumView";
import { SidebarPortal } from "@/components/SidebarPortal";
import { NotificationsBell } from "@/components/NotificationsBell";
import { Users, X, ArrowLeft } from "lucide-react";
import {
  IconHash,
  IconVoice,
  IconForum,
  IconMegaphone,
} from "@/components/icons/channelIcons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { AppOutletContext } from "@/lib/appOutletContext";

export function ServerChannel() {
  const params = useParams();
  const navigate = useNavigate();
  const { onOpenContextMenu, onOpenProfile } =
    useOutletContext<AppOutletContext>();
  const serverId = Number(params.serverId);
  const channelIdParam = params.channelId ?? "first";
  const me = trpc.auth.me.useQuery().data;
  const membersOpen = useAppStore(s => s.membersOpen);
  const setMembersOpen = useAppStore(s => s.setMembersOpen);
  const [desktopMembers, setDesktopMembers] = useState(true);
  const [followOpen, setFollowOpen] = useState(false);
  const follow = trpc.announce.follow.useMutation({
    onSuccess: () => {
      toast.success("Seguindo canal de anúncios.");
      setFollowOpen(false);
    },
    onError: e => toast.error(e.message),
  });
  const myServers = trpc.server.list.useQuery();
  const [followServerId, setFollowServerId] = useState<number | null>(null);
  const followTargetChannels =
    followServerId != null
      ? trpc.server.get.useQuery(
          { serverId: followServerId },
          { enabled: followServerId != null }
        ).data?.channels.filter(c =>
            ["TEXT", "ANNOUNCEMENT", "FORUM", "MEDIA"].includes(c.type)
          ) ?? []
      : [];
  const [followChannelId, setFollowChannelId] = useState<number | null>(null);


  const details = trpc.server.get.useQuery(
    { serverId },
    {
      enabled: Number.isFinite(serverId) && serverId > 0,
      retry: false,
      placeholderData: prev => prev,
    }
  );

  const firstTextLike = (channels: { id: number; type: string }[]) =>
    channels
      .filter(c => ["TEXT", "ANNOUNCEMENT", "FORUM", "MEDIA"].includes(c.type))
      .sort((a, b) => a.id - b.id)[0];

  useEffect(() => {
    if (!details.data) return;
    const channels = details.data.channels;
    if (channelIdParam === "first") {
      const target =
        channels.find(c => c.type === "TEXT") ?? firstTextLike(channels);
      if (target) {
        navigate(`/channels/${serverId}/${target.id}`, { replace: true });
      }
      return;
    }
    // Canal salvo/deep-link não existe mais (deletado/arquivado/sem acesso):
    // resgata para o primeiro canal visível em vez de tela vazia.
    const current = channels.find(c => c.id === Number(channelIdParam));
    if (!current && Number.isFinite(Number(channelIdParam))) {
      const target = firstTextLike(channels);
      if (target) {
        navigate(`/channels/${serverId}/${target.id}`, { replace: true });
      }
    }
  }, [channelIdParam, details.data, navigate, serverId]);

  if (details.error) {
    return (
      <div className="flex flex-1 items-center justify-center bg-chat text-foreground">
        <div className="text-center p-6 rounded-xl bg-sidebar border border-black/20 shadow-xl max-w-sm">
          <p className="text-lg font-bold text-foreground">
            Comunidade não encontrada
          </p>
          <p className="mt-1 text-xs text-muted2">
            Você não é membro desta comunidade na Nexora ou ela foi movida.
          </p>
          <button
            onClick={() => navigate("/channels/@me")}
            className="mt-4 rounded-md bg-[#5865F2] hover:bg-[#4752C4] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Voltar ao início
          </button>
        </div>
      </div>
    );
  }

  if (!details.data || !me) {
    return (
      <div className="flex flex-1 items-center justify-center bg-chat">
        <div className="h-10 w-10 rounded-xl bg-[#5865F2] flex items-center justify-center font-bold text-white animate-pulse">
          N
        </div>
      </div>
    );
  }

  const channel = details.data.channels.find(
    c => c.id === Number(channelIdParam)
  );
  const canManageMessages =
    details.data.myPermissions.includes("MANAGE_MESSAGES");
  const canRead = details.data.myPermissions.includes("READ_MESSAGES");

  const header = channel ? (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-black/20 px-4 bg-chat text-foreground select-none shadow-sm">
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={() => navigate(`/channels/${serverId}`)}
          className="-ml-1 rounded p-1 text-muted2 hover:bg-white/10 hover:text-foreground md:hidden"
          aria-label="Voltar aos canais"
          title="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        {channel.type === "VOICE" ? (
          <IconVoice className="h-5 w-5 text-emerald-400 shrink-0" />
        ) : channel.type === "STAGE" ? (
          <IconMegaphone className="h-5 w-5 text-emerald-400 shrink-0" />
        ) : channel.type === "FORUM" ? (
          <IconForum className="h-[22px] w-[22px] text-faint shrink-0" />
        ) : channel.type === "ANNOUNCEMENT" ? (
          <IconMegaphone className="h-[22px] w-[22px] text-faint shrink-0" />
        ) : (
          <IconHash className="h-[22px] w-[22px] text-faint shrink-0" />
        )}
        <span className="font-bold text-sm truncate">{channel.name}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {channel.type === "ANNOUNCEMENT" && (
          <button
            onClick={() => setFollowOpen(true)}
            className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-bold text-bodyx hover:bg-white/20 transition-colors"
            title="Gerenciar servidores seguidores"
          >
            Seguidores
          </button>
        )}
        <div className="hidden md:block">
          <NotificationsBell onOpenProfile={onOpenProfile} />
        </div>
        {channel.type === "TEXT" && (
          <button
            onClick={() => setDesktopMembers(!desktopMembers)}
            className={cn(
              "hidden md:flex rounded-lg p-1.5 text-muted2 hover:bg-black/[0.06] hover:text-foreground transition-colors",
              desktopMembers && "bg-white/10 text-foreground"
            )}
            title="Lista de membros"
          >
            <Users className="h-4 w-4" />
          </button>
        )}
      </div>
    </header>
  ) : null;

  return (
    <div className="flex flex-1 min-h-0">
      <SidebarPortal>
        <ChannelSidebar
          details={details.data}
          onOpenContextMenu={onOpenContextMenu}
          onOpenProfile={onOpenProfile}
        />
      </SidebarPortal>

      <div className="flex min-w-0 flex-1 flex-col">
        {!channel ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 text-sm text-muted2 bg-chat px-6 text-center select-none">
            <p className="font-semibold text-foreground">
              Nenhum canal por aqui
            </p>
            <p>
              {details.data.channels.length === 0
                ? "Você não tem permissão para ver os canais desta comunidade. Fale com um administrador."
                : "Selecione um canal na barra lateral para começar a conversar."}
            </p>
          </div>
        ) : channel.type === "VOICE" || channel.type === "STAGE" ? (
          <>
            {header}
            <VoiceView
              channelId={channel.id}
              serverId={serverId}
              title={channel.name}
              isStage={channel.type === "STAGE"}
              permissions={details.data.myPermissions}
              onOpenProfile={onOpenProfile}
            />
          </>
        ) : channel.type === "FORUM" || channel.type === "MEDIA" ? (
          <>
            {header}
            <ForumView
              channelId={channel.id}
              channelType={channel.type === "MEDIA" ? "MEDIA" : "FORUM"}
              tags={channel.tags ?? null}
              forcedTags={channel.forcedTags}
            />
          </>
        ) : canRead ? (
          <ChatArea
            channelId={channel.id}
            placeholder={`Mensagem em #${channel.name}`}
            members={details.data.members.map(m => ({
              id: m.user.id,
              username: m.user.username,
              name: m.user.name,
            }))}
            myId={me.id}
            canManageMessages={canManageMessages}
            channelType={channel.type}
            canPublish={canManageMessages}
            onOpenProfile={onOpenProfile}
            header={header}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted2 bg-chat">
            Você não possui permissão para ver este canal.
          </div>
        )}
      </div>

      {followOpen && channel?.type === "ANNOUNCEMENT" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setFollowOpen(false)} />
          <div className="relative w-full max-w-md rounded-t-2xl border border-white/10 bg-panel p-4 pb-[calc(env(safe-area-inset-bottom)+16px)] shadow-2xl sm:rounded-2xl animate-in slide-in-from-bottom duration-200">
            <h3 className="text-base font-bold">Seguir canal de anúncios</h3>
            <p className="mt-1 text-xs text-muted2">
              Escolha um de seus outros servidores e o canal que receberá as
              publicações de <b>#{channel.name}</b>.
            </p>
            <div className="mt-3 space-y-2">
              <select
                value={followServerId ?? ""}
                onChange={e => {
                  const id = Number(e.target.value);
                  setFollowServerId(id || null);
                  setFollowChannelId(null);
                }}
                aria-label="Servidor que vai seguir"
                className="min-h-[44px] w-full rounded-[4px] bg-input px-3 text-sm"
              >
                <option value="">Selecione seu servidor...</option>
                {myServers.data
                  ?.filter(sv => sv.id !== serverId)
                  .map(sv => (
                    <option key={sv.id} value={sv.id}>
                      {sv.name}
                    </option>
                  ))}
              </select>
              {followServerId != null && followTargetChannels.length > 0 && (
                <select
                  value={followChannelId ?? ""}
                  onChange={e => setFollowChannelId(Number(e.target.value) || null)}
                  aria-label="Canal que receberá as publicações"
                  className="min-h-[44px] w-full rounded-[4px] bg-input px-3 text-sm"
                >
                  <option value="">Canal que receberá os posts...</option>
                  {followTargetChannels.map(c => (
                    <option key={c.id} value={c.id}>
                      #{c.name}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={() => setFollowOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  disabled={!followServerId || !followChannelId || follow.isPending}
                  onClick={() =>
                    follow.mutate({
                      sourceChannelId: channel!.id,
                      targetChannelId: followChannelId!,
                    })
                  }
                  className="bg-[#5865F2] hover:bg-[#4752C4]"
                >
                  Seguir
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Member list side panel */}
      {channel?.type === "TEXT" && desktopMembers && (
        <div className="hidden md:flex h-full shrink-0">
          <MemberList
            details={details.data}
            onOpenProfile={onOpenProfile}
            onOpenContextMenu={onOpenContextMenu}
          />
        </div>
      )}

      {/* Mobile Member Overlay */}
      {channel?.type === "TEXT" && membersOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMembersOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full shadow-2xl">
            <div className="flex h-full flex-col bg-sidebar text-foreground">
              <div className="flex h-12 items-center justify-between border-b border-white/5 px-4">
                <span className="text-xs font-bold uppercase tracking-wider">
                  Membros
                </span>
                <button
                  onClick={() => setMembersOpen(false)}
                  className="rounded-lg p-1 text-muted2 hover:bg-black/[0.06] hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <MemberList
                details={details.data}
                onOpenProfile={onOpenProfile}
                onOpenContextMenu={onOpenContextMenu}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
