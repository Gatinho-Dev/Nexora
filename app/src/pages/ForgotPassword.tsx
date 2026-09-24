import { useState } from "react";
import { Link } from "react-router";
import { Loader2, MailCheck } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NexoraAppIcon } from "@/components/NexoraBrand";
import { MigrationBanner } from "@/components/MigrationBanner";
import { Seo } from "@/lib/seo";

/**
 * Esqueci minha senha — anti-enumeração: a resposta é sempre a mesma,
 * exista ou não uma conta com o e-mail informado.
 */
export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const request = trpc.account.requestPasswordReset.useMutation({
    onSuccess: () => setSent(true),
    // Mesmo em erro de rede mantemos o fluxo neutro.
    onError: () => setSent(true),
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || request.isPending) return;
    request.mutate({ email: email.trim() });
  };

  return (
    <>
      <Seo noindex canonicalPath="/forgot-password" />
      <MigrationBanner fixed />
      <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-chat p-4 pt-20 text-white sm:p-6 sm:pt-24">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-[-22%] h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-[#5865F2]/20 blur-[140px]" />
          <div className="absolute bottom-[-28%] right-[-12%] h-[380px] w-[380px] rounded-full bg-[#5865F2]/10 blur-[120px]" />
        </div>

        <div className="relative w-full max-w-[400px]">
          <div className="rounded-2xl border border-white/[0.06] bg-sidebar p-6 shadow-[0_24px_64px_rgba(0,0,0,0.4)] sm:p-8">
            {sent ? (
              <div className="flex flex-col items-center text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#5865F2]/15 text-[#8e9aff]">
                  <MailCheck className="h-6 w-6" aria-hidden />
                </span>
                <h1 className="mt-4 text-xl font-bold text-white">
                  Verifique seu e-mail
                </h1>
                <p className="mt-2 text-sm leading-6 text-muted2">
                  Se houver uma conta Nexora associada a{" "}
                  <strong className="text-white">{email.trim()}</strong>, você
                  receberá um e-mail com as instruções para redefinir a senha.
                </p>
                <p className="mt-3 text-xs text-muted2">
                  Não recebeu? Verifique a caixa de spam ou{" "}
                  <button
                    type="button"
                    onClick={() => setSent(false)}
                    className="font-medium text-[#00A8FC] hover:underline"
                  >
                    tentar novamente
                  </button>
                  .
                </p>
                <Button
                  asChild
                  variant="ghost"
                  className="mt-6 w-full text-sm text-muted2 hover:bg-white/[0.05] hover:text-white"
                >
                  <Link to="/login">Voltar para o login</Link>
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-7 flex flex-col items-center text-center">
                  <NexoraAppIcon className="mb-5 h-14 w-14" />
                  <h1 className="text-2xl font-bold tracking-[-0.02em] text-white">
                    Esqueci minha senha
                  </h1>
                  <p className="mt-1.5 text-sm text-muted2">
                    Informe o e-mail da sua conta e enviaremos as instruções.
                  </p>
                </div>

                <form onSubmit={handleSubmit} noValidate className="space-y-4">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="email"
                      className="text-xs font-semibold uppercase tracking-wider text-muted2"
                    >
                      E-mail
                    </Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      value={email}
                      onChange={event => setEmail(event.target.value)}
                      disabled={request.isPending}
                      required
                      className="h-12 rounded-lg border-black/20 bg-rail text-base text-white"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={request.isPending || !email.trim()}
                    aria-busy={request.isPending}
                    className="h-12 w-full rounded-md bg-[#5865F2] text-base font-semibold text-white hover:bg-[#4752C4]"
                  >
                    {request.isPending && (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    )}
                    {request.isPending ? "Enviando..." : "Enviar instruções"}
                  </Button>
                </form>

                <p className="mt-6 text-sm text-muted2">
                  Lembrou a senha?{" "}
                  <Link
                    to="/login"
                    className="font-medium text-[#00A8FC] transition-colors hover:text-[#4dbaff] hover:underline"
                  >
                    Entrar
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
