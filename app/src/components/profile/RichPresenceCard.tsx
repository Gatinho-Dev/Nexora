import { useEffect, useState } from "react";
import type { RichPresenceActivityDTO } from "@contracts/types";
import {
  ExternalLink,
  Gamepad2,
  Github,
  Music2,
  Radio,
  Youtube,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PROVIDER_LABELS: Record<string, string> = {
  spotify: "Spotify",
  youtube: "YouTube",
  twitch: "Twitch",
  github: "GitHub",
  roblox: "Roblox",
  nexora: "Nexora",
};

function ProviderIcon({
  provider,
  className,
}: {
  provider: string;
  className?: string;
}) {
  if (provider === "spotify") return <Music2 className={className} />;
  if (provider === "twitch") return <Radio className={className} />;
  if (provider === "github") return <Github className={className} />;
  if (provider === "youtube") return <Youtube className={className} />;
  return <Gamepad2 className={className} />;
}

function formatClock(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function RichPresenceCard({
  activity,
  compact = false,
  className,
}: {
  activity: RichPresenceActivityDTO;
  compact?: boolean;
  className?: string;
}) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!activity.startedAt || !activity.endsAt) return;
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, [activity.endsAt, activity.startedAt]);
  const started = activity.startedAt
    ? new Date(activity.startedAt).getTime()
    : null;
  const ends = activity.endsAt ? new Date(activity.endsAt).getTime() : null;
  const duration = started && ends ? Math.max(1, ends - started) : null;
  const progress =
    duration && started
      ? Math.min(100, Math.max(0, ((now - started) / duration) * 100))
      : null;
  const body = (
    <div
      className={cn(
        "group flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-black/15 p-3 transition-colors hover:bg-black/20",
        compact && "gap-2.5 p-2.5",
        className
      )}
      aria-label={`${PROVIDER_LABELS[activity.provider] ?? activity.provider}: ${activity.title}`}
    >
      {activity.largeImageUrl ? (
        <img
          src={activity.largeImageUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className={cn(
            "h-14 w-14 shrink-0 rounded-lg object-cover",
            compact && "h-10 w-10"
          )}
        />
      ) : (
        <span
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-white/10",
            compact && "h-10 w-10"
          )}
        >
          <ProviderIcon
            provider={activity.provider}
            className="h-5 w-5 text-white/80"
          />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/55">
          {activity.isLive && (
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
          )}
          {activity.type === "music"
            ? "Ouvindo"
            : activity.isLive
              ? "Ao vivo"
              : "Atividade"}{" "}
          · {PROVIDER_LABELS[activity.provider] ?? activity.provider}
        </span>
        <span
          className="mt-0.5 block truncate text-sm font-bold text-white"
          title={activity.title}
        >
          {activity.title}
        </span>
        {activity.details && !compact && (
          <span
            className="block truncate text-xs text-white/70"
            title={activity.details}
          >
            {activity.details}
          </span>
        )}
        {progress !== null && started && ends && !compact && (
          <span className="mt-2 block">
            <span className="block h-1 overflow-hidden rounded-full bg-white/15">
              <span
                className="block h-full rounded-full bg-white/75"
                style={{ width: `${progress}%` }}
              />
            </span>
            <span className="mt-1 flex justify-between text-[10px] tabular-nums text-white/50">
              <span>{formatClock(now - started)}</span>
              <span>{formatClock(ends - started)}</span>
            </span>
          </span>
        )}
      </span>
      {activity.externalUrl && (
        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-white/40 group-hover:text-white/80" />
      )}
    </div>
  );
  if (!activity.externalUrl) return body;
  return (
    <a
      href={activity.externalUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7383FF]"
    >
      {body}
    </a>
  );
}
