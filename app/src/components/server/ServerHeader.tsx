import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ServerDTO } from "@contracts/types";
import { ServerBadge } from "./ServerBadge";
import { cn } from "@/lib/utils";

export function ServerHeader({ server }: { server: ServerDTO }) {
  const [failedBannerUrl, setFailedBannerUrl] = useState<string | null>(null);
  const showBanner =
    Boolean(server.bannerUrl) && failedBannerUrl !== server.bannerUrl;

  return (
    <div
      className={cn(
        "group relative flex w-full items-end overflow-hidden border-b border-black/20 text-foreground",
        showBanner ? "h-28" : "h-12",
      )}
    >
      {showBanner && (
        <>
          <img
            src={server.bannerUrl!}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailedBannerUrl(server.bannerUrl ?? null)}
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          <span
            className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/15 to-black/80"
            aria-hidden
          />
        </>
      )}

      <div
        className={cn(
          "relative flex min-w-0 flex-1 items-center gap-2 px-4 transition-colors",
          showBanner
            ? "h-12 text-white group-hover:bg-black/15"
            : "h-full group-hover:bg-hov",
        )}
      >
        {server.partnered && (
          <ServerBadge
            type="partner"
            className="h-[18px] w-[18px]"
          />
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-semibold tracking-[-0.01em]">
          {server.name}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 transition-transform duration-150 group-data-[state=open]:rotate-180",
            showBanner ? "text-white/85" : "text-muted2",
          )}
          aria-hidden
        />
      </div>
    </div>
  );
}
