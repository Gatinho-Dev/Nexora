/**
 * Listas de faixa do Cider.
 *
 * Duas formas, as mesmas do desktop:
 *
 * - `TrackList`/`TrackRow` usam a grade `.track-row` (índice, capa, faixa,
 *   álbum, duração, ações) para biblioteca, fila e resultados curados;
 * - `YoutubeRow` usa `.yt-row` para os resultados crus do YouTube, com a
 *   duração e o selo de versão que a busca detectou.
 */

import { ExternalLink, Heart, ListPlus, Pause, Play, Trash2 } from "lucide-react";

import type { CiderTrack } from "../api/query";
import { timecode } from "../format";
import { Badge, IconButton } from "./primitives";

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
  onAddToQueue?: () => void;
  onToggleFavorite?: () => void;
  onRemove?: () => void;
}) {
  const version = versionLabel(track);
  return (
    <div
      className="track-row"
      role="button"
      tabIndex={0}
      aria-current={current ? "true" : undefined}
      onDoubleClick={onPlay}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onPlay();
        }
      }}
      onClick={onPlay}
    >
      <span className="index">{current && playing ? <Play size={12} /> : index + 1}</span>
      <span className="track-cell">
        <img
          className="track-art"
          src={track.artworkUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
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
        {onAddToQueue ? (
          <IconButton
            label="Adicionar à fila"
            onClick={(event) => {
              event.stopPropagation();
              onAddToQueue();
            }}
          >
            <ListPlus size={15} />
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
  onAddToQueue,
  onToggleFavorite,
}: {
  track: CiderTrack;
  current?: boolean;
  playing?: boolean;
  favorite?: boolean;
  onPlay: () => void;
  onAddToQueue?: () => void;
  onToggleFavorite?: () => void;
}) {
  return (
    <div className="track-row yt-row" aria-current={current ? "true" : undefined}>
      <button type="button" className="yt-row-main" onClick={onPlay}>
        <img
          className="cover"
          src={track.artworkUrl}
          alt=""
          width={56}
          height={56}
          loading="lazy"
          referrerPolicy="no-referrer"
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
      </button>
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
        {onAddToQueue ? (
          <IconButton label="Adicionar à fila" onClick={onAddToQueue}>
            <ListPlus size={15} />
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
