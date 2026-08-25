import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Tela em tela cheia exibida quando esta sessão é encerrada remotamente
 * (evento realtime `session:revoked`). Limpeza de cache é feita no hook
 * useRealtime antes deste componente ser montado.
 */
export function SessionRevokedScreen() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col select-none items-center justify-center gap-3 bg-chat px-6 text-center">
      <ShieldAlert className="h-12 w-12 text-red-400" aria-hidden />
      <h1 className="text-xl font-bold text-white">
        Sua sessão foi encerrada.
      </h1>
      <p className="max-w-sm text-sm text-muted2">
        Esta sessão foi desconectada da Nexora. Entre novamente para continuar.
      </p>
      <Button
        onClick={() => {
          window.location.href = "/login";
        }}
        className="mt-2 bg-[#5865F2] font-medium text-white hover:bg-[#4752C4]"
      >
        Entrar novamente
      </Button>
    </div>
  );
}
