/**
 * Listas de faixa do Cider.
 *
 * Duas formas, as mesmas do desktop:
 *
 * - `TrackList`/`TrackRow` usam a grade `.track-row` (índice, capa, faixa,
 *   álbum, duração, ações) para biblioteca, fila e resultados curados;
 * - `YoutubeRow` usa `.yt-row` para os resultados crus do YouTube, com a
 *   duração e o selo de versão que a busca detectou.
 *
 * Nas duas, **a capa é o botão**: passar o mouse sobre a linha revela um play
 * circular sobre a arte, e é esse botão que toca a faixa (o resto da linha não
 * toca mais nada). É o gesto do Apple Music e evita o acidente clássico de
 * começar uma música sem querer quando o clique era para selecionar a linha.
 * A linha do que está tocando deixa o botão visível o tempo todo — a capa vira
 * o "pause" do que já está no ar.
 *
 * As ações de fila são **dois botões separados**, e não um menu escondido: o
 * iOS 18 separou "Reproduzir Depois" de "Adicionar à Fila" justamente porque as
 * duas eram ambíguas, e num site há espaço para os dois nomes à vista (com
 * `aria-label`, que é o que um leitor de tela lê). Esconder a diferença atrás de
 * um "…" repetiria o problema que a mudança veio corrigir.
 */

import { ExternalLink, Heart, ListEnd, ListStart, Pause, Play, Trash2 } from "lucide-react";

import type { CiderTrack } from "../api/query";
import { timecode } from "../format";
import { Badge, IconButton } from "./primitives";

/**
 * Capa com o play por cima.
 *
 * O botão só existe na capa — a linha em volta é só layout. `aria-label`
 * leva o nome da faixa porque "Reproduzir" repetido em vinte linhas não diz
 * nada a quem usa leitor de tela.
 */
export function CoverPlayButton({
  url,
  title,
  current,
  playing,
  className,
  onPlay,
}: {
  url: string;
  title: string;
  current?: boolean;
  playing?: boolean;
  className?: string;
  onPlay: () => void;
}) {
  const label = current && playing ? `Pausar ${title}` : `Reproduzir ${title}`;
  return (
    <span className={["cover-play", className].filter(Boolean).join(" ")} data-current={current ? "true" : undefined}>
      <img className="track-art" src={url} alt="" loading="lazy" referrerPolicy="no-referrer" />
      <button
        type="button"
        className="cover-play-btn"
        aria-label={label}
        title={label}
        onClick={(event) => {
          event.stopPropagation();
          onPlay();
        }}
      >
        {/* O disco branco é o do Apple Music: sobre a capa escurecida, o
            triângulo sozinho sumiria numa arte clara. */}
        <span className="cover-play-disc">
          {current && playing ? <Pause size={15} /> : <Play size={15} />}
        </span>
      </button>
    </span>
  );
}

/** Rótulo curto da versão quando ela não é a gravação de estúdio. */
function versionLabel(track: CiderTrack): string | null {
  if (!track.version || track.version === "studio") return null;
  const labels: Record<string, string> = {
    live: "ao vivo",
    acoustic: "acústico",
    remix: "remix",
    instrumental: "instrumental",
    cover: "cover",
    karaoke: "karaokê",
    "sped-up": "acelerado",
    slowed: "desacelerado",
    nightcore: "nightcore",
  };
  return labels[track.version] ?? track.version;
}

export function TrackBadges({ track }: { track: CiderTrack }) {
  const version = versionLabel(track);
  return (
    <span className="yt-row-badges">
      {version ? <Badge tone="warning">{version}</Badge> : null}
      {track.isExplicit ? (
        <Badge tone="explicit" title="Conteúdo explícito">
          E
        </Badge>
      ) : null}
    </span>
  );
}

export function TrackTableHead({ showAlbum = true }: { showAlbum?: boolean }) {
  return (
    <div className="track-table-head" aria-hidden="true">
      <span>#</span>
      <span>Título</span>
      {showAlbum ? <span>Álbum</span> : <span />}
      <span>Duração</span>
      <span />
    </div>
  );
}

