/**
 * Avisos flutuantes do Cider.
 *
 * Mesmo desenho do desktop (`.toasts`/`.toast`), inclusive o tempo maior para
 * erro: um aviso que explica por que a música não tocou precisa dar tempo de ser
 * lido, e o de sucesso pode sair rápido.
 */

import { CircleCheck, CircleX, Info, TriangleAlert, X } from "lucide-react";

import { useCiderUi, type ToastKind } from "../ui";
import { Button } from "./primitives";

const ICONS: Record<ToastKind, typeof Info> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleX,
};

export function CiderToasts() {
  const toasts = useCiderUi((state) => state.toasts);
  const dismiss = useCiderUi((state) => state.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="toasts" role="region" aria-label="Avisos do Cider">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.kind];
        return (
          <div className="toast" key={toast.id} data-kind={toast.kind} role="status">
            <Icon size={18} />
            <div>
              <strong>{toast.title}</strong>
              {toast.message ? <p>{toast.message}</p> : null}
              {toast.action && toast.actionLabel ? (
                <div style={{ marginTop: 6 }}>
                  <Button
                    size="sm"
                    onClick={() => {
                      toast.action?.();
                      dismiss(toast.id);
                    }}
                  >
                    {toast.actionLabel}
                  </Button>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="btn icon sm"
              aria-label="Fechar aviso"
              onClick={() => dismiss(toast.id)}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
