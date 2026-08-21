import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAppStore } from "@/store/useAppStore";
import { ChannelSidebar } from "@/components/ChannelSidebar";
import { MemberList } from "@/components/MemberList";
import { ChatArea } from "@/components/chat/ChatArea";
import { VoiceView } from "@/components/VoiceView";
import { SidebarPortal } from "@/components/SidebarPortal";
import { NotificationsBell } from "@/components/NotificationsBell";
import { Hash, Volume2, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function ServerChannel() {
  const params = useParams();
  const navigate = useNavigate();
  const serverId = Number(params.serverId);
  const channelIdParam = params.channelId ?? "first";
  const me = trpc.auth.me.useQuery().data;
  const membersOpen = useAppStore((s) => s.membersOpen);
  const setMembersOpen = useAppStore((s) => s.setMembersOpen);
  const [desktopMembers, setDesktopMembers] = useState(true);

  const details = trpc.server.get.useQuery(
    { serverId },
    { enabled: Number.isFinite(serverId) && serverId > 0, retry: false },
  );

  // "/channels/:id/first" redirects to the first text channel
  useEffect(() => {
    if (channelIdParam === "first" && details.data) {
      const firstText = [...details.data.channels]
        .filter((c) => c.type === "TEXT")
        .sort((a, b) => a.position - b.position)[0];
      const firstAny = [...details.data.channels].sort((a, b) => a.position - b.position)[0];
      const target = firstText ?? firstAny;
      if (target) navigate(`/channels/${serverId}/${target.id}`, { replace: true });
    }
  }, [channelIdParam, details.data, navigate, serverId]);

  if (details.error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold">Servidor não encontrado</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Você não é membro deste servidor ou ele foi excluído.
          </p>
          <button
            onClick={() => navigate("/channels/@me")}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Voltar ao início
          </button>
        </div>
      </div>
    );
  }

  if (!details.data || !me) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="pulsar-mark h-10 w-10 animate-pulse rounded-xl" />
      </div>
    );
  }

  const channel = details.data.channels.find((c) => c.id === Number(channelIdParam));
  const canManageMessages = details.data.myPermissions.includes("MANAGE_MESSAGES");
  const canRead = details.data.myPermissions.includes("READ_MESSAGES");

  const header = channel ? (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
      {channel.type === "VOICE" ? (
        <Volume2 className="h-5 w-5 text-muted-foreground shrink-0" />
      ) : (
        <Hash className="h-5 w-5 text-muted-foreground shrink-0" />
      )}
      <span className="font-semibold truncate">{channel.name}</span>
      <div className="ml-auto flex items-center gap-1">
        <div className="hidden md:block">
          <NotificationsBell />
        </div>
        {channel.type === "TEXT" && (
          <button
            onClick={() => setDesktopMembers(!desktopMembers)}
            className={cn(
              "hidden md:flex rounded-md p-1.5 text-muted-foreground hover:bg-[var(--hover-bg)]",
              desktopMembers && "text-foreground",
            )}
            title="Lista de membros"
          >
            <Users className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className="flex flex-1 min-h-0">
      <SidebarPortal>
        <ChannelSidebar details={details.data} />
      </SidebarPortal>

      <div className="flex min-w-0 flex-1 flex-col">
        {!channel ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Selecione um canal
          </div>
        ) : channel.type === "VOICE" ? (
          <>
            {header}
            <VoiceView channelId={channel.id} serverId={serverId} title={channel.name} />
          </>
        ) : canRead ? (
          <ChatArea
            channelId={channel.id}
            placeholder={`Conversar em #${channel.name}`}
            members={details.data.members.map((m) => ({
              id: m.user.id,
              username: m.user.username,
              name: m.user.name,
            }))}
            myId={me.id}
            canManageMessages={canManageMessages}
            header={header}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Você não tem permissão para ler este canal.
          </div>
        )}
      </div>

      {/* Member list: desktop side panel */}
      {channel?.type === "TEXT" && desktopMembers && (
        <div className="hidden md:flex h-full shrink-0">
          <MemberList details={details.data} />
        </div>
      )}

      {/* Member list: mobile overlay */}
      {channel?.type === "TEXT" && membersOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMembersOpen(false)} />
          <div className="absolute right-0 top-0 h-full shadow-2xl">
            <div className="flex h-full flex-col bg-[var(--sidebar-bg)]">
              <div className="flex h-12 items-center justify-between border-b border-border px-4">
                <span className="text-sm font-semibold">Membros</span>
                <button
                  onClick={() => setMembersOpen(false)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-[var(--hover-bg)]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <MemberList details={details.data} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
