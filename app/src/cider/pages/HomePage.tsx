/**
 * Início.
 *
 * Tudo nesta tela vem de algo que existe: o histórico local, os favoritos
 * locais, as playlists locais e as buscas recentes. **Não** existe
 * "recomendação privada do YouTube" aqui — sem uma conta autorizada, a Home é
 * feita do que o próprio usuário tocou, e a página diz exatamente isso.
 */

import { useState, type CSSProperties } from "react";
import { useNavigate } from "react-router";
import { Compass, Heart, Info, Loader2, Play, Search, Sparkles } from "lucide-react";

import { useCider } from "../useCider";
import { useCiderLibrary } from "../library";
import { playAfter, playFrom, startMix } from "../play";
import { MIXES, mixIsPersonalized, mixSourceLabel, type MixDefinition } from "../core/mixes";
import { ciderToast } from "../ui";
import { CoverArt } from "../components/CoverArt";
import { MediaCard, Button, EmptyState, SectionHeader } from "../components/primitives";
import { timecode } from "../format";
import { TrackList } from "../components/TrackList";

export function CiderHomePage() {
  const navigate = useNavigate();
  const { state, engine } = useCider();
  const history = useCiderLibrary((store) => store.history);
  const favorites = useCiderLibrary((store) => store.favorites);
  const playlists = useCiderLibrary((store) => store.playlists);
  const searches = useCiderLibrary((store) => store.searches);

  const recent = history.slice(0, 12).map((entry) => entry.track);
  const current = state.track;
  const mixSources = { history, favorites };
  const mixPersonalized = mixIsPersonalized(mixSources);
  const [startingMix, setStartingMix] = useState<string | null>(null);

  /**
   * Tocar uma mistura é buscar de verdade: os lotes vêm das consultas de
   * `core/mixes.ts` e o resultado entra na fila como qualquer outra lista.
   */
  const playMix = (mix: MixDefinition) => {
    if (startingMix) return;
    setStartingMix(mix.id);
    void startMix(mix, engine)
      .then((result) => {
        if (result.added === 0) {
          ciderToast("warning", "A mistura não achou nada", result.error ?? mix.label);
          return;
        }
        ciderToast(
          "success",
          mix.label,
          `${result.added} faixas · ${
            result.personalized ? "a partir do seu histórico" : "pelo tema"
          }`,
        );
      })
      .finally(() => setStartingMix(null));
  };

  return (
    <div className="page stack gap-6">
      <header className="page-hero home-hero">
        <div>
          <div className="page-kicker">Cider 2 · web</div>
          <h1>Sua música, em um só lugar.</h1>
          <p className="muted">
            O Cider cuida da fila, das letras e da sua biblioteca local, com o áudio tocando em
            segundo plano enquanto você navega. Nada é baixado, convertido ou hospedado aqui — e
            nada de catálogo inventado.
          </p>
          <div className="inline" style={{ marginTop: 12 }}>
            <Button variant="primary" icon={<Search size={16} />} onClick={() => navigate("/cider/pesquisa")}>
              Pesquisar uma música
            </Button>
            <Button
              icon={<Play size={16} />}
              disabled={recent.length === 0}
              onClick={() => playFrom(engine, recent, 0)}
            >
              Continuar ouvindo
            </Button>
            <Button
              icon={<Heart size={16} />}
              disabled={favorites.length === 0}
              onClick={() => playFrom(engine, favorites, 0)}
            >
              Tocar favoritos
            </Button>
            <Button icon={<Compass size={16} />} onClick={() => navigate("/cider/explorar")}>
              Explorar por tema
            </Button>
          </div>
        </div>

        {current ? (
          <div className="home-now">
            <span className="xsmall faint uppercase">Tocando agora</span>
            <CoverArt url={current.artworkUrl} title={current.title} size={220} className="home-now-art" />
            <div className="stack tight">
              <button
                type="button"
                className="link truncate"
                title={current.title}
                onClick={() => navigate("/cider/tocando-agora")}
              >
                {current.title}
              </button>
              <span className="xsmall muted truncate">{current.artist || current.channelName}</span>
              <span className="xsmall faint tabular">
                {timecode(state.durationMs || current.durationMs)}
              </span>
            </div>
          </div>
        ) : null}
      </header>

      {/*
        * Misturas no topo, como as mixes do Apple Music — mas com uma diferença
        * de honestidade: quando não há biblioteca, a mistura é o **tema** dela e
        * a interface diz isso em vez de fingir personalização.
        */}
      <section className="section">
        <SectionHeader title="Misturas" kicker={mixSourceLabel(mixSources)} />
        <div className="mix-grid">
          {MIXES.map((mix) => {
            const loading = startingMix === mix.id;
            return (
              <button
                key={mix.id}
                type="button"
                className="mix-card"
                data-loading={loading ? "true" : "false"}
                disabled={startingMix !== null}
                style={{ "--mix-tone": mix.tone } as CSSProperties}
                onClick={() => playMix(mix)}
                title={
                  mixPersonalized
                    ? `${mix.label} — com os artistas do seu histórico e favoritos`
                    : `${mix.label} — busca “${mix.query}”`
                }
              >
                <span className="mix-card-top">
                  {loading ? <Loader2 size={15} className="cider-spin" /> : <Sparkles size={15} />}
                  <span className="mix-card-label">{mix.label}</span>
                </span>
                <span className="mix-card-hint">{mix.hint}</span>
              </button>
            );
          })}
        </div>
        <p className="xsmall faint" style={{ marginTop: 8 }}>
          {mixPersonalized
            ? "Cada mistura cruza um humor com os artistas mais presentes no seu histórico e nos seus favoritos deste navegador."
            : "Sem histórico nem favoritos ainda: cada mistura busca o tema dela. O que você ouvir passa a semear as próximas."}
        </p>
      </section>

      {recent.length === 0 && favorites.length === 0 && playlists.length === 0 ? (
        <EmptyState
          icon={<Sparkles size={22} />}
          title="Seu histórico está vazio"
          message="Pesquise uma música para começar. O que você ouvir aparece aqui — e o histórico pode ser desligado ou apagado em Configurações → Biblioteca."
          action={
            <div className="inline">
              <Button variant="primary" onClick={() => navigate("/cider/pesquisa")}>
                Pesquisar
              </Button>
              <Button variant="ghost" onClick={() => navigate("/cider/explorar")}>
                Explorar por tema
              </Button>
              <Button variant="ghost" onClick={() => navigate("/cider/radio")}>
                Abrir a Rádio
              </Button>
            </div>
          }
        />
      ) : null}

      {recent.length > 0 ? (
        <section className="section">
          <SectionHeader
            title="Continuar ouvindo"
            action={
              <button type="button" className="link xsmall" onClick={() => navigate("/cider/historico")}>
                Ver histórico
              </button>
            }
          />
          <TrackList
            tracks={recent}
            currentVideoId={current?.videoId}
            playing={state.phase === "playing"}
            favorites={favorites.map((track) => track.videoId)}
            onPlay={(index) => playFrom(engine, recent, index)}
            onPlayAfter={(track) => playAfter(engine, [track])}
            onAddToQueue={(track) => engine.appendQueue([track])}
          />
        </section>
      ) : null}

      {favorites.length > 0 ? (
        <section className="section">
          <SectionHeader
            title="Favoritos"
            action={
              <button type="button" className="link xsmall" onClick={() => navigate("/cider/favoritos")}>
                Ver todos
              </button>
            }
          />
          <TrackList
            tracks={favorites.slice(0, 10)}
            currentVideoId={current?.videoId}
            playing={state.phase === "playing"}
            favorites={favorites.map((track) => track.videoId)}
            onPlay={(index) => playFrom(engine, favorites.slice(0, 10), index)}
            onPlayAfter={(track) => playAfter(engine, [track])}
            onAddToQueue={(track) => engine.appendQueue([track])}
          />
        </section>
      ) : null}

      {playlists.length > 0 ? (
        <section className="section">
          <SectionHeader title="Suas playlists locais" />
          <div className="grid-cards">
            {playlists.map((playlist) => (
              <MediaCard
                key={playlist.id}
                title={playlist.name}
                subtitle={`${playlist.tracks.length} faixa(s) · local`}
                artworkUrl={playlist.tracks[0]?.artworkUrl}
                badge={<span className="badge">Local</span>}
                onOpen={() => navigate(`/cider/playlists/${playlist.id}`)}
                onPlay={
                  playlist.tracks.length > 0
                    ? () => playFrom(engine, playlist.tracks, 0)
                    : undefined
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      {searches.length > 0 ? (
        <section className="section">
          <SectionHeader
            title="Buscas recentes"
            action={
              <button
                type="button"
                className="link xsmall"
                onClick={() => useCiderLibrary.getState().forgetSearches()}
              >
                Limpar
              </button>
            }
          />
          <div className="chip-row">
            {searches.slice(0, 12).map((entry) => (
              <button
                key={`${entry.query}-${entry.at}`}
                type="button"
                className="chip"
                onClick={() => navigate(`/cider/pesquisa?q=${encodeURIComponent(entry.query)}`)}
              >
                <Search size={14} />
                {entry.query}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <p className="xsmall faint">
        <Info size={13} /> Estas listas vêm do armazenamento local deste navegador (histórico,
        favoritos e playlists). Nada é enviado para o Google — só a atividade de "tocando agora"
        aparece na Nexora, para os seus contatos, e pode ser desligada na sua conta.
      </p>
    </div>
  );
}
