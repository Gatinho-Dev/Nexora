import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiUrl } from "@/lib/endpoints";
import { NexoraAppIcon } from "@/components/NexoraBrand";

function getOAuthUrl() {
  const kimiAuthUrl = import.meta.env.VITE_KIMI_AUTH_URL;
  const appID = import.meta.env.VITE_APP_ID;
  const redirectUri = apiUrl("/api/oauth/callback");
  const state = btoa(redirectUri);

  const url = new URL(`${kimiAuthUrl}/api/oauth/authorize`);
  url.searchParams.set("client_id", appID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "profile");
  url.searchParams.set("state", state);

  return url.toString();
}

export default function Login() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const login = trpc.account.login.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      navigate("/channels/@me");
    },
    onError: err => setError(err.message),
  });

  const hasOAuth = !!import.meta.env.VITE_KIMI_AUTH_URL;

  return (
    <main className="min-h-[100dvh] flex items-center justify-center bg-chat p-4 sm:p-6 select-none text-white">
      <div className="w-full max-w-[480px] rounded-xl bg-sidebar border border-black/20 p-6 sm:p-8 shadow-[0_24px_64px_rgba(0,0,0,0.34)]">
        <div className="flex flex-col items-center mb-8 text-center">
          <NexoraAppIcon className="mb-5 h-12 w-12" />
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-white">
            Bem-vindo de volta!
          </h1>
          <p className="text-muted2 text-sm mt-2">
            Estamos muito felizes em ver você novamente.
          </p>
        </div>

        <form
          className="space-y-4"
          onSubmit={e => {
            e.preventDefault();
            setError(null);
            login.mutate({ username: username.trim(), password });
          }}
        >
          <div className="space-y-1.5">
            <Label
              htmlFor="username"
              className="text-xs font-bold uppercase text-muted2"
            >
              Nome de usuário
            </Label>
            <Input
              id="username"
              className="h-11 bg-rail border-black/20 text-white focus-visible:ring-[#5865F2]"
              autoComplete="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="password"
              className="text-xs font-bold uppercase text-muted2"
            >
              Senha
            </Label>
            <Input
              id="password"
              type="password"
              className="h-11 bg-rail border-black/20 text-white focus-visible:ring-[#5865F2]"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-xs px-3.5 py-2.5 font-medium">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold h-11 rounded-md"
            disabled={login.isPending}
          >
            {login.isPending ? "Entrando..." : "Entrar na Nexora"}
          </Button>
        </form>

        <p className="text-sm text-muted2 mt-5">
          Precisa de uma conta?{" "}
          <Link
            to="/register"
            className="text-[#00A8FC] hover:underline font-medium"
          >
            Registrar-se
          </Link>
        </p>

        {hasOAuth && (
          <>
            <div className="flex items-center gap-3 my-5">
              <div className="h-px flex-1 bg-[#3F4147]" />
              <span className="text-[10px] font-bold text-muted2">OU</span>
              <div className="h-px flex-1 bg-[#3F4147]" />
            </div>
            <Button
              variant="outline"
              className="w-full h-11 bg-hov border-white/10 text-white hover:bg-[#3F4147]"
              onClick={() => {
                window.location.href = getOAuthUrl();
              }}
            >
              Entrar com Kimi
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
