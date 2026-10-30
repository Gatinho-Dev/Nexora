import { useEffect, useState } from "react";
import { CloudOff, Loader2, RefreshCw } from "lucide-react";
import { listOfflineMessages } from "@/lib/offlineCache";

export function OfflineStatusBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const refresh = () => {
      setOnline(navigator.onLine);
      void listOfflineMessages().then(items => setPending(items.length));
    };
    refresh();
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    window.addEventListener("nexora:outbox-changed", refresh);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
      window.removeEventListener("nexora:outbox-changed", refresh);
    };
  }, []);

  if (online && pending === 0) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-[100] flex min-h-9 items-center justify-center gap-2 border-b border-amber-300/20 bg-[#3a2e12]/95 px-4 py-2 text-center text-xs font-semibold text-amber-100 shadow-lg backdrop-blur" role="status" aria-live="polite">
      {!online ? <CloudOff className="size-4" aria-hidden /> : <Loader2 className="size-4 animate-spin" aria-hidden />}
      {!online ? "Sem conexão — exibindo conteúdo salvo" : `${pending} ${pending === 1 ? "mensagem pendente" : "mensagens pendentes"} — sincronizando`}
      {online && <RefreshCw className="size-3.5" aria-hidden />}
    </div>
  );
}
