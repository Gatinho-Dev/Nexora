import { Spinner } from "@/components/ui/spinner";

/**
 * Suspense fallback for lazily-loaded settings modals (server/user).
 * Shows an acknowledged loading state instantly on click while the modal
 * chunk downloads, instead of a dead click with no feedback.
 */
export function ModalLoadingFallback({ label = "Carregando…" }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex items-center gap-3 rounded-2xl border border-surface-border bg-surface-primary px-6 py-4 shadow-2xl">
        <Spinner className="size-5 text-primary-500" />
        <p className="text-sm text-text-secondary">{label}</p>
      </div>
    </div>
  );
}
