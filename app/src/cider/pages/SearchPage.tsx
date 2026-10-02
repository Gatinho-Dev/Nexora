/**
 * Pesquisa.
 *
 * A consulta vive na URL (`/cider/pesquisa?q=…`), então o resultado é
 * compartilhável e o botão voltar do navegador funciona — é a diferença
 * deliberada em relação ao desktop, onde a busca era estado interno de uma
 * janela única.
 *
 * A lista cresce por **rolagem**: cada página nova vem pelo mesmo caminho da
 * primeira (`runSearch` com o cursor da página anterior), então a classificação,
 * o teto por canal e a deduplicação valem para todas as páginas. Nada de limite
 * para o usuário ajustar à mão — as preferências existem, mas o padrão já
 * entrega uma lista longa.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { Loader2, Play, Search } from "lucide-react";

import type { CiderTrack } from "../api/query";
import type { SearchNext } from "../api/search";
import { useCider } from "../useCider";
import { useCiderLibrary } from "../library";
import { useCiderSettings } from "../settings/store";
import {
  currentSearchPreferences,
  playAfter,
  playFrom,
  rememberSearch,
  runSearch,
  toggleFavoriteWithToast,
} from "../play";
import { useCiderUi } from "../ui";
import { Button, EmptyState, Notice, SectionHeader, Switch } from "../components/primitives";
import { YoutubeRow } from "../components/TrackList";

/** Quantas páginas seguidas tentar quando uma volta só com repetidos. */
const MAX_PAGES_PER_SCROLL = 3;

