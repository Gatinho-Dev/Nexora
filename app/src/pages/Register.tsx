import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Register() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const register = trpc.account.register.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      navigate("/channels/@me");
    },
    onError: (err) => setError(err.message),
  });

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
          <h1 className="text-2xl font-bold">Criar uma conta</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Junte-se ao Pulsar em segundos
          </p>
        </div>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            register.mutate({
              username: username.trim(),
              displayName: displayName.trim(),
              password,
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="username">Nome de usuário</Label>
            <Input
              id="username"
              autoComplete="username"
              placeholder="ex.: ana.silva"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Letras, números, ponto, hífen e sublinhado. É como seus amigos vão te encontrar.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="displayName">Nome de exibição</Label>
            <Input
              id="displayName"
              placeholder="ex.: Ana Silva"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
            <p className="text-xs text-muted-foreground">Mínimo de 6 caracteres.</p>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/15 text-destructive text-sm px-3 py-2">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={register.isPending}>
            {register.isPending ? "Criando conta..." : "Continuar"}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground mt-4">
          Já tem uma conta?{" "}
          <Link to="/login" className="chat-link font-medium">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
