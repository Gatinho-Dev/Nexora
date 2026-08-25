import { useEffect } from "react";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import { ExternalLink, Gamepad2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const CONNECT_URL = "/api/integrations/roblox/connect";

type RobloxSettings = {
  showOnProfile: boolean;
  showActivity: boolean;
  allowJoin: boolean;
};

/** Configurações → Minha Conta → Conexões (integração Roblox). */
export function ConnectionsSection() {
  const utils = trpc.useUtils();
  const roblox = trpc.integrations.roblox.useQuery();

  // Pós-OAuth: backend volta para / com ?roblox=conectado|cancelado|erro|em-uso
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("roblox");
    if (!result) return;
    if (result === "conectado") {
      toast.success("Conta Roblox conectada com sucesso.");
      void utils.integrations.roblox.invalidate();
    } else if (result === "cancelado") {
      toast("Conexão com Roblox cancelada.");
    } else if (result === "em-uso") {
      toast.error(
        "Esta conta Roblox já está conectada a outra conta Nexora."
      );
    } else {
      toast.error("Não foi possível conectar sua conta Roblox.");
    }
    params.delete("roblox");
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (qs ? `?${qs}` : "")
    );
  }, [utils]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white">Conexões</h2>
        <p className="text-xs text-muted2 mt-1">
          Conecte suas contas para exibir no perfil da Nexora.
        </p>
      </div>
      {roblox.isLoading ? <ConnectionSkeleton /> : <RobloxCard />}
    </div>
  );
}

function ConnectionSkeleton() {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-white/10 bg-sidebar p-5">
      <Skeleton className="h-12 w-12 shrink-0 rounded-xl bg-white/[0.06]" />
      <div className="flex-1 space-y-2 py-1">
        <Skeleton className="h-4 w-28 bg-white/[0.06]" />
        <Skeleton className="h-3 w-64 bg-white/[0.06]" />
      </div>
    </div>
  );
}

function RobloxCard() {
  const utils = trpc.useUtils();
  const roblox = trpc.integrations.roblox.useQuery();
  const data = roblox.data;

  const setSetting = trpc.integrations.robloxSettings.useMutation({
    onSettled: () => void utils.integrations.roblox.invalidate(),
    onError: e => toast.error(e.message),
  });
  const disconnect = trpc.integrations.robloxDisconnect.useMutation({
    onSuccess: async () => {
      toast.success("Conta Roblox desconectada.");
      await utils.integrations.userActivity.invalidate();
      await utils.integrations.roblox.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  if (!data) return null;

  if (!data.connected) {
    return (
      <div className="flex items-start gap-4 rounded-xl border border-white/10 bg-sidebar p-5 transition-[color,background-color,border-color,box-shadow] hover:border-white/20">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-muted2">
          <Gamepad2 className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold tracking-wide text-white">ROBLOX</p>
            {!data.configured && (
              <Badge
                variant="outline"
                className="border-amber-400/30 bg-amber-400/10 text-[10px] font-semibold uppercase tracking-wide text-amber-400"
              >
                Indisponível no momento
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted2">
            Conecte sua conta Roblox para mostrar sua atividade na Nexora.
          </p>
          <Button
            size="sm"
            disabled={!data.configured}
            onClick={() => {
              window.location.href = CONNECT_URL;
            }}
            className="mt-3 h-9 rounded-lg bg-[#5865F2] px-4 text-xs font-semibold text-white hover:bg-[#4752C4]"
          >
            Conectar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ConnectedCard
      username={data.username ?? "roblox"}
      displayName={data.displayName}
      avatarUrl={data.avatarUrl}
      profileUrl={data.profileUrl}
      needsReauth={!!data.needsReauth}
      settings={data.settings}
      pendingDisconnect={disconnect.isPending}
      onToggle={patch => setSetting.mutate(patch)}
      onDisconnect={() => disconnect.mutate()}
    />
  );
}

function ConnectedCard({
  username,
  displayName,
  avatarUrl,
  profileUrl,
  needsReauth,
  settings,
  pendingDisconnect,
  onToggle,
  onDisconnect,
}: {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  profileUrl: string | null;
  needsReauth: boolean;
  settings: RobloxSettings;
  pendingDisconnect: boolean;
  onToggle: (patch: Partial<RobloxSettings>) => void;
  onDisconnect: () => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-sidebar p-5 transition-[color,background-color,border-color,box-shadow] hover:border-white/20">
        <div className="flex items-start gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={`Avatar Roblox de ${displayName ?? username}`}
              loading="lazy"
              className="h-12 w-12 shrink-0 rounded-xl object-cover"
            />
          ) : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-muted2">
              <Gamepad2 className="h-6 w-6" aria-hidden />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">
              {displayName ?? username}
            </p>
            <p className="truncate text-xs text-muted2">@{username}</p>
            {needsReauth ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400">
                  Reconecte sua conta Roblox.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = CONNECT_URL;
                  }}
                  className="text-[11px] font-bold text-[#7383FF] underline-offset-2 hover:underline"
                >
                  Reconectar agora
                </button>
              </div>
            ) : (
              <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                ✓ Conta conectada
              </p>
            )}
          </div>
        </div>

        {/* Visibilidade da atividade */}
        <div className="mt-5 border-t border-white/5 pt-4">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-faint">
            Visibilidade da atividade
          </h3>
          <div className="mt-3 space-y-3">
            <SettingRow
              label="Mostrar no perfil"
              description="Exibe a conexão Roblox no seu perfil da Nexora."
              checked={settings.showOnProfile}
              onCheckedChange={v => onToggle({ showOnProfile: v })}
            />
            <SettingRow
              label="Mostrar atividade"
              description="Mostra o jogo em que você está jogando agora."
              checked={settings.showActivity}
              onCheckedChange={v => onToggle({ showActivity: v })}
            />
            <SettingRow
              label="Permitir que amigos entrem no servidor"
              description="Amigos podem acompanhar sua partida pelo seu perfil."
              checked={settings.allowJoin}
              onCheckedChange={v => onToggle({ allowJoin: v })}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 border-t border-white/5 pt-4">
          <Button asChild variant="secondary" size="sm" disabled={!profileUrl}>
            <a
              href={profileUrl ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Ver perfil
            </a>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
                disabled={pendingDisconnect}
                className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
              >
                {pendingDisconnect ? "Desconectando..." : "Desconectar"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-panel border-white/10 sm:max-w-sm">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-base text-white">
                  Desconectar sua conta Roblox da Nexora?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-xs leading-relaxed text-muted2">
                  Sua atividade deixará de aparecer para outros usuários.
                  Você pode reconectar a qualquer momento.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="h-9 border-white/10 bg-transparent text-xs font-semibold text-white hover:bg-white/5">
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDisconnect}
                  className="h-9 bg-red-500 text-xs font-semibold text-white hover:bg-red-600"
                >
                  Desconectar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
  );
}

function SettingRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-white">{label}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted2">
          {description}
        </p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={label}
      />
    </div>
  );
}
