import { useEffect, useState } from "react";
import {
  differenceInHours,
  differenceInMinutes,
  differenceInSeconds,
} from "date-fns";
import { ExternalLink, Gamepad2 } from "lucide-react";
import type { RobloxActivityDTO } from "@contracts/types";
import { trpc } from "@/providers/trpc";
import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** "agora" | "há N min" | "há N h" a partir do início da sessão. */
function playingFor(startedAt: string | Date | null): string | null {
  if (!startedAt) return null;
  const start = new Date(startedAt);
  if (Number.isNaN(start.getTime())) return null;
  const seconds = differenceInSeconds(new Date(), start);
  if (seconds < 60) return "agora";
  const minutes = differenceInMinutes(new Date(), start);
  if (minutes < 60) return `há ${minutes} min`;
  return `há ${differenceInHours(new Date(), start)} h`;
}

/**
 * Card de atividade Roblox de um usuário.
 * A query inicial traz os dados públicos; o WS (activity:update) alimenta
 * o store e vence quando presente por ser mais fresco.
 */
export function RobloxActivityCard({ userId }: { userId: number }) {
  const query = trpc.integrations.userActivity.useQuery(
    { userId },
    { enabled: Number.isInteger(userId) && userId > 0 }
  );
  // undefined = sem evento WS ainda; null = atividade encerrada em tempo real
  const liveActivity = useAppStore(s => s.robloxActivity[userId]);
  const [, setTick] = useState(0);

  // Mantém "Jogando há X" atualizado.
  useEffect(() => {
    const id = window.setInterval(() => setTick(t => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  if (!query.isEnabled) return null;
  if (query.isLoading) {
    return (
      <div className="rounded-xl border border-white/10 bg-sidebar p-3">
        <Skeleton className="h-20 w-full rounded-lg bg-white/[0.05]" />
        <Skeleton className="mt-2.5 h-3 w-24 bg-white/[0.06]" />
        <Skeleton className="mt-1.5 h-3 w-36 bg-white/[0.06]" />
      </div>
    );
  }

  const data = query.data;
  if (!data || !data.connected) return null;

  // undefined = sem evento WS ainda (usa a query); null = atividade encerrada.
  const activity: RobloxActivityDTO | null =
    liveActivity !== undefined ? liveActivity : data.activity;

  if (!activity?.name) {
    return (
      <p className="text-[11px] text-muted2">
        Roblox · @{data.username ?? data.displayName ?? "roblox"}
      </p>
    );
  }

  return (
    <GameCard
      name={activity.name}
      thumbnailUrl={activity.thumbnailUrl}
      startedAt={activity.startedAt}
      playUrl={activity.playUrl}
      profileUrl={data.profileUrl}
      username={data.username ?? data.displayName ?? "roblox"}
    />
  );
}

function GameCard({
  name,
  thumbnailUrl,
  startedAt,
  playUrl,
  profileUrl,
  username,
}: {
  name: string;
  thumbnailUrl: string | null;
  startedAt: string | Date | null;
  playUrl: string | null;
  profileUrl: string | null;
  username: string;
}) {
  const [imgError, setImgError] = useState(false);
  const elapsed = playingFor(startedAt);
  const href = playUrl || profileUrl || "#";

  return (
    <div className="rounded-xl border border-white/10 bg-sidebar p-3 transition-[color,background-color,border-color,box-shadow] hover:border-white/20">
      {thumbnailUrl && !imgError ? (
        <img
          src={thumbnailUrl}
          alt={name}
          loading="lazy"
          onError={() => setImgError(true)}
          className="h-20 w-full rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-20 w-full items-center justify-center rounded-lg bg-white/5">
          <Gamepad2 className="h-6 w-6 text-faint" aria-hidden />
        </div>
      )}

      <p className="mt-2.5 text-[10px] font-bold uppercase tracking-wider text-faint">
        Roblox
      </p>
      <p className="truncate text-sm font-bold text-white" title={name}>
        {name}
      </p>
      {elapsed && (
        <p className="mt-0.5 truncate text-[11px] text-muted2">
          Jogando {elapsed}
        </p>
      )}
      <p className="truncate text-[11px] text-faint">Roblox • @{username}</p>

      <Button
        asChild
        variant="secondary"
        size="sm"
        className="mt-3 h-8 w-full rounded-lg border border-white/10 bg-white/[0.06] text-xs font-semibold text-white hover:bg-white/[0.12]"
      >
        <a href={href} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-3.5 w-3.5" />
          Ver jogo
        </a>
      </Button>
    </div>
  );
}

/** Linha compacta para listas (amigos/membros). Só usa o store — sem fetch. */
export function RobloxActivityInline({ userId }: { userId: number }) {
  const activity = useAppStore(s => s.robloxActivity[userId]);
  if (!activity?.name) return null;
  const elapsed = playingFor(activity.startedAt);
  return (
    <p
      className="flex min-w-0 items-center gap-1 text-[11px] text-[#7383FF]"
      title={`Jogando ${activity.name}${elapsed ? ` (${elapsed})` : ""} no Roblox`}
    >
      <Gamepad2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate">{activity.name}</span>
    </p>
  );
}