export function TrackRow({
  track,
  index,
  current,
  playing,
  favorite,
  showAlbum = true,
  onPlay,
  onPlayAfter,
  onAddToQueue,
  onToggleFavorite,
  onRemove,
}: {
  track: CiderTrack;
  index: number;
  current?: boolean;
  playing?: boolean;
  favorite?: boolean;
  showAlbum?: boolean;
  onPlay: () => void;
  /** "Tocar depois": entra logo depois da faixa atual. */
  onPlayAfter?: () => void;
  /** "Adicionar à fila": entra no fim da fila. */
  onAddToQueue?: () => void;
  onToggleFavorite?: () => void;
  onRemove?: () => void;
}) {
  const version = versionLabel(track);
  return (
    <div className="track-row" aria-current={current ? "true" : undefined}>
      <span className="index">{current && playing ? <Play size={12} /> : index + 1}</span>
      <span className="track-cell">
        <CoverPlayButton
          url={track.artworkUrl}
          title={track.title}
          current={current}
          playing={playing}
          onPlay={onPlay}
        />
        <span className="stack tight" style={{ minWidth: 0 }}>
          <span className="track-title truncate" title={track.youtubeTitle}>
            {track.title}
          </span>
          <span className="xsmall faint truncate">
            {track.artist || track.channelName}
            {version ? ` · ${version}` : ""}
          </span>
        </span>
      </span>
      {showAlbum ? (
        <span className="xsmall muted truncate track-album" title={track.albumHint ?? undefined}>
          {track.albumHint ?? "—"}
        </span>
      ) : (
        <span />
      )}
      <span className="xsmall faint tabular">{timecode(track.durationMs)}</span>
      <span className="track-actions">
        {onToggleFavorite ? (
          <IconButton
            label={favorite ? "Remover dos favoritos" : "Favoritar"}
            active={favorite}
            onClick={(event) => {
              event.stopPropagation();
              onToggleFavorite();
            }}
          >
            <Heart size={15} />
          </IconButton>
        ) : null}
        {onPlayAfter ? (
          <IconButton
            label="Tocar depois"
            onClick={(event) => {
              event.stopPropagation();
              onPlayAfter();
            }}
          >
            <ListStart size={15} />
          </IconButton>
        ) : null}
        {onAddToQueue ? (
          <IconButton
            label="Adicionar à fila"
            onClick={(event) => {
              event.stopPropagation();
              onAddToQueue();
            }}
          >
            <ListEnd size={15} />
          </IconButton>
        ) : null}
        {onRemove ? (
          <IconButton
            label="Remover"
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
          >
            <Trash2 size={15} />
          </IconButton>
        ) : null}
      </span>
    </div>
  );
}

export function TrackList({
  tracks,
  currentVideoId,
  playing,
  favorites,
  showAlbum = true,
  onPlay,
  onPlayAfter,
  onAddToQueue,
  onToggleFavorite,
  onRemove,
}: {
  tracks: CiderTrack[];
  currentVideoId?: string | null;
  playing?: boolean;
  favorites?: string[];
  showAlbum?: boolean;
  onPlay: (index: number) => void;
  onPlayAfter?: (track: CiderTrack) => void;
  onAddToQueue?: (track: CiderTrack) => void;
  onToggleFavorite?: (track: CiderTrack) => void;
  onRemove?: (track: CiderTrack) => void;
}) {
  const favoriteSet = new Set(favorites ?? []);
  return (
    <div className="track-table">
      <TrackTableHead showAlbum={showAlbum} />
      {tracks.map((track, index) => (
        <TrackRow
          key={`${track.videoId}-${index}`}
          track={track}
          index={index}
          current={track.videoId === currentVideoId}
          playing={playing}
          favorite={favoriteSet.has(track.videoId)}
          showAlbum={showAlbum}
          onPlay={() => onPlay(index)}
          onPlayAfter={onPlayAfter ? () => onPlayAfter(track) : undefined}
          onAddToQueue={onAddToQueue ? () => onAddToQueue(track) : undefined}
          onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(track) : undefined}
          onRemove={onRemove ? () => onRemove(track) : undefined}
        />
      ))}
    </div>
  );
}

/** Linha de resultado cru do YouTube (`.yt-row`), como no desktop. */
export function YoutubeRow({
  track,
  current,
  playing,
  favorite,
  onPlay,
  onPlayAfter,
  onAddToQueue,
  onToggleFavorite,
}: {
  track: CiderTrack;
  current?: boolean;
  playing?: boolean;
  favorite?: boolean;
  onPlay: () => void;
  onPlayAfter?: () => void;
  onAddToQueue?: () => void;
  onToggleFavorite?: () => void;
}) {
  return (
    <div className="track-row yt-row" aria-current={current ? "true" : undefined}>
      <div className="yt-row-main">
        <CoverPlayButton
          className="yt-row-cover"
          url={track.artworkUrl}
          title={track.title}
          current={current}
          playing={playing}
          onPlay={onPlay}
        />
        <span className="yt-row-text grow">
          <span className="title truncate" title={track.youtubeTitle}>
            {track.title}
          </span>
          <span className="subtitle truncate">
            {track.artist || track.channelName}
            {track.albumHint ? ` · ${track.albumHint}` : ""}
          </span>
        </span>
      </div>
      <TrackBadges track={track} />
      <span className="yt-row-duration tabular">{timecode(track.durationMs)}</span>
      <span className="yt-row-actions">
        {onToggleFavorite ? (
          <IconButton
            label={favorite ? "Remover dos favoritos" : "Favoritar"}
            active={favorite}
            onClick={onToggleFavorite}
          >
            <Heart size={15} />
          </IconButton>
        ) : null}
        {onPlayAfter ? (
          <IconButton label="Tocar depois" onClick={onPlayAfter}>
            <ListStart size={15} />
          </IconButton>
        ) : null}
        {onAddToQueue ? (
          <IconButton label="Adicionar à fila" onClick={onAddToQueue}>
            <ListEnd size={15} />
          </IconButton>
        ) : null}
        <a
          className="yt-row-open btn icon"
          href={track.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Abrir o original em uma aba nova"
          title="Abrir o original em uma aba nova"
        >
          <ExternalLink size={15} />
        </a>
      </span>
      {current && playing ? (
        <span className="badge accent" title="Tocando agora">
          <Pause size={11} /> tocando
        </span>
      ) : null}
    </div>
  );
}
