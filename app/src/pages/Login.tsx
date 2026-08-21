import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Kimi OAuth (alternative sign-in) — URL construction per platform template
function getOAuthUrl() {
  const kimiAuthUrl = import.meta.env.VITE_KIMI_AUTH_URL;
  const appID = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
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
    onError: (err) => setError(err.message),
  });

  const hasOAuth = !!import.meta.env.VITE_KIMI_AUTH_URL;

  return (
    <div className="min-h-screen flex items-center justify-center bg-rail p-4">
      <div className="w-full max-w-md rounded-2xl bg-card border border-border p-8 shadow-xl">
        <div className="flex flex-col items-center mb-8">
          <div className="pulsar-mark h-14 w-14 rounded-2xl flex items-center justify-center mb-4">
            <svg viewBox="0 0 64 64" className="h-8 w-8">
              <circle cx="32" cy="32" r="17" fill="none" stroke="#0d1117" strokeWidth="5" />
              <circle cx="32" cy="32" r="7" fill="#0d1117" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Bem-vindo de volta!</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Entre na sua conta Pulsar
          </p>
        </div>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            login.mutate({ username: username.trim(), password });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="username">Nome de usuário</Label>
            <Input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Esqueceu a senha? <span className="opacity-70">Recuperação por e-mail — em breve.</span>
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/15 text-destructive text-sm px-3 py-2">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={login.isPending}>
            {login.isPending ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground mt-4">
          Precisa de uma conta?{" "}
          <Link to="/register" className="chat-link font-medium">
            Registrar
          </Link>
        </p>

        {hasOAuth && (
          <>
            <div className="flex items-center gap-3 my-5">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">OU</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                window.location.href = getOAuthUrl();
              }}
            >
              Entrar com Kimi
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
