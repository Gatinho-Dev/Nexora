import { Crown, Orbit, Sparkles } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { cn } from "@/lib/utils";

export function ProfileAvatar({
  userId,
  name,
  src,
  decoration = "none",
  status,
  size = "xl",
  className,
}: {
  userId?: number;
  name?: string | null;
  src?: string | null;
  decoration?: string | null;
  status?: string;
  size?: "lg" | "xl" | "2xl";
  className?: string;
}) {
  const iconClass =
    "pointer-events-none absolute z-20 text-white drop-shadow-md";
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <span
        className={cn(
          "rounded-full",
          decoration === "orbit" &&
            "ring-2 ring-cyan-300/80 ring-offset-4 ring-offset-transparent",
          decoration === "sparkles" && "ring-2 ring-violet-300/80",
          decoration === "crown" && "ring-2 ring-amber-300/80"
        )}
      >
        <Avatar
          userId={userId}
          name={name}
          src={src}
          size={size}
          statusOverride={status}
          showStatus={Boolean(status)}
        />
      </span>
      {decoration === "sparkles" && (
        <Sparkles
          className={cn(iconClass, "-right-2 -top-2 h-7 w-7 text-violet-200")}
          aria-hidden
        />
      )}
      {decoration === "crown" && (
        <Crown
          className={cn(
            iconClass,
            "-top-5 left-1/2 h-8 w-8 -translate-x-1/2 text-amber-300"
          )}
          aria-hidden
        />
      )}
      {decoration === "orbit" && (
        <Orbit
          className={cn(iconClass, "-bottom-2 -right-2 h-7 w-7 text-cyan-200")}
          aria-hidden
        />
      )}
    </span>
  );
}
