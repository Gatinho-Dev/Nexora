import { useState } from "react";
import { Check, MonitorSmartphone, ShieldCheck, X } from "lucide-react";
import { apiUrl } from "@/lib/endpoints";
import { Seo } from "@/lib/seo";

/**
 * Página de autorização do Nexora CLI (device flow).
 *
 * O usuário chega aqui pelo código mostrado no terminal. Precisa estar
 * logado no Nexora Web — a aprovação usa o cookie de sessão existente e
 * emite uma nova sessão para o CLI (visível em Dispositivos conectados).
 */

type Step = "input" | "confirm" | "done" | "denied" | "error";

const USER_CODE_RE = /^[A-Z0-9-]{6,16}$/;

export default function CliLoginPage() {
  // Estado inicial derivado da URL (código pré-preenchido via QR/link).
  const [code, setCode] = useState(() => {
    if (typeof window === "undefined") return "";
    return (new URLSearchParams(window.location.search).get("code") ?? "").toUpperCase();
  });
  const [step, setStep] = useState<Step>(() => {
    if (typeof window === "undefined") return "input";
    return new URLSearchParams(window.location.search).has("code") ? "confirm" : "input";
  });
  const [error, setError] = useState<string | null>(null);
  const [deviceName] = useState("Nexora");

  // Normaliza o código colado (ex.: "abcd-1234" → "ABCD-1234").
  const normalized = code.trim().toUpperCase();

  async function approve() {
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/cli/device/approve"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userCode: normalized }),
      });
      if (res.ok) {
        setStep("done");
      } else {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(
          body.error === "invalid_user_code"
            ? "Código inválido ou expirado. Confira no terminal."
            : "Não foi possível autorizar. Tente novamente."
        );
        setStep("error");
      }
    } catch {
      setError("Sem conexão com o servidor.");
      setStep("error");
    }
  }

  async function deny() {
    await fetch(apiUrl("/api/cli/device/deny"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ userCode: normalized }),
    }).catch(() => {});
    setStep("denied");
  }

  return (
    <>
      <Seo noindex canonicalPath="/cli/login" />
      <div className="flex min-h-dvh items-center justify-center bg-chat p-4 text-white select-none">
        <div className="w-full max-w-md animate-[fadeInUp_0.35s_ease-out] rounded-3xl border border-white/[0.08] bg-panel/80 p-8 shadow-2xl backdrop-blur-xl">
        {step === "input" && (
          <>
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#5865F2] to-[#4046b8] text-lg font-black">
                N
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">
                  Conectar Nexora CLI
                </h1>
                <p className="text-xs text-muted2">
                  Autorize o acesso do aplicativo de terminal
                </p>
              </div>
            </div>
            <label
              htmlFor="cli-code"
              className="mb-2 block text-xs font-semibold text-muted2"
            >
              Digite o código exibido no terminal
            </label>
            <input
              id="cli-code"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => {
                if (e.key === "Enter" && USER_CODE_RE.test(normalized)) {
                  setStep("confirm");
                }
              }}
              placeholder="XXXX-XXXX"
              autoComplete="off"
              maxLength={9}
              className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-center font-mono text-2xl tracking-[0.3em] outline-none transition-colors placeholder:text-white/20 focus:border-[#5865F2]"
            />
            <button
              type="button"
              disabled={!USER_CODE_RE.test(normalized)}
              onClick={() => setStep("confirm")}
              className="mt-5 w-full rounded-2xl bg-[#5865F2] py-3 font-semibold transition-all hover:bg-[#4752C4] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continuar
            </button>
            <p className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-muted2">
              <ShieldCheck className="h-3.5 w-3.5" />
              Nunca autorize um código que você não solicitou.
            </p>
          </>
        )}

        {step === "confirm" && (
          <>
            <div className="mb-6 flex flex-col items-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#5865F2]/15 text-[#8b94ff]">
                <MonitorSmartphone className="h-7 w-7" />
              </div>
              <h1 className="text-lg font-bold">Conectar este dispositivo?</h1>
              <p className="text-sm text-muted2">
                O aplicativo <strong className="text-white">Nexora CLI</strong>{" "}
                no seu computador quer acessar sua conta{" "}
                <strong className="text-white">{deviceName}</strong> — amigos,
                mensagens e servidores, somente texto.
              </p>
              <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-2 font-mono text-lg tracking-[0.25em]">
                {normalized}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={deny}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white/10 py-3 font-semibold transition-all hover:bg-white/15 active:scale-[0.98]"
              >
                <X className="h-4 w-4" /> Recusar
              </button>
              <button
                type="button"
                onClick={approve}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#23A559] py-3 font-semibold transition-all hover:bg-[#1e8c4b] active:scale-[0.98]"
              >
                <Check className="h-4 w-4" /> Autorizar
              </button>
            </div>
          </>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#23A559]/15 text-[#3bbd72]">
              <Check className="h-8 w-8" />
            </div>
            <h1 className="text-lg font-bold">Dispositivo autorizado!</h1>
            <p className="text-sm text-muted2">
              Volte ao terminal — o Nexora CLI continuará automaticamente.
              Você pode revogar este acesso em Dispositivos conectados.
            </p>
          </div>
        )}

        {step === "denied" && (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5 text-muted2">
              <X className="h-8 w-8" />
            </div>
            <h1 className="text-lg font-bold">Autorização recusada</h1>
            <p className="text-sm text-muted2">
              O terminal não terá acesso à sua conta. Você pode fechar esta
              página.
            </p>
          </div>
        )}

        {step === "error" && (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-400">
              <X className="h-8 w-8" />
            </div>
            <h1 className="text-lg font-bold">Não foi possível autorizar</h1>
            <p className="text-sm text-muted2">{error}</p>
            <button
              type="button"
              onClick={() => {
                setStep("input");
                setCode("");
              }}
              className="rounded-2xl bg-white/10 px-6 py-2.5 font-semibold hover:bg-white/15"
            >
              Tentar outro código
            </button>
          </div>
        )}
        </div>
      </div>
    </>
  );
}
