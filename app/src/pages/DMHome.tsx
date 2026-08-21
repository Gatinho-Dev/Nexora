import { DMSidebar } from "@/components/DMSidebar";
import { FriendsPanel } from "@/components/FriendsPanel";
import { SidebarPortal } from "@/components/SidebarPortal";

export function DMHome() {
  return (
    <div className="flex flex-1 min-h-0">
      <SidebarPortal>
        <DMSidebar />
      </SidebarPortal>
      <FriendsPanel />
    </div>
  );
}
