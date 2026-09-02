import { useEffect } from "react";
import {
  ExternalLink,
  Gamepad2,
  Github,
  Music2,
  Radio,
  ShieldCheck,
  Youtube,
} from "lucide-react";
import { toast } from "sonner";
import { apiUrl } from "@/lib/endpoints";
import { trpc } from "@/providers/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ProviderId = "spotify" | "youtube" | "twitch" | "github" | "roblox";

const DESCRIPTIONS: Record<ProviderId, string> = {
  spotify:
    "Mostre a faixa que está tocando, com capa e progresso em tempo real.",
  youtube:
    "Exiba seu canal conectado. A Nexora não inventa o vídeo que você está assistindo.",
  twitch: "Mostre seu canal e sua transmissão quando você estiver ao vivo.",
  github:
    "Exiba seu perfil público sem solicitar acesso a repositórios privados.",
  roblox:
    "Mostre sua conta e a experiência em que você está jogando quando a API permitir.",
};

function ProviderIcon({ provider }: { provider: ProviderId }) {
  if (provider === "spotify") return <Music2 className="h-5 w-5" />;
  if (provider === "youtube") return <Youtube className="h-5 w-5" />;
  if (provider === "twitch") return <Radio className="h-5 w-5" />;
  if (provider === "github") return <Github className="h-5 w-5" />;
  return <Gamepad2 className="h-5 w-5" />;
}

export function ConnectionsSection() {
  const utils = trpc.useUtils();
  const providers = trpc.integrations.providers.useQuery();
  const refetchProviders = providers.refetch;
  const settings = trpc.integrations.providerSettings.useMutation({
    onSettled: () => void utils.integrations.providers.invalidate(),
    onError: error => toast.error(error.message),
  });
  const disconnect = trpc.integrations.providerDisconnect.useMutation({
    onSuccess: async (_, variables) => {
      toast.success(`${variables.provider} foi desconectado.`);
      await Promise.all([
        utils.integrations.providers.invalidate(),
        utils.integrations.userPresence.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const provider = params.get("integration");
    const status = params.get("status");
    if (!provider || !status) return;
    if (status === "connected")
      toast.success(`${provider} conectado com sucesso.`);
    else if (status === "cancelled") toast.info("Conexão cancelada.");
    else if (status === "already_linked")
      toast.error("Essa conta já está ligada a outro usuário Nexora.");
    else if (status === "invalid_state")
      toast.error("A autorização expirou. Tente conectar novamente.");
    else toast.error(`Não foi possível conectar ${provider}.`);
    params.delete("integration");
    params.delete("status");
    const query = params.toString();
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`
    );
    void refetchProviders();
  }, [refetchProviders]);

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-white">Conexões</h2>
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
        </div>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted2">
          Vincule serviços oficiais ao seu perfil. Tokens ficam criptografados
          no servidor e cada atividade respeita sua privacidade, bloqueios e
          modo invisível.
        </p>
      </div>

      {providers.isLoading && (
        <div className="grid gap-3 lg:grid-cols-2">
          {[0, 1, 2, 3].map(item => (
            <div
              key={item}
              className="h-44 animate-pulse rounded-2xl bg-white/5"
            />
          ))}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {providers.data?.map(provider => {
          const id = provider.id as ProviderId;
          return (
            <article
              key={id}
              className="rounded-2xl border border-white/10 bg-sidebar p-4 shadow-sm transition-colors hover:border-white/20"
            >
              <div className="flex items-start gap-3">
                {provider.account?.avatarUrl ? (
                  <img
                    src={provider.account.avatarUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-11 w-11 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.07] text-white/80">
                    <ProviderIcon provider={id} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-black text-white">
                      {provider.label}
                    </h3>
                    {provider.connected && (
                      <Badge className="border-0 bg-emerald-400/10 text-[10px] text-emerald-300 hover:bg-emerald-400/10">
                        Conectado
                      </Badge>
                    )}
                    {!provider.configured && (
                      <Badge
                        variant="outline"
                        className="border-amber-400/30 bg-amber-400/10 text-[10px] text-amber-300"
                      >
                        Indisponível
                      </Badge>
                    )}
                  </div>
                  {provider.connected ? (
                    <p className="mt-0.5 truncate text-xs text-white/55">
                      @
                      {provider.account?.username ??
                        provider.account?.displayName ??
                        "conta"}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs leading-relaxed text-white/55">
                      {DESCRIPTIONS[id]}
                    </p>
                  )}
                </div>
                {provider.account?.profileUrl && (
                  <a
                    href={provider.account.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Abrir perfil ${provider.label}`}
                    className="rounded-lg p-2 text-white/40 hover:bg-white/5 hover:text-white"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>

              {!provider.connected ? (
                <Button
                  size="sm"
                  disabled={!provider.configured || !provider.enabled}
                  onClick={() => {
                    window.location.href = apiUrl(
                      `/api/integrations/${id}/connect`
                    );
                  }}
                  className="mt-4 h-9 w-full bg-[#5865F2] text-xs hover:bg-[#4752C4]"
                >
                  Conectar {provider.label}
                </Button>
              ) : (
                <div className="mt-4 space-y-3 border-t border-white/[0.08] pt-4">
                  {provider.account?.needsReauth && (
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href = apiUrl(
                          `/api/integrations/${id}/connect`
                        );
                      }}
                      className="w-full rounded-lg bg-amber-400/10 px-3 py-2 text-left text-xs font-bold text-amber-300 hover:bg-amber-400/15"
                    >
                      A conexão expirou — reconectar agora
                    </button>
                  )}
                  <SettingRow
                    label="Exibir conexão no perfil"
                    checked={provider.settings?.showOnProfile ?? true}
                    onCheckedChange={value =>
                      settings.mutate({ provider: id, showOnProfile: value })
                    }
                  />
                  {provider.capabilities.livePresence && (
                    <>
                      <SettingRow
                        label="Exibir atividade"
                        checked={provider.settings?.showActivity ?? true}
                        onCheckedChange={value =>
                          settings.mutate({ provider: id, showActivity: value })
                        }
                      />
                      <SettingRow
                        label="Mostrar detalhes"
                        checked={provider.settings?.showDetails ?? true}
                        onCheckedChange={value =>
                          settings.mutate({ provider: id, showDetails: value })
                        }
                      />
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-white/70">
                          Visibilidade
                        </span>
                        <Select
                          value={
                            provider.settings?.activityVisibility ?? "everyone"
                          }
                          onValueChange={value =>
                            settings.mutate({
                              provider: id,
                              activityVisibility: value as
                                "everyone" | "friends" | "private",
                            })
                          }
                        >
                          <SelectTrigger className="h-8 w-36 border-white/10 bg-white/5 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="everyone">Permitidos</SelectItem>
                            <SelectItem value="friends">Só amigos</SelectItem>
                            <SelectItem value="private">Somente eu</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={disconnect.isPending}
                    onClick={() => disconnect.mutate({ provider: id })}
                    className="h-8 w-full text-xs text-red-300 hover:bg-red-400/10 hover:text-red-200"
                  >
                    Desconectar
                  </Button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function SettingRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-3">
      <span className="text-xs font-semibold text-white/70">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
