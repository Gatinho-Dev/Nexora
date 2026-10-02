/**
 * Biblioteca local: visão geral, álbuns, artistas, músicas, histórico,
 * favoritos e playlists.
 *
 * O desktop tinha SQLite; aqui o equivalente é o `localStorage`, e a limitação
 * aparece escrita na interface em vez de escondida: **a biblioteca é deste
 * navegador**. Tudo que estiver aqui veio do que foi tocado ou favoritado nesta
 * máquina — nenhum catálogo é importado de fora.
 */

import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  Clock,
  Disc3,
  Heart,
  Info,
  Music,
  Pencil,
  Play,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";

import { useCider } from "../useCider";
import {
  albumKeyOf,
  groupAlbums,
  groupArtists,
  knownTracks,
  useCiderLibrary,
  type Playlist,
} from "../library";
import { playFrom, toggleFavoriteWithToast } from "../play";
import { deriveStats, formatDuration } from "../stats";
import { AddToPlaylistButton } from "../components/AddToPlaylist";
import { CoverArt } from "../components/CoverArt";
import {
  Button,
  EmptyState,
  Field,
  MediaCard,
  Modal,
  SectionHeader,
  StatTile,
} from "../components/primitives";
import { timecode } from "../format";
import { TrackList } from "../components/TrackList";

/** Faixas conhecidas (favoritos + histórico), sem repetição. */
function useLocalTracks() {
  const library = useCiderLibrary();
  return useMemo(() => knownTracks(library), [library]);
}

function localNote() {
  return (
    <p className="xsmall faint">
      <Info size={13} /> Esta biblioteca vive no armazenamento local deste navegador. Nada é enviado
      para o Google nem sincronizado entre máquinas.
    </p>
  );
}

/* ------------------------------------------------------------------ *
 * Visão geral                                                        *
 * ------------------------------------------------------------------ */

