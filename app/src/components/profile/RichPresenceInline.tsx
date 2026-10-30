import type { RichPresenceActivityDTO } from "@contracts/types";
import { Code2, Gamepad2, Music2, Radio, Sparkles, Tv2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function RichPresenceInline({
  activity,
  className,
}: {
  activity: RichPresenceActivityDTO;
  className?: string;
}) {
  const Icon =
    activity.type === "music"
      ? Music2
      : activity.type === "gaming"
        ? Gamepad2
        : activity.type === "streaming"
          ? Radio
          : activity.type === "watching"
            ? Tv2
            : activity.type === "coding"
              ? Code2
              : Sparkles;
  const provider =
    activity.provider.charAt(0).toUpperCase() + activity.provider.slice(1);
  const summary = activity.details
    ? `${activity.title} — ${activity.details}`
    : activity.title;

  return (
    <span
      className={cn(
        "mt-0.5 flex min-w-0 items-center gap-1 truncate text-[11px] leading-3.5 text-primary",
        className
      )}
      aria-label={`${provider}: ${summary}`}
      title={`${provider}: ${summary}`}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      <span className="truncate">{summary}</span>
      {activity.isLive && (
        <span className="shrink-0 rounded bg-red-500/15 px-1 text-[8px] font-black uppercase text-red-400">
          Ao vivo
        </span>
      )}
    </span>
  );
}
