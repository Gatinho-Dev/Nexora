import type { MemberDTO, ServerDetailsDTO } from "@contracts/types";
import { Avatar } from "./Avatar";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";
import { Crown } from "lucide-react";

export function MemberList({ details }: { details: ServerDetailsDTO }) {
  const presence = useAppStore((s) => s.presence);

  const statusOf = (m: MemberDTO) => presence[m.user.id] ?? m.user.status ?? "offline";
  const online = details.members.filter((m) => statusOf(m) !== "offline");
  const offline = details.members.filter((m) => statusOf(m) === "offline");

  const roleColor = (m: MemberDTO) =>
    m.roles.length > 0
      ? [...m.roles].sort((a, b) => b.position - a.position)[0].color
      : undefined;

  return (
    <div className="w-60 shrink-0 bg-sidebar border-l border-border overflow-y-auto py-4 px-2 h-full">
      {online.length > 0 && (
        <MemberGroup label={`Online — ${online.length}`} members={online} roleColor={roleColor} dimmed={false} />
      )}
      {offline.length > 0 && (
        <MemberGroup label={`Offline — ${offline.length}`} members={offline} roleColor={roleColor} dimmed />
      )}
    </div>
  );
}

function MemberGroup({
  label,
  members,
  roleColor,
  dimmed,
}: {
  label: string;
  members: MemberDTO[];
  roleColor: (m: MemberDTO) => string | undefined;
  dimmed: boolean;
}) {
  return (
    <div className="mb-4">
      <div className="px-2 mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="space-y-0.5">
        {members.map((m) => (
          <div
            key={m.user.id}
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-hover transition-colors",
              dimmed && "opacity-50",
            )}
            title={m.user.bio ?? undefined}
          >
            <Avatar
              userId={m.user.id}
              name={m.nickname ?? m.user.name}
              src={m.user.avatar}
              size="sm"
              showStatus
            />
            <div className="min-w-0">
              <div
                className="text-sm font-medium truncate flex items-center gap-1"
                style={{ color: roleColor(m) }}
              >
                {m.nickname ?? m.user.name ?? m.user.username}
                {m.isOwner && <Crown className="h-3.5 w-3.5 text-idle shrink-0" />}
              </div>
              {m.roles.length > 0 && (
                <div className="text-[10px] text-muted-foreground truncate">
                  {[...m.roles].sort((a, b) => b.position - a.position)[0].name}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
