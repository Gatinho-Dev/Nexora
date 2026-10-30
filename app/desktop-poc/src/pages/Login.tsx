import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Loader2, Monitor } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/auth/PasswordField";
import { NexoraAppIcon } from "@/components/NexoraBrand";
import { MigrationBanner } from "@/components/MigrationBanner";
import { platform, isDesktop } from "@/platform";

const GENERIC_ERROR =
  "Não foi possível entrar no momento. Tente novamente em instantes.";

function friendlyError(message: string, code?: string): string {
  return code === "UNAUTHORIZED" || code === "CONFLICT" ? message : GENERIC_ERROR;
}

type FieldErrors = { username?: string; password?: string };

export default function Login() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { isAuthenticated } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/channels/@me", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Listen for auth success from Tauri
  useEffect(() => {
    const handler = (event: CustomEvent) => {
      if (event.detail?.token) {
        // Token received from Tauri auth callback
        navigate("/channels/@me");
      }
    };
    window.addEventListener("nexora:auth:success", handler as EventListener);
    return () => window.removeEventListener("nexora:auth:success", handler as EventListener);
  }, [navigate]);

  const handleDesktopLogin = async () => {
    if (isDesktop) {
      try {
        console.log("[DesktopLogin] Calling platform.openLoginInBrowser...");
        await platform.openLoginInBrowser?.();
        console.log("[DesktopLogin] platform.openLoginInBrowser returned successfully");
      } catch (error) {
        // Fallback: try to open URL directly
        console.warn("[DesktopLogin] Tauri openLoginInBrowser failed, trying fallback:", error);
        try {
          console.log("[DesktopLogin] Trying window.open fallback...");
          window.open("https://nexorachat.cloud/login?desktop=true", "_blank", "noopener,noreferrer");
          console.log("[DesktopLogin] window.open fallback executed");
        } catch (fallbackError) {
          console.error("[DesktopLogin] Fallback also failed:", fallbackError);
          setServerError("Não foi possível abrir o navegador. Tente novamente.");
        }
      }
    } else {
      console.log("[DesktopLogin] Not in desktop environment");
    }
  };

  const login = trpc.account.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      navigate("/channels/@me");
    },
    onError: error => {
      setServerError(friendlyError(error.message, error.data?.code));
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);

    const errors: FieldErrors = {};
    if (!username.trim()) errors.username = "Informe o nome de usuário.";
    if (!password) errors.password = "Informe a senha.";

    if (errors.username) {
      usernameRef.current?.focus();
      return;
    }
    if (errors.password) {
      passwordRef.current?.focus();
      return;
    }

    setFieldErrors({});
    login.mutate({ username: username.trim(), password });
  };

  const describedBy = (field: keyof FieldErrors) =>
    fieldErrors[field] ? `${field}-error` : undefined;

  return (
    <>
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
                Entre na sua conta Nexora.
              </p>
            </div>

            {isDesktop ? (
              // Desktop: single button to open browser for login
              <div className="space-y-4">
                <Button
                  type="button"
                  onClick={handleDesktopLogin}
                  disabled={login.isPending}
                  aria-busy={login.isPending}
                  className="h-12 w-full rounded-md bg-[#5865F2] text-base font-semibold text-white hover:bg-[#4752C4] flex items-center justify-center gap-2"
                >
                  {login.isPending && (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  )}
                  <Monitor className="size-4" />
                  Continuar no navegador
                </Button>

                {serverError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm font-medium text-red-400"
                  >
                    {serverError}
                  </div>
                )}

                <p className="mt-6 text-sm text-muted2 text-center">
                  O login será feito no seu navegador padrão.
                </p>
              </div>
            ) : (
              // Web: traditional form login
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="username"
                    className="text-xs font-semibold uppercase tracking-wider text-muted2"
                  >
                    Usuário
                  </Label>
                  <Input
                    id="username"
                    name="username"
                    ref={usernameRef}
                    autoComplete="username"
                    value={username}
                    onChange={event => {
                      setUsername(event.target.value);
                      if (fieldErrors.username) {
                        setFieldErrors(previous => ({ ...previous, username: undefined }));
                      }
                    }}
                    disabled={login.isPending}
                    required
                    aria-invalid={fieldErrors.username ? true : undefined}
                    aria-describedby={describedBy("username")}
                    className="h-12 rounded-lg border-black/20 bg-rail text-base text-white"
                  />
                  {fieldErrors.username && (
                    <p
                      id="username-error"
                      role="alert"
                      className="text-xs font-medium text-red-400"
                    >
                      {fieldErrors.username}
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
                  {login.isPending ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            )}

            <p className="mt-6 text-sm text-muted2 text-center">
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