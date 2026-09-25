import { Gamepad2, Github, Music2, Radio, UserPlus, Youtube } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { Switch } from "@/components/ui/switch";
import {
  DiscordCard,
  DiscordPageHeader,
  DiscordRadioCards,
  DiscordSectionTitle,
} from "@/components/settings/DiscordSettings";
import { useSettingsStore } from "@/store/useSettingsStore";
import type { FriendRequestPolicy } from "@/lib/clientSettings";

/** Provedores realmente implementados (mesma lista de `ConnectionsSection`). */
type ProviderId = "spotify" | "youtube" | "twitch" | "github" | "roblox";

/** Ícones por provedor — espelha `ConnectionsSection`, sem inventar integrações. */
const PROVIDER_ICONS: Record<string, React.ReactNode> = {
  spotify: <Music2 className="size-5" />,
  youtube: <Youtube className="size-5" />,
  twitch: <Radio className="size-5" />,
  github: <Github className="size-5" />,
  roblox: <Gamepad2 className="size-5" />,
};

const POLICY_OPTIONS: { value: FriendRequestPolicy; label: string; description: string }[] = [
  {
    value: "everyone",
    label: "Todo mundo",
    description: "Qualquer pessoa da Nexora pode enviar um pedido.",
  },
  {
    value: "mutuals",
    label: "Amigos de amigos",
    description: "Só quem tem um amigo em comum com você.",
  },
  {
    value: "servers",
    label: "Membros de servidores em comum",
    description: "Somente pessoas com quem você compartilha um servidor.",
  },
];

/**
 * "Pedidos de Amizade & Conexões".
 *
 * A grade lista apenas integrações realmente implementadas no backend
 * (`integrations.providers`) — nada de plataformas fictícias.
 */
export function FriendRequestsTab() {
  const utils = trpc.useUtils();
  const friendRequests = useSettingsStore(state => state.settings.friendRequests);
  const patch = useSettingsStore(state => state.patch);

  const providers = trpc.integrations.providers.useQuery();
  const providerSettings = trpc.integrations.providerSettings.useMutation({
    onSettled: () => void utils.integrations.providers.invalidate(),
    onError: error => toast.error(error.message),
  });

  const connected = (providers.data ?? []).filter(provider => provider.connected);

  return (
    <div className="space-y-6">
      <DiscordPageHeader
        title="Pedidos de Amizade e Conexões"
        description="Defina quem pode falar com você e controle o que cada serviço vinculado pode exibir."
      />

      <DiscordCard
        title="Quem pode enviar pedidos de amizade"
        description="Vale para todo mundo, inclusive servidores e mensagens diretas."
      >
        <DiscordRadioCards
          legend="Origem dos pedidos de amizade"
          options={POLICY_OPTIONS}
          value={friendRequests}
          onChange={value => patch({ friendRequests: value })}
        />
      </DiscordCard>

      <section className="space-y-3">
        <DiscordSectionTitle>Conexões</DiscordSectionTitle>
        {providers.isLoading ? (
          <p className="rounded-lg bg-[#232428] px-4 py-6 text-center text-xs text-[#B5BAC1]">
            Carregando conexões…
          </p>
        ) : connected.length === 0 ? (
          <p className="rounded-lg bg-[#232428] px-4 py-6 text-center text-xs text-[#B5BAC1]">
            Nenhum serviço vinculado. Use a aba{" "}
            <span className="font-semibold text-white">Conexões</span> para conectar
            Spotify, YouTube, Twitch, GitHub ou Roblox.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {connected.map(provider => (
              <li
                key={provider.id}
                className="rounded-lg border border-black/15 bg-[#232428] p-4"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/5 text-white/80"
                    aria-hidden
                  >
                    {PROVIDER_ICONS[provider.id] ?? <UserPlus className="size-5" />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-white">
                      {provider.label}
                    </p>
                    <p className="truncate text-[11px] text-[#B5BAC1]">
                      @
                      {provider.account?.username ??
                        provider.account?.displayName ??
                        "conta"}
                    </p>
                  </div>
                </div>
                <div className="mt-3 space-y-2 border-t border-black/20 pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[12px] text-[#B5BAC1]">Exibir no perfil</span>
                    <Switch
                      checked={provider.settings?.showOnProfile ?? true}
                      onCheckedChange={value =>
                        providerSettings.mutate({
                          provider: provider.id as ProviderId,
                          showOnProfile: value,
                        })
                      }
                      aria-label={`Exibir ${provider.label} no perfil`}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[12px] text-[#B5BAC1]">
                      Exibir como status
                    </span>
                    <Switch
                      checked={provider.settings?.showActivity ?? true}
                      onCheckedChange={value =>
                        providerSettings.mutate({
                          provider: provider.id as ProviderId,
                          showActivity: value,
                        })
                      }
                      aria-label={`Exibir ${provider.label} como status`}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