export function CiderLibraryPage() {
  const navigate = useNavigate();
  const tracks = useLocalTracks();
  const history = useCiderLibrary((store) => store.history);
  const favorites = useCiderLibrary((store) => store.favorites);
  const playlists = useCiderLibrary((store) => store.playlists);
  const { state, engine } = useCider();

  const stats = useMemo(() => deriveStats(history), [history]);
  const albums = useMemo(() => groupAlbums(tracks), [tracks]);
  const artists = useMemo(() => groupArtists(tracks), [tracks]);
  const favoriteIds = favorites.map((track) => track.videoId);

  if (tracks.length === 0) {
    return (
      <div className="page stack gap-6">
        <div className="page-head">
          <div>
            <div className="page-kicker">Biblioteca</div>
            <h1>Sua biblioteca local</h1>
          </div>
        </div>
        <EmptyState
          icon={<Disc3 size={22} />}
          title="Ainda não há nada aqui"
          message="Ouça algumas faixas ou favorite as que você quer guardar. Elas aparecem aqui — agrupadas por artista e por álbum (o palpite de álbum vem do canal que publicou o vídeo)."
          action={
            <div className="inline">
              <Button variant="primary" onClick={() => navigate("/cider/pesquisa")}>
                Pesquisar
              </Button>
              <Button variant="ghost" onClick={() => navigate("/cider/explorar")}>
                Explorar por tema
              </Button>
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
          <div className="page-kicker">Biblioteca</div>
          <h1>Sua biblioteca local</h1>
          <p className="muted">
            Feita do que você ouviu e favoritou neste navegador: {tracks.length} faixa(s),{" "}
            {artists.length} artista(s), {albums.length} álbum(ns) e {playlists.length} playlist(s).
          </p>
        </div>
        <div className="page-actions">
          <Button
            variant="primary"
            icon={<Play size={15} />}
            onClick={() => playFrom(engine, tracks, 0)}
          >
            Tocar a biblioteca
          </Button>
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
          title="Álbuns"
          action={
            <button type="button" className="link xsmall" onClick={() => navigate("/cider/albuns")}>
              Ver todos
            </button>
          }
        />
        <div className="grid-cards dense">
          {albums.slice(0, 6).map((album) => (
            <MediaCard
              key={album.key}
              title={album.title}
              subtitle={`${album.tracks.length} faixa(s)`}
              artworkUrl={album.artworkUrl}
              onOpen={() => navigate(`/cider/albuns/${encodeURIComponent(album.key)}`)}
              onPlay={() => playFrom(engine, album.tracks, 0)}
            />
          ))}
        </div>
      </section>

      <section className="section">
        <SectionHeader
          title="Artistas"
          action={
            <button type="button" className="link xsmall" onClick={() => navigate("/cider/artistas")}>
              Ver todos
            </button>
          }
        />
        <div className="grid-cards dense">
          {artists.slice(0, 6).map((artist) => (
            <MediaCard
              key={artist.key}
              title={artist.name}
              subtitle={`${artist.tracks.length} faixa(s)`}
              artworkUrl={artist.artworkUrl}
              round
              onOpen={() => navigate(`/cider/artistas/${encodeURIComponent(artist.key)}`)}
              onPlay={() => playFrom(engine, artist.tracks, 0)}
            />
          ))}
        </div>
      </section>

      <section className="section">
        <SectionHeader
          title="Músicas"
          action={
            <button type="button" className="link xsmall" onClick={() => navigate("/cider/musicas")}>
              Ver todas
            </button>
          }
        />
        <TrackList
          tracks={tracks.slice(0, 12)}
          currentVideoId={state.track?.videoId}
          playing={state.phase === "playing"}
          favorites={favoriteIds}
          onPlay={(index) => playFrom(engine, tracks.slice(0, 12), index)}
          onAddToQueue={(track) => engine.appendQueue([track])}
          onToggleFavorite={(track) => toggleFavoriteWithToast(track)}
        />
      </section>

      {localNote()}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Álbuns                                                             *
 * ------------------------------------------------------------------ */

export function CiderAlbumsPage() {
  const navigate = useNavigate();
  const tracks = useLocalTracks();
  const [term, setTerm] = useState("");
  const albums = useMemo(() => groupAlbums(tracks), [tracks]);
  const filtered = albums.filter((album) => album.title.toLowerCase().includes(term.trim().toLowerCase()));

  return (
    <div className="page stack gap-6">
      <div className="page-head">
        <div>
          <div className="page-kicker">Biblioteca</div>
          <h1>Álbuns</h1>
          <p className="muted">
            Agrupados pelo palpite de álbum do vídeo — quando não existe, o canal que publicou faz
            as vezes dele. Nada é corrigido à mão por catálogo externo.
          </p>
        </div>
        <div className="page-actions">
          <input
            className="input"
            value={term}
            placeholder="Filtrar álbuns…"
            aria-label="Filtrar álbuns"
            onChange={(event) => setTerm(event.target.value)}
            style={{ maxWidth: 240 }}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Disc3 size={22} />}
          title="Nenhum álbum"
          message="Ouça ou favorite faixas para os álbuns aparecerem aqui."
        />
      ) : (
        <div className="grid-cards">
          {filtered.map((album) => (
            <MediaCard
              key={album.key}
              title={album.title}
              subtitle={`${album.tracks.length} faixa(s)`}
              artworkUrl={album.artworkUrl}
              onOpen={() => navigate(`/cider/albuns/${encodeURIComponent(album.key)}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CiderAlbumPage() {
  const params = useParams();
  const navigate = useNavigate();
  const tracks = useLocalTracks();
  const favorites = useCiderLibrary((store) => store.favorites);
  const { state, engine } = useCider();
  const key = params.key ? decodeURIComponent(params.key) : "";
  const album = useMemo(() => groupAlbums(tracks).find((entry) => entry.key === key), [tracks, key]);

  if (!album) {
    return (
      <div className="page stack gap-4">
        <EmptyState
          icon={<Disc3 size={22} />}
          title="Álbum não encontrado"
          message="Ele pode ter saído da biblioteca (o histórico foi apagado, por exemplo)."
          action={
            <Button onClick={() => navigate("/cider/albuns")}>Voltar aos álbuns</Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="page stack gap-6">
      <header className="detail-hero">
        {album.artworkUrl ? (
          <div className="detail-bg" style={{ backgroundImage: `url(${album.artworkUrl})` }} aria-hidden="true" />
        ) : null}
        <img className="detail-cover" src={album.artworkUrl} alt="" referrerPolicy="no-referrer" />
        <div className="detail-meta">
          <span className="xsmall faint uppercase">Álbum · biblioteca local</span>
          <h1>{album.title}</h1>
          <p className="detail-sub">{album.tracks.length} faixa(s) · {albumKeyOf(album.tracks[0]!)}</p>
          <div className="inline">
            <Button variant="primary" icon={<Play size={16} />} onClick={() => playFrom(engine, album.tracks, 0)}>
              Tocar
            </Button>
            <Button icon={<Plus size={15} />} onClick={() => engine.appendQueue(album.tracks)}>
              Adicionar à fila
            </Button>
            <AddToPlaylistButton tracks={album.tracks} />
          </div>
        </div>
      </header>

      <TrackList
        tracks={album.tracks}
        currentVideoId={state.track?.videoId}
        playing={state.phase === "playing"}
        favorites={favorites.map((track) => track.videoId)}
        onPlay={(index) => playFrom(engine, album.tracks, index)}
        onAddToQueue={(track) => engine.appendQueue([track])}
        onToggleFavorite={(track) => toggleFavoriteWithToast(track)}
      />

      {localNote()}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Artistas                                                           *
 * ------------------------------------------------------------------ */

export function CiderArtistsPage() {
  const navigate = useNavigate();
  const tracks = useLocalTracks();
  const artists = useMemo(() => groupArtists(tracks), [tracks]);

  return (
    <div className="page stack gap-6">
      <div className="page-head">
        <div>
          <div className="page-kicker">Biblioteca</div>
          <h1>Artistas</h1>
          <p className="muted">
            O artista é o campo do vídeo; quando ele é um canal “Topic”, o nome exibido é o do canal
            que publicou o áudio oficial.
          </p>
        </div>
      </div>

      {artists.length === 0 ? (
        <EmptyState
          icon={<UserRound size={22} />}
          title="Nenhum artista"
          message="Ouça ou favorite faixas para os artistas aparecerem aqui."
        />
      ) : (
        <div className="grid-cards">
          {artists.map((artist) => (
            <MediaCard
              key={artist.key}
              title={artist.name}
              subtitle={`${artist.tracks.length} faixa(s)`}
              artworkUrl={artist.artworkUrl}
              round
              onOpen={() => navigate(`/cider/artistas/${encodeURIComponent(artist.key)}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CiderArtistPage() {
  const params = useParams();
  const navigate = useNavigate();
  const tracks = useLocalTracks();
  const favorites = useCiderLibrary((store) => store.favorites);
  const { state, engine } = useCider();
  const key = params.key ? decodeURIComponent(params.key) : "";
  const artist = useMemo(() => groupArtists(tracks).find((entry) => entry.key === key), [tracks, key]);

  if (!artist) {
    return (
      <div className="page stack gap-4">
        <EmptyState
          icon={<UserRound size={22} />}
          title="Artista não encontrado"
          message="Ele pode ter saído da biblioteca."
          action={<Button onClick={() => navigate("/cider/artistas")}>Voltar aos artistas</Button>}
        />
      </div>
    );
  }

  const minutes = artist.tracks.reduce((total, track) => total + track.durationMs, 0);

  return (
    <div className="page stack gap-6">
      <header className="detail-hero">
        {artist.artworkUrl ? (
          <div className="detail-bg" style={{ backgroundImage: `url(${artist.artworkUrl})` }} aria-hidden="true" />
        ) : null}
        <img className="detail-cover" src={artist.artworkUrl} alt="" referrerPolicy="no-referrer" />
        <div className="detail-meta">
          <span className="xsmall faint uppercase">Artista · biblioteca local</span>
          <h1>{artist.name}</h1>
          <p className="detail-sub">
            {artist.tracks.length} faixa(s) · {timecode(minutes)} no total
          </p>
          <div className="inline">
            <Button variant="primary" icon={<Play size={16} />} onClick={() => playFrom(engine, artist.tracks, 0)}>
              Tocar
            </Button>
            <Button icon={<Plus size={15} />} onClick={() => engine.appendQueue(artist.tracks)}>
              Adicionar à fila
            </Button>
            <Button
              icon={<Music size={15} />}
              onClick={() => navigate(`/cider/radio`)}
              title="Abrir a Rádio para ouvir mais deste artista"
            >
              Rádio deste artista
            </Button>
          </div>
        </div>
      </header>

      <TrackList
        tracks={artist.tracks}
        currentVideoId={state.track?.videoId}
        playing={state.phase === "playing"}
        favorites={favorites.map((track) => track.videoId)}
        onPlay={(index) => playFrom(engine, artist.tracks, index)}
        onAddToQueue={(track) => engine.appendQueue([track])}
        onToggleFavorite={(track) => toggleFavoriteWithToast(track)}
      />

      {localNote()}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Músicas                                                            *
 * ------------------------------------------------------------------ */

export function CiderSongsPage() {
  const tracks = useLocalTracks();
  const favorites = useCiderLibrary((store) => store.favorites);
  const { state, engine } = useCider();

  return (
    <div className="page stack gap-6">
      <div className="page-head">
        <div>
          <div className="page-kicker">Biblioteca</div>
          <h1>Músicas</h1>
          <p className="muted">{tracks.length} faixa(s) conhecidas neste navegador.</p>
        </div>
        <div className="page-actions">
          <Button
            variant="primary"
            icon={<Play size={15} />}
            disabled={tracks.length === 0}
            onClick={() => playFrom(engine, tracks, 0)}
          >
            Tocar todas
          </Button>
          <AddToPlaylistButton tracks={tracks} label="Adicionar todas à playlist" />
        </div>
      </div>

      {tracks.length === 0 ? (
        <EmptyState
          icon={<Music size={22} />}
          title="Nenhuma música"
          message="O que você ouvir e favoritar aparece aqui."
        />
      ) : (
        <TrackList
          tracks={tracks}
          currentVideoId={state.track?.videoId}
          playing={state.phase === "playing"}
          favorites={favorites.map((track) => track.videoId)}
          onPlay={(index) => playFrom(engine, tracks, index)}
          onAddToQueue={(track) => engine.appendQueue([track])}
          onToggleFavorite={(track) => toggleFavoriteWithToast(track)}
        />
      )}

      {localNote()}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Histórico                                                          *
 * ------------------------------------------------------------------ */

function whenLabel(at: number): string {
  if (!at) return "—";
  const date = new Date(at);
  const minutes = Math.round((Date.now() - at) / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)} min atrás`;
  const day = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return `${day} · ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

export function CiderHistoryPage() {
  const navigate = useNavigate();
  const history = useCiderLibrary((store) => store.history);
  const clearHistory = useCiderLibrary((store) => store.clearHistory);
  const removeEntry = useCiderLibrary((store) => store.removeHistoryEntry);
  const { engine } = useCider();
  const [confirming, setConfirming] = useState(false);

  const entries = history;

  return (
    <div className="page stack gap-6">
      <div className="page-head">
        <div>
          <div className="page-kicker">Biblioteca</div>
          <h1>Histórico</h1>
          <p className="muted">
            Cada linha é uma faixa que começou a tocar neste navegador, com o horário real.{" "}
            {history.length} registro(s).
          </p>
        </div>
        <div className="page-actions">
          <Button
            icon={<Play size={15} />}
            disabled={entries.length === 0}
            onClick={() => playFrom(engine, entries.map((entry) => entry.track), 0)}
          >
            Tocar o histórico
          </Button>
          <Button
            variant="danger"
            icon={<Trash2 size={15} />}
            disabled={entries.length === 0}
            onClick={() => setConfirming(true)}
          >
            Apagar histórico
          </Button>
        </div>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={<Clock size={22} />}
          title="Histórico vazio"
          message="O que você ouvir aparece aqui — e pode ser desligado em Configurações → Biblioteca e privacidade."
          action={<Button variant="primary" onClick={() => navigate("/cider/pesquisa")}>Pesquisar</Button>}
        />
      ) : (
        <div className="stack tight">
          {entries.map((entry) => (
            <div className="history-item" key={`${entry.track.videoId}-${entry.playedAt}`}>
              <img
                className="cover-thumb"
                src={entry.track.artworkUrl}
                alt=""
                width={44}
                height={44}
                loading="lazy"
                referrerPolicy="no-referrer"
              />
              <button
                type="button"
                className="link"
                style={{ minWidth: 0, textAlign: "left" }}
                onClick={() => playFrom(engine, [entry.track], 0)}
                title="Tocar de novo"
              >
                <span className="truncate" style={{ display: "block" }}>
                  {entry.track.title}
                </span>
                <span className="xsmall faint truncate" style={{ display: "block" }}>
                  {entry.track.artist || entry.track.channelName}
                </span>
              </button>
              <span className="xsmall faint truncate history-album">
                {entry.track.albumHint ?? "—"}
              </span>
              <span className="history-when">{whenLabel(entry.playedAt)}</span>
              <span className="inline">
                <button
                  type="button"
                  className="btn icon"
                  aria-label="Remover do histórico"
                  title="Remover do histórico"
                  onClick={() => removeEntry(entry.track.videoId, entry.playedAt)}
                >
                  <Trash2 size={14} />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={confirming}
        title="Apagar todo o histórico?"
        onClose={() => setConfirming(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                clearHistory();
                setConfirming(false);
              }}
            >
              Apagar
            </Button>
          </>
        }
      >
        <p className="confirm-text">
          O histórico deste navegador será apagado. Favoritos e playlists não são afetados. As
          estatísticas passam a começar do zero.
        </p>
      </Modal>

      {localNote()}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Favoritos                                                          *
 * ------------------------------------------------------------------ */

export function CiderFavoritesPage() {
  const navigate = useNavigate();
  const favorites = useCiderLibrary((store) => store.favorites);
  const { state, engine } = useCider();

  return (
    <div className="page stack gap-6">
      <div className="page-head">
        <div>
          <div className="page-kicker">Biblioteca</div>
          <h1>Favoritos</h1>
          <p className="muted">{favorites.length} faixa(s) guardadas neste navegador.</p>
        </div>
        <div className="page-actions">
          <Button
            variant="primary"
            icon={<Play size={15} />}
            disabled={favorites.length === 0}
            onClick={() => playFrom(engine, favorites, 0)}
          >
            Tocar favoritos
          </Button>
          <AddToPlaylistButton tracks={favorites} label="Adicionar à playlist" />
        </div>
      </div>

      {favorites.length === 0 ? (
        <EmptyState
          icon={<Heart size={22} />}
          title="Nenhum favorito"
          message="Toque no coração de uma faixa (na playbar, na lista ou em Tocando agora) para guardá-la aqui."
          action={<Button variant="primary" onClick={() => navigate("/cider/pesquisa")}>Pesquisar</Button>}
        />
      ) : (
        <TrackList
          tracks={favorites}
          currentVideoId={state.track?.videoId}
          playing={state.phase === "playing"}
          favorites={favorites.map((track) => track.videoId)}
          onPlay={(index) => playFrom(engine, favorites, index)}
          onAddToQueue={(track) => engine.appendQueue([track])}
          onToggleFavorite={(track) => toggleFavoriteWithToast(track)}
        />
      )}

      {localNote()}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Playlists                                                          *
 * ------------------------------------------------------------------ */

export function CiderPlaylistsPage() {
  const navigate = useNavigate();
  const playlists = useCiderLibrary((store) => store.playlists);
  const createPlaylist = useCiderLibrary((store) => store.createPlaylist);
  const { engine } = useCider();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const create = () => {
    const playlist = createPlaylist(name.trim() || "Nova playlist");
    setName("");
    setOpen(false);
    navigate(`/cider/playlists/${playlist.id}`);
  };

  return (
    <div className="page stack gap-6">
      <div className="page-head">
        <div>
          <div className="page-kicker">Biblioteca</div>
          <h1>Playlists</h1>
          <p className="muted">
            Playlists locais, deste navegador: aqui elas são suas de verdade — criar, renomear,
            reordenar e apagar, sem depender de conta nenhuma.
          </p>
        </div>
        <div className="page-actions">
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => setOpen(true)}>
            Nova playlist
          </Button>
        </div>
      </div>

      {playlists.length === 0 ? (
        <EmptyState
          icon={<Disc3 size={22} />}
          title="Nenhuma playlist"
          message="Crie uma playlist e vá adicionando faixas das listas, dos álbuns ou de Tocando agora."
          action={
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => setOpen(true)}>
              Criar a primeira
            </Button>
          }
        />
      ) : (
        <div className="grid-cards">
          {playlists.map((playlist) => (
            <MediaCard
              key={playlist.id}
              title={playlist.name}
              subtitle={`${playlist.tracks.length} faixa(s)`}
              artworkUrl={playlist.tracks[0]?.artworkUrl}
              badge={<span className="badge">Local</span>}
              onOpen={() => navigate(`/cider/playlists/${playlist.id}`)}
              onPlay={playlist.tracks.length > 0 ? () => playFrom(engine, playlist.tracks, 0) : undefined}
            />
          ))}
        </div>
      )}

      <Modal
        open={open}
        title="Nova playlist"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" icon={<Plus size={15} />} disabled={!name.trim()} onClick={create}>
              Criar
            </Button>
          </>
        }
      >
        <Field label="Nome da playlist" hint="Até 80 caracteres.">
          <input
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Foco no trabalho"
            autoFocus
          />
        </Field>
      </Modal>

      {localNote()}
    </div>
  );
}

export function CiderPlaylistPage() {
  const params = useParams();
  const navigate = useNavigate();
  const playlist: Playlist | undefined = useCiderLibrary((store) =>
    store.playlists.find((entry) => entry.id === params.id),
  );
  const renamePlaylist = useCiderLibrary((store) => store.renamePlaylist);
  const deletePlaylist = useCiderLibrary((store) => store.deletePlaylist);
  const removeFromPlaylist = useCiderLibrary((store) => store.removeFromPlaylist);
  const favorites = useCiderLibrary((store) => store.favorites);
  const { state, engine } = useCider();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  const [confirming, setConfirming] = useState(false);

  if (!playlist) {
    return (
      <div className="page stack gap-4">
        <EmptyState
          icon={<Disc3 size={22} />}
          title="Playlist não encontrada"
          message="Ela pode ter sido apagada em outra aba."
          action={<Button onClick={() => navigate("/cider/playlists")}>Voltar às playlists</Button>}
        />
      </div>
    );
  }

  return (
    <div className="page stack gap-6">
      <header className="detail-hero">
        {playlist.tracks[0]?.artworkUrl ? (
          <div
            className="detail-bg"
            style={{ backgroundImage: `url(${playlist.tracks[0].artworkUrl})` }}
            aria-hidden="true"
          />
        ) : null}
        <CoverArt
          url={playlist.tracks[0]?.artworkUrl}
          title={playlist.name}
          className="detail-cover"
        />
        <div className="detail-meta">
          <span className="xsmall faint uppercase">Playlist · local</span>
          <h1>{playlist.name}</h1>
          <p className="detail-sub">
            {playlist.tracks.length} faixa(s) · atualizada em{" "}
            {playlist.updatedAt ? new Date(playlist.updatedAt).toLocaleDateString("pt-BR") : "—"}
          </p>
          <div className="inline">
            <Button
              variant="primary"
              icon={<Play size={16} />}
              disabled={playlist.tracks.length === 0}
              onClick={() => playFrom(engine, playlist.tracks, 0)}
            >
              Tocar
            </Button>
            <Button
              icon={<Plus size={15} />}
              disabled={playlist.tracks.length === 0}
              onClick={() => engine.appendQueue(playlist.tracks)}
            >
              Adicionar à fila
            </Button>
            <Button
              icon={<Pencil size={15} />}
              onClick={() => {
                setName(playlist.name);
                setRenaming(true);
              }}
            >
              Renomear
            </Button>
            <Button variant="danger" icon={<Trash2 size={15} />} onClick={() => setConfirming(true)}>
              Apagar playlist
            </Button>
          </div>
        </div>
      </header>

      {playlist.tracks.length === 0 ? (
        <EmptyState
          icon={<Music size={22} />}
          title="Playlist vazia"
          message="Use “Adicionar à playlist” nas faixas de qualquer lista para trazer músicas para cá."
          action={
            <Button variant="primary" onClick={() => navigate("/cider/pesquisa")}>
              Pesquisar músicas
            </Button>
          }
        />
      ) : (
        <TrackList
          tracks={playlist.tracks}
          currentVideoId={state.track?.videoId}
          playing={state.phase === "playing"}
          favorites={favorites.map((track) => track.videoId)}
          onPlay={(index) => playFrom(engine, playlist.tracks, index)}
          onAddToQueue={(track) => engine.appendQueue([track])}
          onToggleFavorite={(track) => toggleFavoriteWithToast(track)}
          onRemove={(track) => removeFromPlaylist(playlist.id, track.videoId)}
        />
      )}

      <Modal
        open={renaming}
        title="Renomear playlist"
        onClose={() => setRenaming(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenaming(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              disabled={!name.trim()}
              onClick={() => {
                renamePlaylist(playlist.id, name);
                setRenaming(false);
              }}
            >
              Salvar
            </Button>
          </>
        }
      >
        <Field label="Nome da playlist">
          <input
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </Field>
      </Modal>

      <Modal
        open={confirming}
        title="Apagar esta playlist?"
        onClose={() => setConfirming(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                deletePlaylist(playlist.id);
                setConfirming(false);
                navigate("/cider/playlists");
              }}
            >
              Apagar
            </Button>
          </>
        }
      >
        <p className="confirm-text">
          A playlist “{playlist.name}” e a lista de faixas dela serão apagadas. As faixas continuam
          no histórico e nos favoritos.
        </p>
      </Modal>

      {localNote()}
    </div>
  );
}
