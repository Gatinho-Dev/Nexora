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
import { cn } from "@/lib/utils";
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

  const details = trpc.server.get.useQuery(
    { serverId },
    {
      enabled: Number.isFinite(serverId) && serverId > 0,
      retry: false,
      placeholderData: prev => prev,
    }
  );

  useEffect(() => {
    if (channelIdParam === "first" && details.data) {
      const firstText = [...details.data.channels]
        .filter(c => c.type === "TEXT")
        .sort((a, b) => a.position - b.position)[0];
      const firstAny = [...details.data.channels].sort(
        (a, b) => a.position - b.position
      )[0];
      const target = firstText ?? firstAny;
      if (target)
        navigate(`/channels/${serverId}/${target.id}`, { replace: true });
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
          <div className="flex flex-1 items-center justify-center text-sm text-muted2 bg-chat">
            Selecione um canal para começar a conversar na Nexora.
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
        ) : channel.type === "FORUM" ? (
          <>
            {header}
            <ForumView channelId={channel.id} />
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
