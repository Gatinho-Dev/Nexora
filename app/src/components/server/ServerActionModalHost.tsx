import type { ServerDTO } from "@contracts/types";
import { trpc } from "@/providers/trpc";
import { CreateCategoryModal } from "../modals/CreateCategoryModal";
import { CreateChannelModal } from "../modals/CreateChannelModal";
import { EventsModal } from "../modals/EventsModal";
import { InviteModal } from "../modals/InviteModal";
import { ServerSettingsModal } from "../modals/ServerSettingsModal";
import type { ServerMenuAction } from "./ServerContextMenu";

export type ActiveServerMenuAction = {
  action: ServerMenuAction;
  server: ServerDTO;
} | null;

export function ServerActionModalHost({
  activeAction,
  onClose,
}: {
  activeAction: ActiveServerMenuAction;
  onClose: () => void;
}) {
  const serverId = activeAction?.server.id ?? 0;
  const needsDetails = Boolean(
    activeAction &&
      ["settings", "create-channel", "events"].includes(activeAction.action),
  );
  const details = trpc.server.get.useQuery(
    { serverId },
    { enabled: needsDetails },
  );

  if (!activeAction) return null;

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  return (
    <>
      {activeAction.action === "invite" && (
        <InviteModal
          open
          onOpenChange={handleOpenChange}
          serverId={activeAction.server.id}
        />
      )}
      {details.data && activeAction.action === "create-channel" && (
        <CreateChannelModal
          open
          onOpenChange={handleOpenChange}
          serverId={activeAction.server.id}
          categories={details.data.categories}
        />
      )}
      {activeAction.action === "create-category" && (
        <CreateCategoryModal
          open
          onOpenChange={handleOpenChange}
          serverId={activeAction.server.id}
        />
      )}
      {details.data && activeAction.action === "settings" && (
        <ServerSettingsModal
          open
          onOpenChange={handleOpenChange}
          details={details.data}
        />
      )}
      {details.data && activeAction.action === "events" && (
        <EventsModal
          open
          onOpenChange={handleOpenChange}
          details={details.data}
        />
      )}
    </>
  );
}
