/**
 * Rádio.
 *
 * A "fila inteligente" do desktop, adaptada ao que o navegador tem: em vez de
 * recomendação privada (que exigiria conta no YouTube), a estação é o resultado
 * de **consultas reais** ao redor de uma semente que veio do seu histórico ou dos
 * seus favoritos. Quando a busca não acha nada utilizável, a página diz isso.
 */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Info, Loader2, Play, Radio, Sparkles } from "lucide-react";

import { useCider } from "../useCider";
import { knownTracks, useCiderLibrary } from "../library";
import { extendQueue, lastRadioSeed, playFrom, rememberSeed, startStation } from "../play";
import type { RadioSeed } from "../radio";
import { radioQueries, suggestedSeeds } from "../radio";
import { Button, EmptyState, Notice, SectionHeader } from "../components/primitives";
import { TrackList } from "../components/TrackList";

export function CiderRadioPage() {
  const navigate = useNavigate();
  const { state, engine } = useCider();
  const library = useCiderLibrary();
  const [seed, setSeed] = useState<RadioSeed | null>(() => lastRadioSeed());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tracks = useMemo(() => knownTracks(library), [library]);
  const seeds = useMemo(() => suggestedSeeds(tracks, 16), [tracks]);
  const seedTracks = useMemo(
    () => (seed ? tracks.filter((track) => (track.artist || track.channelName) === seed.value) : tracks),
    [seed, tracks],
  );

  const start = (next: RadioSeed) => {
    setSeed(next);
    rememberSeed(next);
    setBusy(true);
    setMessage(null);
    setError(null);
    void startStation(next, engine)
      .then((result) => {
        if (result.error) setError(result.error);
        else setMessage(`Estação montada com ${result.added} faixa(s) a partir de ${result.queries.length} consulta(s).`);
      })
      .finally(() => setBusy(false));
  };

  const favoriteIds = library.favorites.map((track) => track.videoId);

  return (
    <div className="page stack gap-6">
      <div className="page-head">
        <div>
          <div className="page-kicker">Rádio</div>
          <h1>{seed ? `Rádio: ${seed.value}` : "Rádio do Cider"}</h1>
          <p className="muted">
            A estação é montada com consultas reais ao redor da semente — artista puro, canal
            “Topic” e coletâneas — e a fila respeita um teto por canal para não virar a discografia
            de um publicador só.
          </p>
        </div>
        <div className="page-actions">
          {seed ? (
            <Button
              variant="ghost"
              onClick={() => {
                setSeed(null);
                setMessage(null);
                setError(null);
              }}
            >
              Ver todas as sementes
            </Button>
          ) : null}
          <Button
            variant="primary"
            icon={<Sparkles size={15} />}
            disabled={busy || !state.track}
            onClick={() => {
              setBusy(true);
              setError(null);
              setMessage(null);
              void extendQueue(engine)
                .then((result) => {
                  if (result.added > 0) setMessage(`${result.added} faixa(s) acrescentadas à fila atual.`);
                  else setError(result.error ?? "Nada novo encontrado.");
                })
                .finally(() => setBusy(false));
            }}
          >
            Estender a fila atual
          </Button>
        </div>
      </div>

      {busy ? (
        <p className="inline muted">
          <Loader2 size={16} className="cider-spin" /> Rodando as consultas da estação…
        </p>
      ) : null}

      {message ? (
        <Notice tone="success" title="Estação">
          {message}
          {seed ? (
            <>
              {" "}
              Consultas: <span className="mono">{radioQueries(seed).join(" · ")}</span>
            </>
          ) : null}
        </Notice>
      ) : null}

      {error ? (
        <Notice tone="warning" title="A estação não ficou completa">
          {error}
        </Notice>
      ) : null}

      {tracks.length === 0 ? (
        <EmptyState
          icon={<Radio size={22} />}
          title="Sem sementes"
          message="Ouça ou favorite algumas faixas para o Cider ter de onde partir — a estação nasce do seu histórico e dos seus favoritos."
          action={
            <Button variant="primary" onClick={() => navigate("/cider/pesquisa")}>
              Pesquisar uma música
            </Button>
          }
        />
      ) : (
        <>
          <section className="section">
            <SectionHeader
              title="Sementes (do seu histórico e favoritos)"
              action={<span className="xsmall faint">a semente mais ouvida aparece primeiro</span>}
            />
            <div className="chip-row">
              {seeds.map((entry) => (
                <button
                  key={entry.value}
                  type="button"
                  className="chip"
                  aria-pressed={seed?.value === entry.value}
                  onClick={() => start(entry)}
                >
                  <Radio size={14} />
                  {entry.value}
                </button>
              ))}
            </div>
          </section>

          <section className="section">
            <SectionHeader
              title={seed ? `Faixas de ${seed.value}` : "Faixas conhecidas"}
              action={
                seedTracks.length > 0 ? (
                  <Button
                    size="sm"
                    variant="primary"
                    icon={<Play size={14} />}
                    onClick={() => playFrom(engine, seedTracks, 0)}
                  >
                    Tocar estas faixas
                  </Button>
                ) : null
              }
            />
            {seedTracks.length > 0 ? (
              <TrackList
                tracks={seedTracks.slice(0, 30)}
                currentVideoId={state.track?.videoId}
                playing={state.phase === "playing"}
                favorites={favoriteIds}
                onPlay={(index) => playFrom(engine, seedTracks, index)}
                onAddToQueue={(track) => engine.appendQueue([track])}
              />
            ) : (
              <p className="small muted">Você ainda não tem faixas desta semente no histórico.</p>
            )}
          </section>
        </>
      )}

      <p className="xsmall faint">
        <Info size={13} /> A rádio não inventa faixas: se as consultas não devolverem nada
        utilizável, ela avisa em vez de tocar silêncio.
      </p>
    </div>
  );
}
