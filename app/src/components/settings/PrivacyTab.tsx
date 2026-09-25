import { useState } from "react";
import { Settings2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { openAdSensePrivacySettings } from "@/lib/adsense";
import type { ExplicitMediaLevel, SpamFilterLevel } from "@/lib/clientSettings";
import { useSettingsStore } from "@/store/useSettingsStore";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/Avatar";
import {
  DiscordCard,
  DiscordDivider,
  DiscordPageHeader,
  DiscordRadioCards,
  DiscordSelect,
  DiscordToggle,
} from "@/components/settings/DiscordSettings";

const EXPLICIT_MEDIA_OPTIONS: { value: ExplicitMediaLevel; label: string }[] = [
  { value: "block", label: "Bloquear" },
  { value: "blur", label: "Borrar" },
  { value: "allow", label: "Permitir" },
];

const SPAM_FILTER_OPTIONS: {
  value: SpamFilterLevel;
  label: string;
  description: string;
}[] = [
  {
    value: "all",
    label: "Filtrar todos",
    description: "Nenhuma mensagem de não-contato chega até você.",
  },
  {
    value: "unknown",
    label: "Filtrar desconhecidos",
    description: "Só quem você já conversou passa sem filtro.",
  },
  {
    value: "none",
    label: "Não filtrar",
    description: "Tudo chega normalmente — use com atenção.",
  },
];

/**
 * "Conteúdo e Privacidade".
 *
 * As preferências de filtro (explícito, spam, telemetria) vivem na store
 * global; bloqueios, restrições, recibos e DMs continuam no backend, porque têm
 * efeito imediato sobre outras pessoas.
 */
export function PrivacyTab() {
  const utils = trpc.useUtils();
  const privacy = trpc.account.privacy.useQuery();
  const syncedPreferences = trpc.advanced.profile.preferences.useQuery();
  const blocks = trpc.advanced.security.blocks.useQuery();
  const restrictions = trpc.advanced.security.restrictions.useQuery();
  const [readReceipts, setReadReceipts] = useState<boolean | null>(null);
  const [adPreferencesOpening, setAdPreferencesOpening] = useState(false);
  const {
    explicitMediaFriends,
    explicitMediaUnknown,
    explicitMediaServers,
    spamFilter,
    telemetryImprovement,
    telemetryPersonalization,
  } = useSettingsStore(state => state.settings);
  const patch = useSettingsStore(state => state.patch);

  const openAdPreferences = async () => {
    setAdPreferencesOpening(true);
    try {
      const opened = await openAdSensePrivacySettings();
      if (!opened) {
        toast.error(
          "O gerenciador oficial do Google ainda não está disponível nesta sessão. Verifique a mensagem em Privacy & messaging.",
        );
      }
    } finally {
      setAdPreferencesOpening(false);
    }
  };

  const setPrivacy = trpc.account.setPrivacy.useMutation({
    onSuccess: () => void utils.account.privacy.invalidate(),
    onError: e => toast.error(e.message),
  });
  const saveSyncedPreferences = trpc.advanced.profile.updatePreferences.useMutation({
    onSuccess: () => void syncedPreferences.refetch(),
    onError: error => {
      if (error.data?.code === "CONFLICT") void syncedPreferences.refetch();
      toast.error(error.message);
    },
  });
  const unblock = trpc.advanced.security.setBlocked.useMutation({
    onSuccess: () => {
      toast.success("Usuário desbloqueado.");
      void blocks.refetch();
    },
    onError: error => toast.error(error.message),
  });
  const unrestrict = trpc.advanced.security.setRestricted.useMutation({
    onSuccess: () => {
      toast.success("Restrição removida.");
      void restrictions.refetch();
    },
    onError: error => toast.error(error.message),
  });

  const serverValue = privacy.data?.readReceipts ?? true;
  const [synced, setSynced] = useState(false);
  if (!synced && privacy.isSuccess) {
    setSynced(true);
    setReadReceipts(serverValue);
  }

  const current = readReceipts ?? serverValue;
  const rawPrivacy = syncedPreferences.data?.data.privacy;
  const syncedPrivacy =
    rawPrivacy && typeof rawPrivacy === "object" && !Array.isArray(rawPrivacy)
      ? (rawPrivacy as Record<string, unknown>)
      : {};
  const allowServerDms = syncedPrivacy.allowServerDms !== false;
  const filterUnknownDms = syncedPrivacy.filterUnknownDms !== false;
  const updateSyncedPrivacy = (privacyPatch: Record<string, boolean>) =>
    saveSyncedPreferences.mutate({
      expectedVersion: syncedPreferences.data?.version ?? 0,
      data: {
        ...(syncedPreferences.data?.data ?? {}),
        privacy: { ...syncedPrivacy, ...privacyPatch },
      },
    });

  return (
    <div className="space-y-5">
      <DiscordPageHeader
        title="Conteúdo e Privacidade"
        description="Quem pode falar com você, o que aparece das suas mensagens e como seus dados são usados."
      />

      <section
        className="rounded-lg border border-[#5865F2]/25 bg-[#5865F2]/[0.07] p-4"
        aria-labelledby="ad-preferences-title"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#5865F2]/20 text-[#aab1ff]">
            <Settings2 className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 id="ad-preferences-title" className="text-sm font-bold text-white">
              Preferências de anúncios
            </h3>
            <p className="mt-1 text-[11px] leading-5 text-muted2">
              Abre o gerenciador oficial da mensagem de consentimento do Google.
              A CMP publicada em Privacy &amp; messaging continua sendo a única
              fonte das escolhas e dos sinais de publicidade.
            </p>
            <Button
              type="button"
              onClick={() => void openAdPreferences()}
              disabled={adPreferencesOpening}
              className="mt-3 bg-[#5865F2] text-white hover:bg-[#4752C4]"
            >
              {adPreferencesOpening
                ? "Abrindo gerenciador..."
                : "Gerenciar preferências"}
            </Button>
            <p className="mt-2 text-[10px] leading-4 text-muted2">
              Este botão não cria um banner, uma segunda lista de consentimento
              nem altera a decisão por conta própria.
            </p>
          </div>
        </div>
      </section>

      <DiscordCard
        title="Filtro de conteúdo explícito"
        description="Cada contexto tem seu próprio nível: bloqueada some da conversa, borrada só aparece quando você toca nela."
      >
        <DiscordSelect
          label="Mensagens de amigos"
          value={explicitMediaFriends}
          onChange={value => patch({ explicitMediaFriends: value })}
          options={EXPLICIT_MEDIA_OPTIONS}
        />
        <DiscordDivider />
        <DiscordSelect
          label="Mensagens de desconhecidos"
          value={explicitMediaUnknown}
          onChange={value => patch({ explicitMediaUnknown: value })}
          options={EXPLICIT_MEDIA_OPTIONS}
        />
        <DiscordDivider />
        <DiscordSelect
          label="Canais de servidor"
          value={explicitMediaServers}
          onChange={value => patch({ explicitMediaServers: value })}
          options={EXPLICIT_MEDIA_OPTIONS}
        />
      </DiscordCard>

      <DiscordCard
        title="Filtro de spam"
        description="Nível de bloqueio automático das mensagens diretas de quem você não conhece."
      >
        <div className="px-4 py-2">
          <DiscordRadioCards
            legend="Nível do filtro de spam"
            options={SPAM_FILTER_OPTIONS}
            value={spamFilter}
            onChange={value => patch({ spamFilter: value })}
          />
        </div>
      </DiscordCard>

      <DiscordCard
        title="Telemetria e dados de uso"
        description="Controla o que a Nexora usa para melhorar o produto. O gerenciamento de publicidade é feito pelo botão oficial do Google, no topo desta página."
      >
        <DiscordToggle
          label="Usar dados para melhorar o aplicativo"
          description="Relatórios de falhas e métricas de desempenho agregadas."
          checked={telemetryImprovement}
          onCheckedChange={value => patch({ telemetryImprovement: value })}
        />
        <DiscordDivider />
        <DiscordToggle
          label="Usar dados para personalizar anúncios e patrocínios"
          description="Não cria nem altera nenhuma escolha de consentimento: a mensagem publicada no Google AdSense é a única fonte."
          checked={telemetryPersonalization}
          onCheckedChange={value => patch({ telemetryPersonalization: value })}
        />
      </DiscordCard>

      <DiscordCard
        title="Mensagens diretas"
        description="Quem pode abrir uma conversa com você."
      >
        <DiscordToggle
          label="Permitir mensagens diretas de membros do servidor"
          description="Desativado, só quem já está em DM com você consegue responder."
          checked={allowServerDms}
          disabled={!syncedPreferences.data || saveSyncedPreferences.isPending}
          onCheckedChange={value => updateSyncedPrivacy({ allowServerDms: value })}
        />
        <DiscordDivider />
        <DiscordToggle
          label="Filtrar mensagens diretas de desconhecidos"
          description="Mensagens de quem não é seu contato ficam retidas para aprovação."
          checked={filterUnknownDms}
          disabled={!syncedPreferences.data || saveSyncedPreferences.isPending}
          onCheckedChange={value => updateSyncedPrivacy({ filterUnknownDms: value })}
        />
        <DiscordDivider />
        <DiscordToggle
          label="Recibos de leitura"
          description="Quando desativado, seu nome não aparece em “Visto por” nos grupos."
          checked={current}
          disabled={setPrivacy.isPending || !privacy.isSuccess}
          onCheckedChange={value => {
            setReadReceipts(value);
            setPrivacy.mutate({ readReceipts: value });
          }}
        />
      </DiscordCard>

      <UserListCard
        title="Usuários bloqueados"
        description="Bloqueios também impedem DMs e pedidos de amizade."
        empty="Nenhum usuário bloqueado."
        loading={blocks.isLoading}
        rows={blocks.data?.map(row => ({
          userId: row.user.id,
          key: String(row.block.id),
          name: row.user.name ?? row.user.username ?? "Usuário",
          username: row.user.username,
          avatar: row.user.avatar,
        }))}
        actionLabel="Desbloquear"
        actionDisabled={unblock.isPending}
        onAction={userId =>
          unblock.mutate({ userId, blocked: false })
        }
      />

      <UserListCard
        title="Usuários restritos"
        description="Conteúdo filtrado sem avisar a outra pessoa."
        empty="Nenhum usuário restrito."
        loading={restrictions.isLoading}
        rows={restrictions.data?.map(row => ({
          userId: row.user.id,
          key: String(row.restriction.id),
          name: row.user.name ?? row.user.username ?? "Usuário",
          subtitle: "Mensagens e chamadas filtradas",
          avatar: row.user.avatar,
        }))}
        actionLabel="Remover"
        actionDisabled={unrestrict.isPending}
        onAction={userId =>
          unrestrict.mutate({
            userId,
            restricted: false,
            filterMessages: true,
            muteCalls: true,
            muteNotifications: true,
            hidePresence: false,
          })
        }
      />
    </div>
  );
}

type UserListRow = {
  userId: number;
  key: string;
  name: string;
  username?: string | null;
  subtitle?: string;
  avatar?: string | null;
};

function UserListCard({
  title,
  description,
  empty,
  loading,
  rows,
  actionLabel,
  actionDisabled,
  onAction,
}: {
  title: string;
  description: string;
  empty: string;
  loading: boolean;
  rows?: UserListRow[];
  actionLabel: string;
  actionDisabled: boolean;
  onAction: (userId: number) => void;
}) {
  return (
    <section className="rounded-lg border border-black/15 bg-[#232428] p-4">
      <h3 className="text-sm font-bold text-white">{title}</h3>
      <p className="mt-1 text-[11px] text-muted2">{description}</p>
      <div className="mt-3 space-y-2">
        {loading ? (
          <p className="py-3 text-center text-xs text-muted2">Carregando…</p>
        ) : rows?.length ? (
          rows.map(row => (
            <div
              key={row.key}
              className="flex min-h-12 items-center gap-3 rounded-lg bg-black/20 px-3"
            >
              <Avatar
                name={row.name}
                src={row.avatar}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-white">
                  {row.name}
                </p>
                <p className="truncate text-[10px] text-muted2">
                  {row.subtitle ?? (row.username ? `@${row.username}` : "")}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                disabled={actionDisabled}
                onClick={() => onAction(row.userId)}
              >
                {actionLabel}
              </Button>
            </div>
          ))
        ) : (
          <p className="py-3 text-center text-xs text-muted2">{empty}</p>
        )}
      </div>
    </section>
  );
}
