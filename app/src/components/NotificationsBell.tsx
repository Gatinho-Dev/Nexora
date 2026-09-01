import { useState } from "react";
import { Inbox } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { InboxContent } from "@/components/InboxContent";

export function NotificationsBell({
  onOpenProfile,
}: {
  onOpenProfile?: (userId: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const unread = trpc.notification.unreadCount.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const friends = trpc.friend.list.useQuery(undefined, {
    staleTime: 30_000,
  });
  const incomingRequests =
    friends.data?.filter(
      friend =>
        friend.status === "PENDING" && friend.direction === "incoming",
    ).length ?? 0;
  const count = Math.max(unread.data?.count ?? 0, incomingRequests);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted2 hover:bg-hov hover:text-foreground"
          title="Caixa de entrada"
          aria-label="Abrir Caixa de entrada"
        >
          <Inbox className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white ring-2 ring-[hsl(var(--panel))]">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="flex h-[min(720px,calc(100dvh-72px))] w-[min(590px,calc(100vw-16px))] overflow-hidden rounded-2xl border-border bg-panel p-0 text-foreground shadow-2xl"
      >
        <InboxContent
          onClose={() => setOpen(false)}
          onOpenProfile={onOpenProfile}
        />
      </PopoverContent>
    </Popover>
  );
}
