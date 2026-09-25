import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Loader2, ShieldCheck } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/auth/PasswordField";
import { LoginAlternatives } from "@/components/auth/LoginAlternatives";
import { NexoraAppIcon } from "@/components/NexoraBrand";
import { MigrationBanner } from "@/components/MigrationBanner";
import { Seo } from "@/lib/seo";

const GENERIC_ERROR =
  "Não foi possível entrar no momento. Tente novamente em instantes.";

function friendlyError(message: string, code?: string): string {
  return code === "UNAUTHORIZED" || code === "CONFLICT" ? message : GENERIC_ERROR;
}

type FieldErrors = { identifier?: string; password?: string; code?: string };

export default function Login() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { isAuthenticated } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const identifierRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAuthenticated && !needsTwoFactor) {
      navigate("/channels/@me", { replace: true });
    }
  }, [isAuthenticated, navigate, needsTwoFactor]);

  const login = trpc.account.login.useMutation({
    onSuccess: async result => {
      if (result.requiresTwoFactor) {
        setNeedsTwoFactor(true);
        setCode("");
        setServerError(null);
        window.setTimeout(() => codeRef.current?.focus(), 50);
        return;
      }
      await utils.auth.me.invalidate();
      navigate("/channels/@me");
    },
    onError: error => {
      setServerError(friendlyError(error.message, error.data?.code));
    },
  });

  const handleAuthenticated = useCallback(async () => {
    await utils.auth.me.invalidate();
    navigate("/channels/@me", { replace: true });
  }, [navigate, utils]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);

    const errors: FieldErrors = {};
    if (!identifier.trim()) errors.identifier = "Informe seu usuário ou e-mail.";
    if (!password) errors.password = "Informe a senha.";
    if (needsTwoFactor && !code.trim()) errors.code = "Informe o código.";

    if (errors.identifier) {
      identifierRef.current?.focus();
      return;
    }
    if (errors.password) {
      passwordRef.current?.focus();
      return;
    }
    if (errors.code) {
      codeRef.current?.focus();
      return;
    }

    setFieldErrors({});
    login.mutate({
      identifier: identifier.trim(),
      password,
      ...(needsTwoFactor && code.trim() ? { code: code.trim() } : {}),
    });
  };

  const describedBy = (field: keyof FieldErrors) =>
    fieldErrors[field] ? `${field}-error` : undefined;

  return (
    <>
      <Seo noindex canonicalPath="/login" />
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
                Bem-vindo de volta
              </h1>
              <p className="mt-1.5 text-sm text-muted2">
                {needsTwoFactor
                  ? "Confirme com seu segundo fator de autenticação."
                  : "Entre na sua conta Nexora."}
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {!needsTwoFactor && (
                <>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="identifier"
                      className="text-xs font-semibold uppercase tracking-wider text-muted2"
                    >
                      Nome de usuário ou e-mail
                    </Label>
                    <Input
                      id="identifier"
                      name="identifier"
                      ref={identifierRef}
                      autoComplete="username"
                       inputMode="text"
                      value={identifier}
                      onChange={event => {
                        setIdentifier(event.target.value);
                        if (fieldErrors.identifier) {
                          setFieldErrors(previous => ({ ...previous, identifier: undefined }));
                        }
                      }}
                      disabled={login.isPending}
                      required
                      aria-invalid={fieldErrors.identifier ? true : undefined}
                      aria-describedby={describedBy("identifier")}
                      className="h-12 rounded-lg border-black/20 bg-rail text-base text-white"
                    />
                    {fieldErrors.identifier && (
                      <p
                        id="identifier-error"
                        role="alert"
                        className="text-xs font-medium text-red-400"
                      >
                        {fieldErrors.identifier}
                      </p>
                    )}
                  </div>

                  <PasswordField
                    id="password"
                    label="Senha"
                    value={password}
                    onChange={value => {
                      setPassword(value);
                      if (fieldErrors.password) {
                        setFieldErrors(previous => ({ ...previous, password: undefined }));
                      }
                    }}
                    autoComplete="current-password"
                    error={fieldErrors.password ?? null}
                    inputRef={passwordRef}
                  />

                  <p className="-mt-1 text-right">
                    <Link
                      to="/forgot-password"
                      className="text-xs font-medium text-[#00A8FC] transition-colors hover:text-[#4dbaff] hover:underline"
                    >
                      Esqueci minha senha
                    </Link>
                  </p>
                </>
              )}

              {needsTwoFactor && (
                <div className="space-y-1.5">
                  <Label
                    htmlFor="code"
                    className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted2"
                  >
                    <ShieldCheck className="size-3.5" aria-hidden />
                    Código de autenticação
                  </Label>
                  <Input
                    id="code"
                    name="code"
                    ref={codeRef}
                    inputMode="text"
                    autoComplete="one-time-code"
                    placeholder="123456 ou código de backup"
                    value={code}
                    onChange={event => {
                      setCode(event.target.value);
                      if (fieldErrors.code) {
                        setFieldErrors(previous => ({ ...previous, code: undefined }));
                      }
                    }}
                    disabled={login.isPending}
                    required
                    maxLength={32}
                    aria-invalid={fieldErrors.code ? true : undefined}
                    aria-describedby={describedBy("code")}
                    className="h-12 rounded-lg border-black/20 bg-rail text-center text-lg tracking-[0.3em] text-white"
                  />
                  {fieldErrors.code && (
                    <p
                      id="code-error"
                      role="alert"
                      className="text-xs font-medium text-red-400"
                    >
                      {fieldErrors.code}
                    </p>
                  )}
                   <p className="text-[11px] leading-4 text-muted2">
                     Use o código de 6 dígitos do seu app autenticador ou um código
                     de recuperação.
                   </p>
                   <button
                     type="button"
                     onClick={() => {
                       setNeedsTwoFactor(false);
                       setCode("");
                       setServerError(null);
                     }}
                     className="text-xs font-medium text-[#00A8FC] hover:text-[#4dbaff] hover:underline"
                   >
                     Usar outra conta
                   </button>
                 </div>
              )}

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
                disabled={login.isPending}
                aria-busy={login.isPending}
                className="h-12 w-full rounded-md bg-[#5865F2] text-base font-semibold text-white hover:bg-[#4752C4]"
              >
                {login.isPending && (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                )}
                {login.isPending
                  ? "Entrando..."
                  : needsTwoFactor
                    ? "Verificar e entrar"
                    : "Entrar"}
              </Button>
             </form>

             {!needsTwoFactor && (
               <LoginAlternatives
                 username={identifier}
                 onAuthenticated={handleAuthenticated}
               />
             )}

             <p className="mt-6 text-sm text-muted2">
              Não tem uma conta?{" "}
              <Link
                to="/register"
                className="font-medium text-[#00A8FC] transition-colors hover:text-[#4dbaff] hover:underline"
              >
                Criar conta
              </Link>
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
