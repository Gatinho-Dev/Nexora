/**
 * Pesquisa.
 *
 * A consulta vive na URL (`/cider/pesquisa?q=…`), então o resultado é
 * compartilhável e o botão voltar do navegador funciona — é a diferença
 * deliberada em relação ao desktop, onde a busca era estado interno de uma
 * janela única.
 *
 * A lista é o resultado **cru** do YouTube, com a versão detectada e a duração
 * originais. Nada é renomeado: o título limpo aparece, e o título do vídeo fica
 * no `title` do elemento para quem quiser conferir.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Loader2, Play, Search } from "lucide-react";

import type { CiderTrack } from "../api/query";
import { useCider } from "../useCider";
import { useCiderLibrary } from "../library";
import { useCiderSettings } from "../settings/store";
import { currentSearchPreferences, playFrom, rememberSearch, runSearch, toggleFavoriteWithToast } from "../play";
import { useCiderUi } from "../ui";
import { Button, EmptyState, Notice, SectionHeader, Switch } from "../components/primitives";
import { YoutubeRow } from "../components/TrackList";

export function CiderSearchPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const { state, engine } = useCider();
  const favorites = useCiderLibrary((store) => store.favorites);
  const searches = useCiderLibrary((store) => store.searches);
  const settings = useCiderSettings((store) => store.settings);
  const patch = useCiderSettings((store) => store.patch);
  const attempts = useCiderUi((store) => store.searchAttempts);
  const source = useCiderUi((store) => store.searchSource);
  const error = useCiderUi((store) => store.lastSearchError);

  // O campo acompanha a URL por ajuste **durante a renderização** (o padrão
  // documentado do React para estado derivado de prop). Um efeito aqui causaria
  // uma renderização em cascata a cada mudança de consulta.
  const [term, setTerm] = useState(query);
  const [syncedQuery, setSyncedQuery] = useState(query);
  if (syncedQuery !== query) {
    setSyncedQuery(query);
    setTerm(query);
  }

  // O resultado guarda **qual pedido o produziu** — consulta + preferências de
  // ordenação. A lista exibida é derivada disso: uma consulta nova (ou uma
  // preferência nova) simplesmente não casa com o resultado antigo, e por isso
  // não é preciso nenhum efeito para "limpar" a tela.
  const trimmedQuery = query.trim();
  const requestKey = `${trimmedQuery}\u0000${
    settings.preferOfficialAudio ? 1 : 0
  }|${settings.hideAlternativeVersions ? 1 : 0}|${settings.maxPerChannel}|${settings.searchLimit}`;

  const [outcome, setOutcome] = useState<{ key: string; tracks: CiderTrack[] } | null>(null);

  const fresh = outcome !== null && outcome.key === requestKey;
  const results = fresh ? outcome.tracks : [];
  const ran = fresh ? trimmedQuery : null;
  // "Carregando" é **derivado**, não um estado à parte: existe uma consulta e
  // ainda não existe o resultado dela. Sem bandeira própria não há como o
  // indicador ficar girando depois que a resposta chegou.
  const loading = trimmedQuery !== "" && !fresh;

  useEffect(() => {
    if (!trimmedQuery || outcome?.key === requestKey) return;
    let alive = true;
    void runSearch(trimmedQuery, currentSearchPreferences(settings))
      .then((result) => {
        if (!alive) return;
        setOutcome({ key: requestKey, tracks: result.tracks });
        rememberSearch(trimmedQuery);
      })
      .catch(() => {
        // Falha inesperada: o pedido conta como resolvido (lista vazia) para o
        // indicador não girar para sempre; o motivo real aparece na tela, vindo
        // do estado da última busca.
        if (alive) setOutcome({ key: requestKey, tracks: [] });
      });
    return () => {
      alive = false;
    };
    // `requestKey` já resume a consulta e as preferências de ordenação; `outcome`
    // entra só como guarda de "já tenho este resultado".
  }, [requestKey, trimmedQuery, outcome, settings]);

  const submit = () => {
    const trimmed = term.trim();
    setParams(trimmed ? { q: trimmed } : {});
  };

  const favoriteIds = favorites.map((track) => track.videoId);
  const sourceHost = source ? safeHost(source) : null;

  return (
    <div className="page stack gap-6">
      <div className="page-head">
        <div>
          <div className="page-kicker">Pesquisa</div>
          <h1>Buscar no YouTube</h1>
          <p className="muted">
            Escreva o nome da música, do artista ou use os prefixos:{" "}
            <span className="mono">artist:</span>, <span className="mono">album:</span>,{" "}
            <span className="mono">@</span> e <span className="mono">#</span>. A busca é sem chave,
            em instâncias comunitárias Piped/Invidious.
          </p>
        </div>
      </div>

      <form
        className="search-field"
        style={{ minWidth: 0 }}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Search size={16} />
        <input
          type="search"
          value={term}
          placeholder="Ex.: artist: Dua Lipa, album: Random Access Memories"
          aria-label="Buscar"
          onChange={(event) => setTerm(event.target.value)}
        />
        <Button size="sm" variant="primary" onClick={submit}>
          Buscar
        </Button>
      </form>

      <section className="section">
        <SectionHeader title="Como a lista é ordenada" />
        <div className="filter-grid">
          <label className="inline">
            <Switch
              label="Preferir áudio oficial"
              checked={settings.preferOfficialAudio}
              onChange={(value) => patch({ preferOfficialAudio: value })}
            />
            <span className="small">Preferir áudio oficial e canais “Topic”</span>
          </label>
          <label className="inline">
            <Switch
              label="Esconder versões alternativas"
              checked={settings.hideAlternativeVersions}
              onChange={(value) => patch({ hideAlternativeVersions: value })}
            />
            <span className="small">Esconder ao vivo, remix, cover e versões aceleradas</span>
          </label>
          <label className="inline">
            <span className="small">Máximo por canal</span>
            <input
              className="input"
              type="number"
              min={0}
              max={20}
              value={settings.maxPerChannel}
              style={{ maxWidth: 90 }}
              onChange={(event) => patch({ maxPerChannel: Number(event.target.value) })}
            />
          </label>
          <label className="inline">
            <span className="small">Resultados por consulta</span>
            <input
              className="input"
              type="number"
              min={5}
              max={50}
              value={settings.searchLimit}
              style={{ maxWidth: 90 }}
              onChange={(event) => patch({ searchLimit: Number(event.target.value) })}
            />
          </label>
        </div>
        {sourceHost ? (
          <p className="xsmall faint" style={{ marginTop: 8 }}>
            Última resposta de <span className="mono">{sourceHost}</span>
            {attempts.length > 0 ? ` · ${attempts.length} instância(s) falharam antes` : ""}.
          </p>
        ) : null}
      </section>

      {searches.length > 0 && !query ? (
        <section className="section">
          <SectionHeader title="Buscas recentes" />
          <div className="chip-row">
            {searches.slice(0, 12).map((entry) => (
              <button
                key={`${entry.query}-${entry.at}`}
                type="button"
                className="chip"
                onClick={() => setParams({ q: entry.query })}
              >
                <Search size={14} />
                {entry.query}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {loading ? (
        <p className="inline muted">
          <Loader2 size={16} className="cider-spin" /> Buscando em instâncias comunitárias…
        </p>
      ) : null}

      {!loading && error && query ? (
        <Notice tone="warning" title="Nenhuma fonte respondeu">
          {error}
          {attempts.length > 0 ? (
            <ul style={{ marginTop: 8, paddingLeft: 18 }}>
              {attempts.map((attempt) => (
                <li key={`${attempt.instance}-${attempt.error}`} className="xsmall">
                  <span className="mono">{safeHost(attempt.instance) ?? attempt.instance}</span>: {attempt.error}
                </li>
              ))}
            </ul>
          ) : null}
        </Notice>
      ) : null}

      {results.length > 0 ? (
        <section className="section">
          <SectionHeader
            title={`${results.length} resultado(s)`}
            action={
              <div className="inline">
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Play size={14} />}
                  onClick={() => playFrom(engine, results, 0)}
                >
                  Tocar tudo
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    engine.appendQueue(results);
                  }}
                >
                  Adicionar à fila
                </Button>
              </div>
            }
          />
          <div className="stack tight">
            {results.map((track) => (
              <YoutubeRow
                key={track.videoId}
                track={track}
                current={track.videoId === state.track?.videoId}
                playing={state.phase === "playing"}
                favorite={favoriteIds.includes(track.videoId)}
                onPlay={() => playFrom(engine, results, results.indexOf(track))}
                onAddToQueue={() => engine.appendQueue([track])}
                onToggleFavorite={() => toggleFavoriteWithToast(track)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {!loading && query && !error && results.length === 0 && ran ? (
        <EmptyState
          icon={<Search size={22} />}
          title="Nada encontrado"
          message={`A busca por “${query}” não devolveu resultados utilizáveis. Vale tentar outro termo, ou o próprio título do vídeo no YouTube.`}
        />
      ) : null}

      {!query ? (
        <EmptyState
          icon={<Search size={22} />}
          title="Digite para buscar"
          message="A lista mostra o resultado real do YouTube, com o título do vídeo preservado — nada é renomeado nem inventado."
        />
      ) : null}
    </div>
  );
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}
