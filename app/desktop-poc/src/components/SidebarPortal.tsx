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
      const timeout = setTimeout(() => setSlot(document.getElementById("mobile-sidebar-slot")), 0);
      return () => clearTimeout(timeout);
    } else {
      const timeout = setTimeout(() => setSlot(null), 0);
      return () => clearTimeout(timeout);
    }
  }, [mobileNavOpen]);

  return (
    <>
      <div className="hidden md:flex h-full shrink-0">{children}</div>
      {slot && createPortal(children, slot)}
    </>
  );
}
