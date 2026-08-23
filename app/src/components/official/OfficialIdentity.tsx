import { BadgeCheck } from "lucide-react";
import { IconOfficial } from "../icons/figmaChannelIcons";
import { NexoraAppIcon } from "@/components/NexoraBrand";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type OfficialIdentityProps = {
  compact?: boolean;
  className?: string;
};

export function OfficialIdentity({ compact = false, className }: OfficialIdentityProps) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <div className="relative shrink-0">
        <NexoraAppIcon className={compact ? "h-8 w-8" : "h-10 w-10"} />
        <span
          className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-[#24262c] bg-[#5865F2] text-white"
          aria-hidden="true"
        >
          <IconOfficial className="h-3 w-3 text-white" />
        </span>
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={cn("truncate font-semibold text-white", compact ? "text-xs" : "text-sm")}>
            Nexora
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-[4px] bg-[#5865F2] px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.08em] text-white"
                aria-label="Conta oficial e verificada da Nexora"
              >
                <BadgeCheck className="h-3 w-3" />
                Oficial
              </span>
            </TooltipTrigger>
            <TooltipContent>Conta oficial e verificada da Nexora</TooltipContent>
          </Tooltip>
        </div>
        {!compact && (
          <p className="truncate text-[11px] text-[#aeb4be]">Comunicados da plataforma</p>
        )}
      </div>
    </div>
  );
}
