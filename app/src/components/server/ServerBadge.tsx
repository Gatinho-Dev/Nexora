import { BadgeCheck } from "lucide-react";
import type { ServerBadgeType } from "@contracts/types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const SERVER_BADGE_META: Record<
  ServerBadgeType,
  { label: string; description: string }
> = {
  partner: {
    label: "Parceiro Nexora",
    description: "Servidor oficialmente parceiro da Nexora.",
  },
};

export function ServerBadge({
  type,
  className,
  withTooltip = true,
}: {
  type: ServerBadgeType;
  className?: string;
  withTooltip?: boolean;
}) {
  const meta = SERVER_BADGE_META[type];
  const icon = (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center text-[#7383FF]",
        className,
      )}
      aria-label={meta.label}
    >
      <BadgeCheck className="h-full w-full" aria-hidden />
    </span>
  );

  if (!withTooltip) return icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{icon}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-60 border-border bg-popover text-popover-foreground">
        <p className="font-semibold">{meta.label}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {meta.description}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
