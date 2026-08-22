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
    onError: err => setError(err.message),
  });

  return (
    <main className="min-h-[100dvh] flex items-center justify-center bg-[#313338] p-4 sm:p-6 select-none text-white">
      <div className="w-full max-w-[480px] rounded-xl bg-[#2B2D31] border border-black/20 p-6 sm:p-8 shadow-[0_24px_64px_rgba(0,0,0,0.34)]">
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-[14px] bg-[#5865F2] flex items-center justify-center mb-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
            <span className="font-black text-xl text-white">N</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Criar uma conta
          </h1>
          <p className="text-[#B5BAC1] text-sm mt-2">
            Crie sua conta e encontre sua comunidade.
          </p>
        </div>

        <form
          className="space-y-4"
          onSubmit={e => {
            e.preventDefault();
            setError(null);
            register.mutate({
              username: username.trim(),
              displayName: displayName.trim(),
              password,
            });
          }}
        >
          <div className="space-y-1.5">
            <Label
              htmlFor="username"
              className="text-xs font-bold uppercase text-[#B5BAC1]"
            >
              Nome de usuário
            </Label>
            <Input
              id="username"
              className="h-11 bg-[#1E1F22] border-black/20 text-white focus-visible:ring-[#5865F2]"
              autoComplete="username"
              placeholder="ex.: ana.silva"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />
            <p className="text-xs text-[#B5BAC1]">
              É assim que seus amigos vão te encontrar no Nexora.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="displayName"
              className="text-xs font-bold uppercase text-[#B5BAC1]"
            >
              Nome de exibição
            </Label>
            <Input
              id="displayName"
              className="h-11 bg-[#1E1F22] border-black/20 text-white focus-visible:ring-[#5865F2]"
              placeholder="ex.: Ana Silva"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="password"
              className="text-xs font-bold uppercase text-[#B5BAC1]"
            >
              Senha
            </Label>
            <Input
              id="password"
              type="password"
              className="h-11 bg-[#1E1F22] border-black/20 text-white focus-visible:ring-[#5865F2]"
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
            />
            <p className="text-xs text-[#B5BAC1]">Mínimo de 6 caracteres.</p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-xs px-3.5 py-2.5 font-medium">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold h-11 rounded-md"
            disabled={register.isPending}
          >
            {register.isPending ? "Criando conta..." : "Continuar"}
          </Button>
        </form>

        <p className="text-sm text-[#B5BAC1] mt-5">
          Já tem uma conta?{" "}
          <Link
            to="/login"
            className="text-[#00A8FC] hover:underline font-medium"
          >
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
