import { cn } from "@/lib/utils";

export function UnreadIndicator({
  visible,
  className,
}: {
  visible: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex w-2 shrink-0 items-center justify-start",
        className,
      )}
    >
      {visible && <span className="dm-unread-pulse h-2 w-1 rounded-r-full" />}
    </span>
  );
}
