import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import { statusColor } from "@/lib/statusColor";

type Props = {
  /** Convenience: derive userId/name/src from a user-like object. */
  user?: { id: number; name: string | null; avatar: string | null } | null;
  userId?: number;
  name?: string | null;
  src?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  showStatus?: boolean;
  statusOverride?: string;
  className?: string;
  /**
   * Discord-style status dots carry a solid border that must match the
   * surrounding surface color (creates the "notch" illusion).
   */
  statusBorderColor?: string;
};

const sizes = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-20 w-20 text-2xl",
  "2xl": "h-24 w-24 text-3xl sm:h-28 sm:w-28",
};

// Spec: base dot is 10x10px with a 3px surface-colored border; scale up for
// larger avatars.
const dotSizes = {
  xs: "h-[10px] w-[10px] border-2",
  sm: "h-[13px] w-[13px] border-[3px]",
  md: "h-[14px] w-[14px] border-[3px]",
  lg: "h-4 w-4 border-[3px]",
  xl: "h-[18px] w-[18px] border-[3px]",
  "2xl": "h-6 w-6 border-4",
};

export function Avatar({
  user,
  userId: userIdProp,
  name: nameProp,
  src: srcProp,
  size = "md",
  showStatus = false,
  statusOverride,
  className,
  statusBorderColor,
}: Props) {
  const userId = user?.id ?? userIdProp;
  const name = user ? user.name : nameProp;
  const src = user ? user.avatar : srcProp;
  const liveStatus = useAppStore(s =>
    userId ? s.presence[userId] : undefined
  );
  const status = statusOverride ?? liveStatus;
  const initial = (name ?? "?").trim().charAt(0).toUpperCase() || "?";

  return (
    <div className={cn("relative shrink-0", className)}>
      <div
        className={cn(
          "rounded-full overflow-hidden flex items-center justify-center bg-secondary font-semibold select-none",
          sizes[size]
        )}
      >
        {src ? (
          <img
            src={src}
            alt={name ?? "avatar"}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : null}
        {!src && <span>{initial}</span>}
      </div>
      {showStatus && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full border-card",
            dotSizes[size],
            statusColor(status)
          )}
          style={{ borderColor: statusBorderColor ?? "hsl(var(--card))" }}
        />
      )}
    </div>
  );
}
