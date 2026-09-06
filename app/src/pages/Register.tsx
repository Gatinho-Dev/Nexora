import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/auth/PasswordField";
import { NexoraAppIcon } from "@/components/NexoraBrand";
import { MigrationBanner } from "@/components/MigrationBanner";
import { Seo } from "@/lib/seo";

const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]+$/;
const GENERIC_ERROR =
  "Não foi possível criar sua conta no momento. Tente novamente em instantes.";

function usernameValidationError(value: string): string | null {
  if (!value) return null;
  if (value.length < 3) {
    return "O nome de usuário precisa de pelo menos 3 caracteres.";
  }
  if (value.length > 32) {
    return "O nome de usuário pode ter no máximo 32 caracteres.";
  }
  if (!USERNAME_PATTERN.test(value)) {
    return "Use apenas letras, números, ponto, hífen e sublinhado.";
  }
  return null;
}

export default function Register() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { isAuthenticated } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [debouncedUsername, setDebouncedUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/channels/@me", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Debounce de 400ms antes de consultar a disponibilidade do username.
  useEffect(() => {
    const timeout = setTimeout(
      () => setDebouncedUsername(username.trim()),
      400,
    );
    return () => clearTimeout(timeout);
  }, [username]);

  const trimmedUsername = username.trim();
  const usernameError = usernameValidationError(trimmedUsername);

  const check = trpc.account.checkUsername.useQuery(
    { username: debouncedUsername },
    {
      enabled: debouncedUsername !== "" && !usernameValidationError(debouncedUsername),
      staleTime: 30_000,
    },
  );

  const register = trpc.account.register.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      navigate("/channels/@me");
    },
    onError: error => {
      setServerError(
        error.data?.code === "CONFLICT" ? error.message : GENERIC_ERROR,
      );
    },
  });

  const passwordsMismatch =
    confirmPassword !== "" && confirmPassword !== password;

  const canSubmit =
    displayName.trim().length >= 1 &&
    displayName.trim().length <= 64 &&
    trimmedUsername !== "" &&
    usernameError === null &&
    debouncedUsername === trimmedUsername &&
    check.data?.available === true &&
    password.length >= 6 &&
    confirmPassword === password &&
    !register.isPending;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);
    if (!canSubmit) return;
    register.mutate({
      username: trimmedUsername,
      displayName: displayName.trim(),
      password,
    });
  };

  let usernameStatus: { tone: "muted" | "ok" | "error"; text: string } | null =
    null;
  if (usernameError) {
    usernameStatus = { tone: "error", text: usernameError };
  } else if (trimmedUsername === "") {
    usernameStatus = null;
  } else if (check.isFetching) {
    usernameStatus = { tone: "muted", text: "Verificando disponibilidade..." };
  } else if (check.data?.available) {
    usernameStatus = { tone: "ok", text: "Nome disponível" };
  } else if (check.data && !check.data.available) {
    usernameStatus = {
      tone: "error",
      text: check.data.reason ?? "Este nome não está disponível.",
    };
  } else if (check.isError) {
    usernameStatus = {
      tone: "error",
      text: "Não foi possível verificar agora. Tente novamente.",
    };
  }

  return (
    <>
      <Seo noindex canonicalPath="/register" />
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
                Crie sua conta Nexora
              </h1>
              <p className="mt-1.5 text-sm text-muted2">
                Escolha seu nome de usuário e comece a conversar.
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="displayName"
                  className="text-xs font-semibold uppercase tracking-wider text-muted2"
                >
                  Nome de exibição
                </Label>
                <Input
                  id="displayName"
                  name="displayName"
                  autoComplete="nickname"
                  placeholder="ex.: Ana Silva"
                  value={displayName}
                  onChange={event => setDisplayName(event.target.value)}
                  disabled={register.isPending}
                  required
                  maxLength={64}
                  className="h-12 rounded-lg border-black/20 bg-rail text-base text-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="username"
                  className="text-xs font-semibold uppercase tracking-wider text-muted2"
                >
                  Nome de usuário
                </Label>
                <Input
                  id="username"
                  name="username"
                  autoComplete="username"
                  placeholder="ex.: ana.silva"
                  value={username}
                  onChange={event => setUsername(event.target.value)}
                  disabled={register.isPending}
                  required
                  minLength={3}
                  maxLength={32}
                  aria-invalid={usernameStatus?.tone === "error" ? true : undefined}
                  aria-describedby={usernameStatus ? "username-status" : undefined}
                  className="h-12 rounded-lg border-black/20 bg-rail text-base text-white"
                />
                {usernameStatus && (
                  <p
                    id="username-status"
                    role={usernameStatus.tone === "error" ? "alert" : undefined}
                    aria-live={usernameStatus.tone === "error" ? undefined : "polite"}
                    className={`flex items-center gap-1.5 text-xs font-medium ${
                      usernameStatus.tone === "ok"
                        ? "text-emerald-400"
                        : usernameStatus.tone === "error"
                          ? "text-red-400"
                          : "text-muted2"
                    }`}
                  >
                    {usernameStatus.tone === "ok" && (
                      <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
                    )}
                    {usernameStatus.tone === "error" && (
                      <XCircle className="size-3.5 shrink-0" aria-hidden />
                    )}
                    {usernameStatus.text}
                  </p>
                )}
              </div>

              <PasswordField
                id="password"
                label="Senha"
                value={password}
                onChange={value => setPassword(value)}
                autoComplete="new-password"
                hint="Use pelo menos 6 caracteres."
                disabled={register.isPending}
              />

              <PasswordField
                id="confirmPassword"
                label="Confirmar senha"
                value={confirmPassword}
                onChange={value => setConfirmPassword(value)}
                autoComplete="new-password"
                error={
                  passwordsMismatch ? "As senhas não coincidem." : null
                }
                disabled={register.isPending}
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
                aria-busy={register.isPending}
                className="h-12 w-full rounded-md bg-[#5865F2] text-base font-semibold text-white hover:bg-[#4752C4]"
              >
                {register.isPending && (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                )}
                {register.isPending ? "Criando conta..." : "Criar conta"}
              </Button>
            </form>

            <p className="mt-6 text-sm text-muted2">
              Já tem uma conta?{" "}
              <Link
                to="/login"
                className="font-medium text-[#00A8FC] transition-colors hover:text-[#4dbaff] hover:underline"
              >
                Entrar
              </Link>
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
