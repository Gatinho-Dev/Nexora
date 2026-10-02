/**
 * Diagnóstico.
 *
 * Mesma ideia do desktop: mostrar o estado real em vez de um "tudo ok" de
 * fachada. Cada linha é uma verificação feita agora — de DRM do navegador até o
 * tamanho do armazenamento local —, e o resultado é o que foi observado, com o
 * detalhe que permite agir (qual instância falhou, qual erro o player reportou).
 */

import { useEffect, useMemo, useState } from "react";
import { CircleCheck, CircleX, RefreshCw, TriangleAlert } from "lucide-react";

import { presenceSnapshot } from "../activity";
import { searchInstances } from "../api/search";
import { useCider } from "../useCider";
import { currentSearchPreferences, runSearch } from "../play";
import { useCiderLibrary, LIBRARY_KEY } from "../library";
import { CIDER_SETTINGS_KEY } from "../settings/types";
import { useCiderSettings } from "../settings/store";
import { useCiderUi } from "../ui";
import { Button, SectionHeader } from "../components/primitives";

type Status = "ok" | "warn" | "fail" | "neutral";

interface Check {
  id: string;
  title: string;
  status: Status;
  detail: string;
}

const ICONS: Record<Status, typeof CircleCheck> = {
  ok: CircleCheck,
  warn: TriangleAlert,
  fail: CircleX,
  neutral: RefreshCw,
};

/** Testa se o navegador consegue abrir uma sessão Widevine para áudio. */
async function probeDrm(): Promise<Check> {
  if (typeof navigator === "undefined" || !("requestMediaKeySystemAccess" in navigator)) {
    return {
      id: "drm",
      title: "DRM do navegador (EME)",
      status: "fail",
      detail:
        "Este navegador não expõe requestMediaKeySystemAccess. O player pode recusar o áudio — é exatamente o problema do WebKitGTK no aplicativo desktop.",
    };
  }
  try {
    await navigator.requestMediaKeySystemAccess("com.widevine.alpha", [
      {
        initDataTypes: ["cenc"],
        audioCapabilities: [{ contentType: 'audio/mp4; codecs="mp4a.40.2"' }],
      },
    ]);
    return {
      id: "drm",
      title: "DRM do navegador (EME)",
      status: "ok",
      detail: "Widevine disponível: o player consegue entregar o áudio.",
    };
  } catch (error) {
    return {
      id: "drm",
      title: "DRM do navegador (EME)",
      status: "warn",
      detail: `Widevine não pôde ser aberto (${error instanceof Error ? error.message : String(error)}). Muitos vídeos ainda tocam sem DRM; alguns vão falhar com erro 152/153.`,
    };
  }
}

