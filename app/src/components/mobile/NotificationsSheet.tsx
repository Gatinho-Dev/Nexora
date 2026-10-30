import { X } from "lucide-react";
import { InboxContent } from "@/components/InboxContent";

export function NotificationsSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Caixa de entrada"
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 flex h-[86dvh] flex-col overflow-hidden rounded-t-2xl border-t border-border bg-panel pb-[env(safe-area-inset-bottom)] shadow-2xl animate-in slide-in-from-bottom duration-200">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-hov text-muted2 hover:text-foreground"
          aria-label="Fechar Caixa de entrada"
        >
          <X className="h-4 w-4" />
        </button>
        <InboxContent onClose={onClose} compact />
      </div>
    </div>
  );
}
