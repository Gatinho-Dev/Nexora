import { useEffect, useRef } from "react";
import { trpc } from "@/providers/trpc";
import {
  CLIENT_SETTINGS_KEY,
  DEFAULT_CLIENT_SETTINGS,
  parseClientSettings,
} from "@/lib/clientSettings";
import { useSettingsStore } from "@/store/useSettingsStore";

/** Intervalo sem novas interações antes de despachar o payload ao backend. */
export const SETTINGS_SYNC_DEBOUNCE_MS = 500;

function readSettingsBlob(data: Record<string, unknown> | undefined) {
  return parseClientSettings(data?.[CLIENT_SETTINGS_KEY] ?? DEFAULT_CLIENT_SETTINGS);
}

/**
 * Liga a store local ao blob `userPreferences.clientSettings` do usuário.
 *
 * - Hidrata uma única vez quando a query chega (guarda de versão para não
 *   sobrescrever edições feitas antes de o "voltar" do servidor).
 * - Ao detectar mudança local, aguarda 500 ms sem novas interações — arrastar um
 *   slider ou ficar movendo um toggle não gera tráfego — e só então envia um
 *   único payload completo.
 */
export function useClientSettingsSync(enabled: boolean) {
  const utils = trpc.useUtils();
  const preferences = trpc.advanced.profile.preferences.useQuery(undefined, {
    enabled,
    staleTime: 30_000,
  });
  const update = trpc.advanced.profile.updatePreferences.useMutation();

  const settings = useSettingsStore(state => state.settings);
  const hydrate = useSettingsStore(state => state.hydrate);
  const hydratedRef = useRef(false);
  const versionRef = useRef(0);
  // Último payload confirmado pelo servidor: evita despachar ao abrir o modal.
  const syncedRef = useRef<string | null>(null);

  // Hidratação única: o primeiro snapshot do servidor define o estado.
  useEffect(() => {
    if (hydratedRef.current || !preferences.data) return;
    hydratedRef.current = true;
    versionRef.current = preferences.data.version;
    const next = readSettingsBlob(preferences.data.data);
    syncedRef.current = JSON.stringify(next);
    hydrate(next);
  }, [preferences.data, hydrate]);

  // Debounce de 500 ms.
  useEffect(() => {
    if (!hydratedRef.current) return;
    const payload = JSON.stringify(settings);
    if (payload === syncedRef.current) return;

    const timer = window.setTimeout(() => {
      update.mutate(
        {
          expectedVersion: versionRef.current,
          data: { ...(preferences.data?.data ?? {}), [CLIENT_SETTINGS_KEY]: settings },
        },
        {
          onSuccess: result => {
            versionRef.current = result.version;
            syncedRef.current = JSON.stringify(settings);
            utils.advanced.profile.preferences.setData(undefined, current =>
              current
                ? { ...current, data: result.data, version: result.version }
                : current,
            );
          },
          onError: error => {
            console.warn(
              "[settings] falha ao sincronizar preferências:",
              error.message,
            );
          },
        },
      );
    }, SETTINGS_SYNC_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [preferences.data, settings, update, utils]);

  return preferences.data;
}
