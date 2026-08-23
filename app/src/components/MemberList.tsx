import type { MemberDTO, ServerDetailsDTO } from "@contracts/types";
import { Avatar } from "./Avatar";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";
import { Crown } from "lucide-react";

export function MemberList({
  details,
  onOpenProfile,
  onOpenContextMenu,
}: {
  details: ServerDetailsDTO;
  onOpenProfile?: (userId: number) => void;
  onOpenContextMenu?: (e: React.MouseEvent, type: "user", id: number) => void;
}) {
  const presence = useAppStore(s => s.presence);

  const statusOf = (m: MemberDTO) =>
    presence[m.user.id] ?? m.user.status ?? "offline";

  // Group members by top role, or by online/offline status
  const topRoleOf = (m: MemberDTO) => {
    if (m.isOwner) return { name: "ADMIN", position: 999, color: "#5865F2" };
    if (m.roles.length > 0) {
      const sorted = [...m.roles].sort((a, b) => b.position - a.position);
      return sorted[0];
    }
    return { name: "MEMBROS", position: 0, color: undefined };
  };

  const roleGroups = new Map<
    string,
    { name: string; position: number; members: MemberDTO[] }
  >();

  details.members.forEach(m => {
    const role = topRoleOf(m);
    const group = roleGroups.get(role.name) ?? {
      name: role.name,
      position: role.position,
      members: [],
    };
    group.members.push(m);
    roleGroups.set(role.name, group);
  });

  const sortedGroups = Array.from(roleGroups.values()).sort(
    (a, b) => b.position - a.position
  );

  return (
    <aside
      aria-label="Lista de membros"
      className="w-60 shrink-0 bg-sidebar border-l border-black/20 overflow-y-auto py-4 px-2 h-full select-none"
    >
      {sortedGroups.map(group => {
        const online = group.members.filter(m => statusOf(m) !== "offline");
        const offline = group.members.filter(m => statusOf(m) === "offline");

        if (online.length === 0 && offline.length === 0) return null;

        return (
          <div key={group.name} className="mb-4">
            <div className="px-2 mb-1.5 text-[11px] font-bold uppercase tracking-wide text-faint flex items-center justify-between">
              <span>
                {group.name} - {group.members.length}
              </span>
            </div>

            {/* Online Members */}
            <div className="space-y-0.5">
              {online.map(m => (
                <MemberRow
                  key={m.user.id}
                  member={m}
                  status={statusOf(m)}
                  onOpenProfile={onOpenProfile}
                  onOpenContextMenu={onOpenContextMenu}
                />
              ))}

              {/* Offline Members */}
              {offline.map(m => (
                <MemberRow
                  key={m.user.id}
                  member={m}
                  status="offline"
                  dimmed
                  onOpenProfile={onOpenProfile}
                  onOpenContextMenu={onOpenContextMenu}
                />
              ))}
            </div>
          </div>
        );
      })}
    </aside>
  );
}

function MemberRow({
  member,
  status,
  dimmed,
  onOpenProfile,
  onOpenContextMenu,
}: {
  member: MemberDTO;
  status: string;
  dimmed?: boolean;
  onOpenProfile?: (userId: number) => void;
  onOpenContextMenu?: (e: React.MouseEvent, type: "user", id: number) => void;
}) {
  const topRole =
    member.roles.length > 0
      ? [...member.roles].sort((a, b) => b.position - a.position)[0]
      : undefined;

  return (
    <button
      type="button"
      onClick={() => onOpenProfile?.(member.user.id)}
      onContextMenu={e => {
        e.preventDefault();
        onOpenContextMenu?.(e, "user", member.user.id);
      }}
      className={cn(
        "flex min-h-11 w-full items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-hov cursor-pointer transition-colors group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7383FF]",
        dimmed && "opacity-40 saturate-[0.4] hover:opacity-100 hover:saturate-100"
      )}
      aria-label={`Ver perfil de ${member.nickname ?? member.user.name ?? member.user.username ?? "usuário"}`}
      title="Ver perfil"
    >
      <Avatar
        userId={member.user.id}
        name={member.nickname ?? member.user.name}
        src={member.user.avatar}
        size="sm"
        showStatus
        statusOverride={status}
      />
      <div className="min-w-0 flex-1">
        <div
          className="text-xs font-semibold truncate flex items-center gap-1 group-hover:text-foreground transition-colors"
          style={{ color: topRole?.color || undefined }}
        >
          <span>
            {member.nickname ?? member.user.name ?? member.user.username}
          </span>
          {member.isOwner && (
            <Crown className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          )}
        </div>
        {topRole && (
          <div className="text-[10px] text-faint truncate">
            {topRole.name}
          </div>
        )}
      </div>
    </button>
  );
}
