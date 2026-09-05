import { Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";

export function IdentityPreferencesSection() {
  const { user } = useAuth();
  const profile = trpc.account.getPublicUser.useQuery({ userId: user?.id ?? 0 });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Identidade e status</h2>
        <p className="mt-1 text-xs text-muted2">
          Configure seu nome, biografia e preferências de privacidade.
        </p>
      </div>

      {profile.isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-8 w-8 animate-spin text-[#7383FF]" />
        </div>
      ) : profile.error || !profile.data ? (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-5 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-red-400" />
          <p className="mt-2 text-sm text-red-300">
            Não foi possível carregar o perfil.
          </p>
        </div>
      ) : (
        <section className="space-y-4 rounded-2xl border border-white/[0.08] bg-sidebar p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            Perfil básico
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-medium text-white">@username</label>
              <div className="text-sm text-white/60">
                @{profile.data.username ?? "—"}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-white">Nome de exibição</label>
              <div className="text-sm text-white">
                {profile.data.name ?? profile.data.username ?? "—"}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-white">Bio</label>
            <div className="text-sm text-white/60 whitespace-pre-wrap">
              {profile.data.bio ?? "Sem bio ainda."}
            </div>
          </div>
          <div className="pt-4 border-t border-white/[0.08]">
            <p className="text-xs text-muted2">
              Recursos avançados de identidade (pronome, localização, campos personalizados, status rico)
              estarão disponíveis após a atualização do sistema de perfis.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}