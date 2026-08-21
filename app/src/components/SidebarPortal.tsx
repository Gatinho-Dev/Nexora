import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useAppStore } from "@/store/useAppStore";

/**
 * Renders the page sidebar inline on desktop and, on mobile, teleports it
 * into the AppLayout drawer (#mobile-sidebar-slot) when the drawer is open.
 */
export function SidebarPortal({ children }: { children: ReactNode }) {
  const mobileNavOpen = useAppStore((s) => s.mobileNavOpen);
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (mobileNavOpen) {
      setSlot(document.getElementById("mobile-sidebar-slot"));
    } else {
      setSlot(null);
    }
  }, [mobileNavOpen]);

  return (
    <>
      <div className="hidden md:flex h-full shrink-0">{children}</div>
      {slot && createPortal(children, slot)}
    </>
  );
}
