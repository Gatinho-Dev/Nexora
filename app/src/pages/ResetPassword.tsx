import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/auth/PasswordField";
import { NexoraAppIcon } from "@/components/NexoraBrand";
import { MigrationBanner } from "@/components/MigrationBanner";
import { Seo } from "@/lib/seo";

const GENERIC_ERROR =
  "Não foi possível redefinir a senha no momento. Tente novamente.";

/**
 * Redefinição de senha via token do e-mail (/reset-password?token=...).
 * Sucesso revoga todas as sessões da conta no servidor.
 */
export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const utils = trpc.useUtils();

  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const reset = trpc.account.resetPassword.useMutation({
    onSuccess: async () => {
      setSuccess(true);
      // A sessão antiga foi revogada no servidor; limpa o cache do cliente.
      await utils.auth.me.invalidate();
    },
    onError: error => {
      setServerError(
        error.data?.code === "BAD_REQUEST" ? error.message : GENERIC_ERROR,
      );
    },
  });

  const passwordsMismatch =
    confirmPassword !== "" && confirmPassword !== password;
  const canSubmit =
    token.length >= 32 &&
    password.length >= 6 &&
    confirmPassword === password &&
    !reset.isPending;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);
    if (!canSubmit) return;
    reset.mutate({ token, password });
  };

  if (success) {
    return (
      <>
        <Seo noindex canonicalPath="/reset-password" />
        <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-chat p-4 text-white sm:p-6">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-[-22%] h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-[#5865F2]/20 blur-[140px]" />
            <div className="absolute bottom-[-28%] right-[-12%] h-[380px] w-[380px] rounded-full bg-[#5865F2]/10 blur-[120px]" />
          </div>
          <div className="relative w-full max-w-[400px]">
            <div className="rounded-2xl border border-white/[0.06] bg-sidebar p-6 text-center shadow-[0_24px_64px_rgba(0,0,0,0.4)] sm:p-8">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#23a55a]/15 text-[#43b581]">
                <CheckCircle2 className="h-6 w-6" aria-hidden />
              </span>
              <h1 className="mt-4 text-xl font-bold text-white">
                Senha redefinida!
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted2">
                Sua senha foi alterada e todas as outras sessões foram
                encerradas por segurança.
              </p>
              <Button
                asChild
                className="mt-6 h-11 w-full rounded-md bg-[#5865F2] text-base font-semibold text-white hover:bg-[#4752C4]"
              >
                <Link to="/login">Entrar com a nova senha</Link>
              </Button>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Seo noindex canonicalPath="/reset-password" />
      <MigrationBanner fixed />
      <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-chat p-4 pt-20 text-white sm:p-6 sm:pt-24">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-[-22%] h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-[#5865F2]/20 blur-[140px]" />
          <div className="absolute bottom-[-28%] right-[-12%] h-[380px] w-[380px] rounded-full bg-[#5865F2]/10 blur-[120px]" />
        </div>

        <div className="relative w-full max-w-[400px]">
          <div className="rounded-2xl border border-white/[0.06] bg-sidebar p-6 shadow-[0_24px_64px_rgba(0,0,0,0.4)] sm:p-8">
            <div className="mb-7 flex flex-col items-center text-center">
              <NexoraAppIcon className="mb-5 h-14 w-14" />
              <h1 className="text-2xl font-bold tracking-[-0.02em] text-white">
                Definir nova senha
              </h1>
              <p className="mt-1.5 text-sm text-muted2">
                Crie uma nova senha para a sua conta Nexora.
              </p>
            </div>

            {token.length < 32 ? (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm font-medium text-red-400" role="alert">
                Este link de redefinição é inválido ou está incompleto.
                Solicite um novo e-mail de redefinição para continuar.
                <Button
                  asChild
                  variant="ghost"
                  className="mt-3 w-full text-sm text-muted2 hover:bg-white/[0.05] hover:text-white"
                >
                  <Link to="/forgot-password">Solicitar novo link</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <input type="hidden" name="token" value={token} />
                <PasswordField
                  id="password"
                  label="Nova senha"
                  value={password}
                  onChange={value => setPassword(value)}
                  autoComplete="new-password"
                  hint="Use pelo menos 6 caracteres."
                  disabled={reset.isPending}
                />
                <PasswordField
                  id="confirmPassword"
                  label="Confirmar nova senha"
                  value={confirmPassword}
                  onChange={value => setConfirmPassword(value)}
                  autoComplete="new-password"
                  error={passwordsMismatch ? "As senhas não coincidem." : null}
                  disabled={reset.isPending}
                />

                {serverError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm font-medium text-red-400"
                  >
                    {serverError}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={!canSubmit}
                  aria-busy={reset.isPending}
                  className="h-12 w-full rounded-md bg-[#5865F2] text-base font-semibold text-white hover:bg-[#4752C4]"
                >
                  {reset.isPending && (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  )}
                  {reset.isPending ? "Redefinindo..." : "Redefinir senha"}
                </Button>

                <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted2">
                  <ShieldCheck className="size-3.5" aria-hidden />
                  Todas as outras sessões serão encerradas após a mudança.
                </p>
              </form>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
