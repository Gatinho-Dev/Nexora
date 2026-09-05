import { useEffect, useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { QRCodeSVG } from "qrcode.react";
import { Fingerprint, Loader2, QrCode, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";

type QrSession = {
  id: string;
  token: string;
  payload: string;
  expiresAt: string | Date;
};

function readableError(error: unknown) {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "A autenticação foi cancelada ou expirou.";
  }
  return error instanceof Error ? error.message : "Não foi possível autenticar.";
}

export function LoginAlternatives({
  username,
  onAuthenticated,
}: {
  username: string;
  onAuthenticated: () => Promise<void>;
}) {
  const [qr, setQr] = useState<QrSession | null>(null);
  const beginPasskey = trpc.advanced.security.beginPasskeyLogin.useMutation();
  const finishPasskey = trpc.advanced.security.finishPasskeyLogin.useMutation();
  const createQr = trpc.advanced.security.createQrLogin.useMutation({
    onSuccess: data => setQr(data),
    onError: error => toast.error(error.message),
  });
  const qrStatus = trpc.advanced.security.qrLoginStatus.useMutation();

  useEffect(() => {
    if (!qr) return;
    let active = true;
    const poll = async () => {
      if (!active || qrStatus.isPending) return;
      try {
        const result = await qrStatus.mutateAsync({ id: qr.id, token: qr.token });
        if (result.authenticated) {
          active = false;
          setQr(null);
          await onAuthenticated();
        } else if (["REJECTED", "EXPIRED", "CONSUMED"].includes(result.status)) {
          active = false;
          setQr(null);
          toast.error(result.status === "REJECTED" ? "Login recusado no celular." : "O QR expirou. Gere outro código.");
        }
      } catch (error) {
        active = false;
        setQr(null);
        toast.error(readableError(error));
      }
    };
    const timer = window.setInterval(() => void poll(), 2_000);
    void poll();
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [qr, onAuthenticated, qrStatus]);

  const authenticateWithPasskey = async () => {
    const normalized = username.trim();
    if (!normalized) {
      toast.error("Informe seu @username antes de usar uma passkey.");
      return;
    }
    try {
      const start = await beginPasskey.mutateAsync({ username: normalized });
      const response = await startAuthentication({ optionsJSON: start.options });
      await finishPasskey.mutateAsync({ challengeId: start.challengeId, response });
      await onAuthenticated();
    } catch (error) {
      toast.error(readableError(error));
    }
  };

  const passkeyPending = beginPasskey.isPending || finishPasskey.isPending;

  return (
    <div className="mt-5 space-y-3 border-t border-white/[0.07] pt-5">
      <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.14em] text-faint">
        <span className="h-px flex-1 bg-white/[0.07]" />
        Outras formas de entrar
        <span className="h-px flex-1 bg-white/[0.07]" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          disabled={passkeyPending}
          onClick={() => void authenticateWithPasskey()}
          className="min-h-11 border-white/10 bg-white/[0.03]"
        >
          {passkeyPending ? <Loader2 className="size-4 animate-spin" /> : <Fingerprint className="size-4 text-[#8290ff]" />}
          Usar passkey
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={createQr.isPending}
          onClick={() => createQr.mutate()}
          className="min-h-11 border-white/10 bg-white/[0.03]"
        >
          {createQr.isPending ? <Loader2 className="size-4 animate-spin" /> : <QrCode className="size-4 text-[#8290ff]" />}
          Entrar com QR
        </Button>
      </div>

      {qr && (
        <div className="relative rounded-2xl border border-[#7383ff]/25 bg-[#4654d8]/[0.08] p-4 text-center">
          <button type="button" onClick={() => setQr(null)} className="absolute right-2 top-2 grid size-8 place-items-center rounded-lg text-muted2 hover:bg-white/10 hover:text-white" aria-label="Fechar QR">
            <X className="size-4" />
          </button>
          <div className="mx-auto w-fit rounded-xl bg-white p-3">
            <QRCodeSVG value={qr.payload} size={164} aria-label="QR temporário para login" />
          </div>
          <p className="mt-3 text-xs font-bold text-white">Escaneie no Nexora do celular</p>
          <p className="mt-1 text-[11px] leading-5 text-muted2">Configurações → Segurança → Escanear QR. O código é único e expira em dois minutos.</p>
          <div className="mt-2 flex items-center justify-center gap-2 text-[10px] text-[#aab2ff]">
            <Loader2 className="size-3 animate-spin" /> Aguardando autorização segura
          </div>
        </div>
      )}
    </div>
  );
}
