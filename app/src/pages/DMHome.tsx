import { DMSidebar } from "@/components/DMSidebar";
import { FriendsPanel } from "@/components/FriendsPanel";
import { SidebarPortal } from "@/components/SidebarPortal";
import { useOutletContext } from "react-router";
import type { AppOutletContext } from "@/lib/appOutletContext";

export function DMHome() {
  const { onOpenProfile } = useOutletContext<AppOutletContext>();

  return (
    <div className="flex flex-1 min-h-0">
      <SidebarPortal>
        <DMSidebar onOpenProfile={onOpenProfile} />
      </SidebarPortal>
      <FriendsPanel onOpenProfile={onOpenProfile} />
    </div>
  );
}