interface SearchResult {
  key: string;
  tracks: CiderTrack[];
  /** Continuação da lista; `null` quando a fonte não tem mais nada. */
  next: SearchNext | null;
}

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

  const [outcome, setOutcome] = useState<SearchResult | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const fresh = outcome !== null && outcome.key === requestKey;
  // O resultado casado entra no `useMemo` para a lista manter a **mesma
  // identidade** entre renderizações: sem isso, o carregamento progressivo
  // receberia um array novo a cada quadro e reagendaria a página sozinho.
  const matched = useMemo(() => (fresh ? outcome : null), [fresh, outcome]);
  const results = useMemo(() => matched?.tracks ?? [], [matched]);
  const cursor = matched?.next ?? null;
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
        setOutcome({ key: requestKey, tracks: result.tracks, next: result.next });
        rememberSearch(trimmedQuery);
      })
      .catch(() => {
        // Falha inesperada: o pedido conta como resolvido (lista vazia) para o
        // indicador não girar para sempre; o motivo real aparece na tela, vindo
        // do estado da última busca.
        if (alive) setOutcome({ key: requestKey, tracks: [], next: null });
      });
    return () => {
      alive = false;
    };
    // `requestKey` já resume a consulta e as preferências de ordenação; `outcome`
    // entra só como guarda de "já tenho este resultado".
  }, [requestKey, trimmedQuery, outcome, settings]);

  /**
   * Carrega a próxima página e anexa à lista.
   *
   * Uma página pode voltar só com faixas que já estão na tela (a mesma música
   * aparece em mais de uma página da fonte). Nesse caso vale insistir na
   * seguinte em vez de mostrar um "carregando" que não acrescenta nada — daí o
   * laço, com teto de páginas para não varrer a fonte inteira de uma vez.
   */
  const loadMore = useCallback(() => {
    if (loadingMoreRef.current || !cursor || !trimmedQuery) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const seen = new Set(results.map((track) => track.videoId));
    const merged = [...results];
    let next: SearchNext | null = cursor;

    void (async () => {
      try {
        for (let page = 0; page < MAX_PAGES_PER_SCROLL && next; page += 1) {
          const result = await runSearch(trimmedQuery, currentSearchPreferences(settings), next);
          next = result.next;
          // Página vazia de verdade: a lista acabou. Sem esta parada, uma fonte
          // que devolve o mesmo token para sempre faria a rolagem girar à toa.
          if (result.tracks.length === 0) {
            next = null;
            break;
          }
          let added = 0;
          for (const track of result.tracks) {
            if (seen.has(track.videoId)) continue;
            seen.add(track.videoId);
            merged.push(track);
            added += 1;
          }
          // Anexou algo: a próxima página fica para a próxima rolagem.
          if (added > 0) break;
        }
      } catch {
        // Sem rede no meio da lista: a lista atual continua válida, e o cursor
        // fica onde estava para a próxima tentativa.
        next = cursor;
      }

      loadingMoreRef.current = false;
      setLoadingMore(false);
      // Se a consulta mudou enquanto a página vinha, o resultado não vale mais:
      // o `key` diferente descarta a página em vez de misturá-la a outra busca.
      setOutcome((current) =>
        current && current.key === requestKey
          ? { key: requestKey, tracks: merged, next }
          : current,
      );
    })();
  }, [cursor, trimmedQuery, results, settings, requestKey]);

  // Sentinela no fim da lista: é o que transforma "rolar até o fim" em
  // carregamento, sem botão e sem o usuário pensar em limite.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !cursor) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, loadMore]);

  const submit = () => {
    const trimmed = term.trim();
    setParams(trimmed ? { q: trimmed } : {});
  };

  const favoriteIds = useMemo(() => favorites.map((track) => track.videoId), [favorites]);
  const sourceHost = source ? safeHost(source) : null;

  return (
    <div className="page stack gap-6">
      <div className="page-head">
        <div>
          <div className="page-kicker">Pesquisa</div>
          <h1>Buscar</h1>
          <p className="muted">
            Escreva o nome da música, do artista ou use os prefixos:{" "}
            <span className="mono">artist:</span>, <span className="mono">album:</span>,{" "}
            <span className="mono">@</span> e <span className="mono">#</span>. A lista continua
            carregando sozinha conforme você rola.
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
        </div>
        <p className="xsmall faint" style={{ marginTop: 8 }}>
          Os resultados já vêm em ordem de relevância e a lista cresce ao rolar. O teto por canal e
          o tamanho de cada lote ficam em <span className="mono">Configurações · Busca</span>.
          {sourceHost ? (
            <>
              {" "}
              Última resposta de <span className="mono">{sourceHost}</span>
              {attempts.length > 0 ? ` · ${attempts.length} instância(s) falharam antes` : ""}.
            </>
          ) : null}
        </p>
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
          <Loader2 size={16} className="cider-spin" /> Buscando…
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
            {results.map((track, index) => (
              <YoutubeRow
                key={track.videoId}
                track={track}
                current={track.videoId === state.track?.videoId}
                playing={state.phase === "playing"}
                favorite={favoriteIds.includes(track.videoId)}
                onPlay={() => playFrom(engine, results, index)}
                onPlayAfter={() => playAfter(engine, [track])}
                onAddToQueue={() => engine.appendQueue([track])}
                onToggleFavorite={() => toggleFavoriteWithToast(track)}
              />
            ))}
          </div>

          <div className="search-tail" ref={sentinelRef}>
            {loadingMore ? (
              <span className="inline muted small">
                <Loader2 size={14} className="cider-spin" /> Carregando mais…
              </span>
            ) : cursor ? (
              <span className="xsmall faint">Role para carregar mais</span>
            ) : (
              <span className="xsmall faint">Fim dos resultados.</span>
            )}
          </div>
        </section>
      ) : null}

      {!loading && query && !error && results.length === 0 && ran ? (
        <EmptyState
          icon={<Search size={22} />}
          title="Nada encontrado"
          message={`A busca por “${query}” não devolveu resultados utilizáveis. Vale tentar outro termo, ou o título exato da música.`}
        />
      ) : null}

      {!query ? (
        <EmptyState
          icon={<Search size={22} />}
          title="Digite para buscar"
          message="Os resultados aparecem aqui conforme você digita, e a lista continua sozinha enquanto você rola."
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
