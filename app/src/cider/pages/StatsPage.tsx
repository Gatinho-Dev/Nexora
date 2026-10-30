/**
 * Estatísticas.
 *
 * São números do histórico local, sem estimativa: a duração contada é a do vídeo
 * (o que o player conhece), e por isso uma faixa interrompida no meio conta
 * cheia — a tela explica isso em vez de esconder.
 */

import { useMemo } from "react";
import { BarChart3, Heart, Music } from "lucide-react";

import { useCider } from "../useCider";
import { useCiderLibrary } from "../library";
import { deriveStats, formatDuration, shortDayLabel } from "../stats";
import { EmptyState, SectionHeader, StatTile } from "../components/primitives";
import { TrackList } from "../components/TrackList";
import { playAfter, playFrom } from "../play";
import { useNavigate } from "react-router";

export function CiderStatsPage() {
  const navigate = useNavigate();
  const history = useCiderLibrary((store) => store.history);
  const favorites = useCiderLibrary((store) => store.favorites);
  const { state, engine } = useCider();

  const stats = useMemo(() => deriveStats(history), [history]);
  const peak = Math.max(1, ...stats.byDay.map((bucket) => bucket.plays));

  if (history.length === 0) {
    return (
      <div className="page stack gap-6">
        <div className="page-head">
          <div>
            <div className="page-kicker">Sistema</div>
            <h1>Estatísticas</h1>
          </div>
        </div>
        <EmptyState
          icon={<BarChart3 size={22} />}
          title="Nada para medir ainda"
          message="As estatísticas nascem do histórico local. Ouça algumas faixas e volte aqui — ou ligue a gravação de histórico em Configurações → Biblioteca."
          action={
            <div className="inline">
              <button type="button" className="btn primary" onClick={() => navigate("/cider/pesquisa")}>
                Pesquisar
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => navigate("/cider/configuracoes/biblioteca")}
              >
                Abrir as configurações
              </button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="page stack gap-6">
      <div className="page-head">
        <div>
          <div className="page-kicker">Sistema</div>
          <h1>Estatísticas</h1>
          <p className="muted">
            Calculadas a partir dos {history.length} registros do histórico local. O tempo conta a
            duração de cada vídeo — se você parou no meio, o tempo cheio ainda entra na conta.
          </p>
        </div>
      </div>

      <section className="section">
        <div className="stats-grid">
          <StatTile value={String(stats.plays)} label="Reproduções" />
          <StatTile value={formatDuration(stats.minutes)} label="Tempo ouvido" />
          <StatTile value={String(stats.uniqueSongs)} label="Faixas únicas" />
          <StatTile value={String(stats.uniqueArtists)} label="Artistas" />
        </div>
      </section>

      <section className="section">
        <SectionHeader
          title="Últimos 14 dias"
          action={<span className="xsmall faint">cada barra é um dia do seu fuso</span>}
        />
        <div className="card tight">
          <div className="bar-chart">
            {stats.byDay.map((bucket) => (
              <div
                key={bucket.date}
                className="bar"
                style={{ height: `${Math.max(4, (bucket.plays / peak) * 100)}%` }}
                title={`${bucket.plays} reprodução(ões) · ${formatDuration(bucket.minutes)}`}
              >
                <span>{shortDayLabel(bucket.date)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid two">
        <section className="section">
          <SectionHeader title="Artistas mais ouvidos" />
          <div className="card tight stack tight">
            {stats.topArtists.map((artist, index) => (
              <div className="row" key={artist.name}>
                <span className="rank">{index + 1}</span>
                <img
                  className="row-art"
                  src={artist.artworkUrl}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
                <div className="row-text">
                  <div className="row-title truncate">{artist.name}</div>
                  <div className="row-subtitle">
                    {artist.plays} reprodução(ões) · {formatDuration(artist.minutes)}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => playFrom(engine, artist.tracks, 0)}
                  title="Tocar as faixas deste artista"
                >
                  Tocar
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <SectionHeader title="Músicas mais repetidas" />
          <div className="card tight">
            <TrackList
              tracks={stats.topSongs.map((entry) => entry.track)}
              currentVideoId={state.track?.videoId}
              playing={state.phase === "playing"}
              favorites={favorites.map((track) => track.videoId)}
              showAlbum={false}
              onPlay={(index) => playFrom(engine, stats.topSongs.map((entry) => entry.track), index)}
              onPlayAfter={(track) => playAfter(engine, [track])}
              onAddToQueue={(track) => engine.appendQueue([track])}
            />
          </div>
        </section>
      </div>

      <p className="xsmall faint">
        <Music size={13} /> <Heart size={13} /> Nenhum dado sai deste navegador: as estatísticas são
        derivadas na hora do histórico local.
      </p>
    </div>
  );
}
