import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { CheckCircle2, Loader2, MailWarning } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { NexoraAppIcon } from "@/components/NexoraBrand";
import { MigrationBanner } from "@/components/MigrationBanner";
import { Seo } from "@/lib/seo";

/**
 * Verificação de e-mail via token (/verify-email?token=...).
 * Consumido exatamente uma vez; link reutilizado/expirado cai no estado de erro.
 */
export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  // Estado inicial derivado do token: inválido já nasce como erro (sem
  // setState dentro de effect). Tokens válidos disparam a mutação no mount.
  const [state, setState] = useState<"loading" | "success" | "error">(() =>
    token.length < 32 ? "error" : "loading",
  );
  const startedRef = useRef(false);

  const verify = trpc.account.verifyEmail.useMutation({
    onSuccess: () => setState("success"),
    onError: () => setState("error"),
  });

  useEffect(() => {
    if (startedRef.current || token.length < 32) return;
    startedRef.current = true;
    verify.mutate({ token });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <>
      <Seo noindex canonicalPath="/verify-email" />
      <MigrationBanner fixed />
      <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-chat p-4 pt-20 text-white sm:p-6 sm:pt-24">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-[-22%] h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-[#5865F2]/20 blur-[140px]" />
          <div className="absolute bottom-[-28%] right-[-12%] h-[380px] w-[380px] rounded-full bg-[#5865F2]/10 blur-[120px]" />
        </div>

        <div className="relative w-full max-w-[400px]">
          <div className="rounded-2xl border border-white/[0.06] bg-sidebar p-6 text-center shadow-[0_24px_64px_rgba(0,0,0,0.4)] sm:p-8">
            <NexoraAppIcon className="mx-auto mb-5 h-14 w-14" />

            {state === "loading" && (
              <>
                <h1 className="text-xl font-bold text-white">
                  Verificando seu e-mail...
                </h1>
                <p className="mt-2 text-sm text-muted2">
                  Um instante — estamos confirmando seu endereço.
                </p>
                <Loader2 className="mx-auto mt-5 size-6 animate-spin text-[#5865F2]" aria-hidden />
              </>
            )}

            {state === "success" && (
              <>
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#23a55a]/15 text-[#43b581]">
                  <CheckCircle2 className="h-6 w-6" aria-hidden />
                </span>
                <h1 className="mt-4 text-xl font-bold text-white">
                  E-mail verificado!
                </h1>
                <p className="mt-2 text-sm leading-6 text-muted2">
                  Seu endereço de e-mail foi confirmado com sucesso. Agora sua
                  conta está protegida e pronta para continuar.
                </p>
                <Button
                  onClick={() => navigate("/channels/@me")}
                  className="mt-6 h-11 w-full rounded-md bg-[#5865F2] text-base font-semibold text-white hover:bg-[#4752C4]"
                >
                  Abrir Nexora
                </Button>
              </>
            )}

            {state === "error" && (
              <>
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f0b232]/15 text-[#f5c452]">
                  <MailWarning className="h-6 w-6" aria-hidden />
                </span>
                <h1 className="mt-4 text-xl font-bold text-white">
                  Link inválido ou expirado
                </h1>
                <p className="mt-2 text-sm leading-6 text-muted2">
                  Este link expirou ou já foi utilizado. Solicite um novo e-mail
                  de verificação nas configurações da sua conta.
                </p>
                <Button
                  asChild
                  className="mt-6 h-11 w-full rounded-md bg-[#5865F2] text-base font-semibold text-white hover:bg-[#4752C4]"
                >
                  <Link to="/channels/@me">Abrir Nexora</Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  className="mt-2 w-full text-sm text-muted2 hover:bg-white/[0.05] hover:text-white"
                >
                  <Link to="/login">Ir para o login</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
