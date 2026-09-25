import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, EyeOff, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  DEFAULT_KEYBINDS,
  duplicateKeybinds,
  keybindFromEvent,
  KEYBIND_LABELS,
  parseKeybinds,
  type KeybindAction,
} from "@/lib/keybinds";
import {
  DiscordCard,
  DiscordDivider,
  DiscordPageHeader,
} from "@/components/settings/DiscordSettings";

/**
 * "Atalhos" — tabela de keybinds com modo de gravação, mais o Modo Streamer.
 *
 * Gravar é um fluxo de captura global de `keydown`: enquanto `recording` está
 * preenchido, o próximo evento vira a combinação (Exc cancela) e só então
 * sincroniza com o servidor.
 */
export function ShortcutsTab() {
  const preferences = trpc.advanced.profile.preferences.useQuery();
  const [recording, setRecording] = useState<KeybindAction | null>(null);
  const [localKeybinds, setLocalKeybinds] = useState(DEFAULT_KEYBINDS);
  // Mesma ideia da Aparência: derivar do servidor ajustando o estado durante o
  // render, guardando o último conteúdo aplicado para não reescrever a lista a
  // cada render (o que faria a gravação em andamento piscar).
  const [hydratedFrom, setHydratedFrom] = useState<string | null>(null);
  if (preferences.data) {
    const server = parseKeybinds(preferences.data.data);
    const key = JSON.stringify(server);
    if (key !== hydratedFrom) {
      setHydratedFrom(key);
      setLocalKeybinds(server);
    }
  }
  const update = trpc.advanced.profile.updatePreferences.useMutation({
    onSuccess: () => {
      void preferences.refetch();
      toast.success("Atalhos sincronizados.");
    },
    onError: error => {
      if (error.data?.code === "CONFLICT") void preferences.refetch();
      toast.error(error.message);
    },
  });

  const streamerRaw = preferences.data?.data.streamerMode;
  const streamer =
    streamerRaw && typeof streamerRaw === "object" && !Array.isArray(streamerRaw)
      ? (streamerRaw as Record<string, unknown>)
      : {};
  const streamerEnabled = streamer.enabled === true;
  const autoDetect = streamer.autoDetect !== false;

  const saveData = useCallback(
    (patch: Record<string, unknown>) =>
      update.mutate({
        expectedVersion: preferences.data?.version ?? 0,
        data: { ...(preferences.data?.data ?? {}), ...patch },
      }),
    [preferences.data?.data, preferences.data?.version, update]
  );

  useEffect(() => {
    if (!recording) return;
    const capture = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") {
        setRecording(null);
        return;
      }
      const shortcut = keybindFromEvent(event);
      if (!shortcut || ["Ctrl", "Alt", "Shift", "Meta"].includes(shortcut)) return;
      const next = { ...localKeybinds, [recording]: shortcut };
      setLocalKeybinds(next);
      setRecording(null);
      saveData({ keybinds: next });
    };
    window.addEventListener("keydown", capture, true);
    return () => window.removeEventListener("keydown", capture, true);
  }, [localKeybinds, recording, saveData]);

  const conflicts = duplicateKeybinds(localKeybinds);

  return (
    <div className="space-y-5">
      <DiscordPageHeader
        title="Atalhos globais"
        description="No aplicativo de desktop, os atalhos continuam ativos com a janela em segundo plano."
      />

      {conflicts.size > 0 && (
        <p className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          <AlertTriangle className="size-4" />
          Há atalhos em conflito. Grave uma combinação diferente.
        </p>
      )}

      <section className="divide-y divide-black/20 overflow-hidden rounded-lg border border-black/15 bg-[#232428] px-4">
        {(Object.entries(KEYBIND_LABELS) as [KeybindAction, string][]).map(
          ([action, label]) => {
            const shortcut = localKeybinds[action];
            return (
              <div
                key={action}
                className="flex min-h-14 items-center justify-between gap-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-white">
                    {label}
                  </p>
                  {shortcut && conflicts.has(shortcut) && (
                    <p className="text-[10px] text-amber-300">Conflito detectado</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setRecording(action)}
                    className={cn(
                      "min-h-10 min-w-32 rounded-lg border px-3 font-mono text-[10px] font-bold",
                      recording === action
                        ? "border-[#7383ff] bg-[#5865F2]/20 text-[#aab2ff]"
                        : conflicts.has(shortcut ?? "")
                          ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
                          : "border-white/10 bg-black/20 text-bodyx"
                    )}
                  >
                    {recording === action
                      ? "Pressione as teclas…"
                      : shortcut?.replaceAll("+", " + ") || "Não definido"}
                  </button>
                  {shortcut && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = { ...localKeybinds };
                        delete next[action];
                        setLocalKeybinds(next);
                        saveData({ keybinds: next });
                      }}
                      className="grid size-10 place-items-center rounded-lg text-muted2 transition-colors hover:bg-white/5 hover:text-red-300"
                      aria-label={`Limpar atalho ${label}`}
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          }
        )}
      </section>

      <DiscordCard
        icon={<EyeOff className="size-4" />}
        title="Modo Streamer"
        description="Oculta dados pessoais, convites e prévias, além de silenciar alertas privados."
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-white">
                Ativar modo streamer
              </p>
              <p className="mt-0.5 text-[11px] text-[#B5BAC1]">
                Pode ser alternado pelo atalho configurado acima.
              </p>
            </div>
            <Switch
              checked={streamerEnabled}
              disabled={update.isPending || !preferences.data}
              onCheckedChange={enabled => {
                document.documentElement.classList.toggle(
                  "nexora-streamer-mode",
                  enabled
                );
                saveData({ streamerMode: { ...streamer, enabled } });
              }}
              aria-label="Ativar modo streamer"
            />
          </div>
          <DiscordDivider />
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-white">
                Detectar OBS e Streamlabs
              </p>
              <p className="mt-0.5 text-[11px] text-[#B5BAC1]">
                Disponível no aplicativo Nexora para desktop.
              </p>
            </div>
            <Switch
              checked={autoDetect}
              disabled={update.isPending || !preferences.data}
              onCheckedChange={value =>
                saveData({ streamerMode: { ...streamer, autoDetect: value } })
              }
              aria-label="Detectar OBS e Streamlabs"
            />
          </div>
        </div>
      </DiscordCard>
    </div>
  );
}

/** "Idioma" — único idioma disponível por enquanto. */
export function LanguageTab() {
  return (
    <div className="space-y-5">
      <DiscordPageHeader
        title="Idioma"
        description="A Nexora fala português (Brasil) nesta etapa."
      />
      <DiscordCard>
        <div className="px-4 py-2">
          <DiscordLanguageOption
            label="Português (Brasil)"
            description="Idioma padrão da plataforma."
            selected
          />
        </div>
      </DiscordCard>
      <p className="text-[11px] text-[#949BA4]">
        Otros idiomas ainda não estão disponíveis. Quando forem, cada usuário
        escolherá o próprio idioma sem alterar o dos demais.
      </p>
    </div>
  );
}

function DiscordLanguageOption({
  label,
  description,
  selected,
}: {
  label: string;
  description: string;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={cn(
        "min-h-16 w-full rounded-lg border px-3 py-2 text-left transition-colors",
        selected
          ? "border-[#5865F2] bg-[#5865F2]/20"
          : "border-white/[0.08] bg-[#1E1F22] hover:border-white/20"
      )}
    >
      <span className="block text-[13px] font-bold text-white">{label}</span>
      <span className="mt-1 block text-[11px] text-[#B5BAC1]">{description}</span>
    </button>
  );
}