export function CiderDiagnosticsPage() {
  const { state, engine } = useCider();
  const settings = useCiderSettings((store) => store.settings);
  const favorites = useCiderLibrary((store) => store.favorites.length);
  const history = useCiderLibrary((store) => store.history.length);
  const playlists = useCiderLibrary((store) => store.playlists.length);
  const searchSource = useCiderUi((store) => store.searchSource);
  const attempts = useCiderUi((store) => store.searchAttempts);
  const lastSearchError = useCiderUi((store) => store.lastSearchError);

  const [drm, setDrm] = useState<Check>({
    id: "drm",
    title: "DRM do navegador (EME)",
    status: "neutral",
    detail: "Verificando…",
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<Check | null>(null);
  const [storage, setStorage] = useState<Check>({
    id: "storage",
    title: "Armazenamento local",
    status: "neutral",
    detail: "Medindo…",
  });

  useEffect(() => {
    let alive = true;
    void probeDrm().then((result) => {
      if (alive) setDrm(result);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const bytes = (key: string) => {
        try {
          return (localStorage.getItem(key) ?? "").length;
        } catch {
          return 0;
        }
      };
      const kb = (value: number) => `${(value / 1024).toFixed(1)} KB`;
      let quota = "";
      try {
        const estimate = await navigator.storage?.estimate?.();
        if (estimate?.quota) quota = ` de ${(estimate.quota / 1024 / 1024).toFixed(0)} MB disponíveis`;
      } catch {
        // Sem `storage.estimate` (ou bloqueado): segue sem a linha de cota.
      }
      if (!alive) return;
      const total = bytes(CIDER_SETTINGS_KEY) + bytes(LIBRARY_KEY);
      setStorage({
        id: "storage",
        title: "Armazenamento local",
        status: total > 4 * 1024 * 1024 ? "warn" : "ok",
        detail: `Preferências: ${kb(bytes(CIDER_SETTINGS_KEY))} · biblioteca: ${kb(bytes(LIBRARY_KEY))}${quota}.`,
      });
    })();
    return () => {
      alive = false;
    };
  }, [favorites, history, playlists, settings.customThemes.length]);

  const presence = presenceSnapshot();

  const checks = useMemo<Check[]>(
    () => [
      {
        id: "browser",
        title: "Navegador",
        status: "ok",
        detail:
          typeof navigator === "undefined"
            ? "Ambiente sem `navigator` (fora do navegador)."
            : `${navigator.userAgent} · idioma ${navigator.language} · conexão ${navigator.onLine ? "online" : "offline"}`,
      },
      drm,
      {
        id: "iframe",
        title: "API do player",
        status:
          typeof window !== "undefined" && (window as { YT?: unknown }).YT ? "ok" : state.track ? "fail" : "neutral",
        detail:
          typeof window !== "undefined" && (window as { YT?: unknown }).YT
            ? "A API do player carregou e está montada no dock persistente."
            : state.track
              ? "A API não carregou — pode ser bloqueio de script, extensão de privacidade ou rede restrita."
              : "Ainda não carregada (nenhuma faixa foi tocada nesta sessão).",
      },
      {
        id: "engine",
        title: "Motor de reprodução",
        status: state.error ? "fail" : state.phase === "idle" ? "neutral" : "ok",
        detail: [
          `fase: ${state.phase}`,
          `fila: ${state.queue.length} faixa(s)`,
          `índice: ${state.index}`,
          `volume: ${Math.round(state.volume * 100)}%${state.muted ? " (mudo)" : ""}`,
          `aleatório: ${state.shuffle ? "ligado" : "desligado"}`,
          `repetição: ${state.repeat}`,
          `posição: ${(state.positionMs / 1000).toFixed(1)} s`,
        ].join(" · ") + (state.error ? ` · erro: ${state.error}` : ""),
      },
      {
        id: "autoplay",
        title: "Política de autoplay",
        status: state.autoplayBlocked ? "warn" : "ok",
        detail: state.autoplayBlocked
          ? "O navegador bloqueou o início automático. O primeiro play precisa de um clique — é política do navegador, não configuração do Cider."
          : "Nenhum bloqueio de autoplay nesta sessão.",
      },
      {
        id: "search",
        title: "Busca (instâncias comunitárias)",
        status: searchSource ? "ok" : lastSearchError ? "fail" : "neutral",
        detail: [
          `instâncias configuradas: ${searchInstances()
            .map((instance) => `${new URL(instance.url).host} (${instance.protocol})`)
            .join(", ")}`,
          searchSource ? `respondeu: ${new URL(searchSource).host}` : "nenhuma busca concluída nesta sessão",
          attempts.length > 0 ? `falhas antes: ${attempts.map((attempt) => `${attempt.instance} (${attempt.error})`).join(", ")}` : null,
          lastSearchError ? `último erro: ${lastSearchError}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      },
      {
        id: "prefs",
        title: "Preferências de busca em uso",
        status: "neutral",
        detail: [
          `oficial primeiro: ${currentSearchPreferences(settings).preferOfficialAudio ? "sim" : "não"}`,
          `esconder alternativas: ${currentSearchPreferences(settings).hideAlternativeVersions ? "sim" : "não"}`,
          `máx/canal: ${currentSearchPreferences(settings).maxPerChannel}`,
          `limite: ${currentSearchPreferences(settings).limit}`,
        ].join(" · "),
      },
      {
        id: "presence",
        title: "Presença na Nexora",
        status: presence.lastVideoId ? "ok" : "neutral",
        detail: presence.lastVideoId
          ? `última publicação: vídeo ${presence.lastVideoId} em ${new Date(presence.lastPublishAt).toLocaleTimeString("pt-BR")} (intervalo mínimo de ${presence.minIntervalMs / 1000} s entre publicações).`
          : `Nada publicado ainda nesta sessão. O servidor da Nexora limita a taxa e valida o formato antes de gravar.`,
      },
      storage,
      {
        id: "library",
        title: "Biblioteca local",
        status: "ok",
        detail: `${favorites} favorito(s) · ${history} registro(s) no histórico · ${playlists} playlist(s) · ${settings.customThemes.length} tema(s) próprio(s).`,
      },
    ],
    [
      attempts,
      drm,
      favorites,
      history,
      lastSearchError,
      playlists,
      presence.lastPublishAt,
      presence.lastVideoId,
      presence.minIntervalMs,
      searchSource,
      settings,
      state,
      storage,
    ],
  );

  return (
    <div className="page stack gap-6">
      <div className="page-head">
        <div>
          <div className="page-kicker">Sistema</div>
          <h1>Diagnóstico</h1>
          <p className="muted">
            O que está funcionando agora, verificado na sua máquina. Nada aqui é um "tudo ok"
            presumido: quando não dá para saber, a linha diz que não deu.
          </p>
        </div>
        <div className="page-actions">
          <Button
            icon={<RefreshCw size={15} />}
            disabled={testing}
            onClick={() => {
              setTesting(true);
              setTestResult(null);
              void runSearch("teste de conectividade", currentSearchPreferences(settings))
                .then((outcome) => {
                  setTestResult({
                    id: "live",
                    title: "Teste de busca ao vivo",
                    status: outcome.tracks.length > 0 ? "ok" : "fail",
                    detail:
                      outcome.tracks.length > 0
                        ? `${outcome.tracks.length} resultado(s) de ${outcome.source ? new URL(outcome.source).host : "instância desconhecida"}.`
                        : outcome.error ?? "Nenhuma instância respondeu.",
                  });
                })
                .finally(() => setTesting(false));
            }}
          >
            Testar a busca agora
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              engine.clearQueue();
            }}
          >
            Parar e limpar a fila
          </Button>
        </div>
      </div>

      {testResult ? (
        <div className="check-row" data-status={testResult.status}>
          {(() => {
            const Icon = ICONS[testResult.status];
            return <Icon size={18} />;
          })()}
          <div>
            <div className="check-title">{testResult.title}</div>
            <div className="check-detail">{testResult.detail}</div>
          </div>
          <span className="badge">{testResult.status}</span>
        </div>
      ) : null}

      <section className="section">
        <SectionHeader title="Verificações" />
        <div className="card tight">
          {checks.map((check) => {
            const Icon = ICONS[check.status];
            return (
              <div className="check-row" key={check.id} data-status={check.status}>
                <Icon size={18} />
                <div>
                  <div className="check-title">{check.title}</div>
                  <div className="check-detail">{check.detail}</div>
                </div>
                <span className="badge">{check.status}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="section">
        <SectionHeader
          title="Como a busca é feita"
          action={<span className="xsmall faint">sem proxy nosso no meio</span>}
        />
        <div className="audio-path" data-source="community">
          <div className="audio-path-head">
            <strong>Navegador → instância comunitária → metadados</strong>
            <span className="badge warning">fonte comunitária</span>
          </div>
          <ul className="audio-path-steps">
            <li data-processed="true">
              <span className="step-label">Busca</span>
              <span>fetch direto do navegador (CORS liberado pela instância)</span>
              <span className="badge">HTTPS</span>
            </li>
            <li data-processed="false">
              <span className="step-label">Reordenação</span>
              <span>nota de oficial, versão detectada, dedupe e teto por canal</span>
              <span className="badge">local</span>
            </li>
            <li data-processed="false">
              <span className="step-label">Reprodução</span>
              <span>player da fonte, escondido atrás de camada opaca</span>
              <span className="badge">som</span>
            </li>
          </ul>
          <ul className="audio-path-notes">
            <li>
              <span>•</span>
              <span>
                O áudio nunca passa pelos servidores de busca: eles só devolvem metadados (título,
                canal, duração, id).
              </span>
            </li>
            <li>
              <span>•</span>
              <span>
                Nenhum equalizador ou DSP existe nesta versão porque o navegador não dá acesso ao
                buffer do áudio que está tocando.
              </span>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
