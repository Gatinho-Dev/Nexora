/**
 * Explorar.
 *
 * O YouTube não publica "gêneros" nem "paradas" como um serviço de streaming —
 * a busca devolve vídeos por consulta. Então "Explorar" aqui é uma coleção de
 * **consultas reais**, agrupadas por tema (as mesmas do Cider 2 desktop). Cada
 * cartão roda uma busca de verdade: não há catálogo editorial escondido.
 */

import { useMemo } from "react";
import { useNavigate } from "react-router";
import { Play, Search, Sparkles } from "lucide-react";

import { useCider } from "../useCider";
import { useCiderLibrary } from "../library";
import { playFrom } from "../play";
import { Button, MediaCard, SectionHeader } from "../components/primitives";

interface Theme {
  id: string;
  title: string;
  description: string;
  queries: string[];
}

/** Temas = consultas reais. Portados do desktop, sem alteração de conteúdo. */
const THEMES: Theme[] = [
  {
    id: "hits",
    title: "Mais tocadas",
    description: "Buscas por listas e paradas publicadas",
    queries: ["músicas mais tocadas", "top hits playlist", "hits do momento"],
  },
  {
    id: "rock",
    title: "Rock",
    description: "Clássicos, alternativo e rock nacional",
    queries: ["rock clássico", "rock alternativo", "rock nacional"],
  },
  {
    id: "mpb",
    title: "MPB e bossa",
    description: "MPB, bossa nova e samba",
    queries: ["MPB essencial", "bossa nova", "samba de raiz"],
  },
  {
    id: "pop",
    title: "Pop",
    description: "Pop internacional e nacional",
    queries: ["pop internacional", "pop nacional", "pop anos 2000"],
  },
  {
    id: "electronic",
    title: "Eletrônica",
    description: "House, techno e eletrônica para treinar",
    queries: ["eletrônica para treinar", "house mix", "techno set"],
  },
  {
    id: "focus",
    title: "Foco e estudo",
    description: "Lo-fi, ambiente e trilhas instrumentais",
    queries: ["lo-fi para estudar", "música ambiente instrumental", "jazz com piano"],
  },
  {
    id: "soundtrack",
    title: "Trilhas sonoras",
    description: "Temas de filmes, séries e jogos",
    queries: ["trilhas de filmes famosas", "temas de séries", "música de jogos"],
  },
  {
    id: "brasil",
    title: "Brasil",
    description: "Forró, sertanejo, funk e pagode",
    queries: ["sertanejo clássico", "pagode anos 90", "forró pé de serra"],
  },
];

export function CiderBrowsePage() {
  const navigate = useNavigate();
  const { engine } = useCider();
  const history = useCiderLibrary((store) => store.history);
  const favorites = useCiderLibrary((store) => store.favorites);

  const localTracks = useMemo(() => {
    const seen = new Set<string>();
    const result = [];
    for (const track of [...favorites, ...history.map((entry) => entry.track)]) {
      if (seen.has(track.videoId)) continue;
      seen.add(track.videoId);
      result.push(track);
    }
    return result;
  }, [favorites, history]);

  /** Leva a consulta para a Pesquisa, onde a URL e o histórico ficam claros. */
  const runQuery = (query: string) => {
    navigate(`/cider/pesquisa?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="page stack gap-6">
      <div className="page-head">
        <div>
          <div className="page-kicker">Explorar</div>
          <h1>Descobrir por temas e paradas</h1>
          <p className="muted">
            Cada tema abaixo é um conjunto de consultas reais. Não há catálogo editorial escondido:
            o que aparece é o que a busca devolve, com o título original preservado.
          </p>
        </div>
        <div className="page-actions">
          <Button icon={<Sparkles size={16} />} onClick={() => navigate("/cider/radio")}>
            Rádio do Cider
          </Button>
        </div>
      </div>

      <section className="section">
        <SectionHeader
          title="Temas"
          action={<span className="xsmall faint">cada cartão roda uma busca real</span>}
        />
        <div className="grid-cards">
          {THEMES.map((theme) => (
            <MediaCard
              key={theme.id}
              title={theme.title}
              subtitle={theme.description}
              badge={<span className="badge">{theme.queries.length} consultas</span>}
              onOpen={() => runQuery(theme.queries[0] ?? theme.title)}
              onPlay={() => runQuery(theme.queries[0] ?? theme.title)}
            />
          ))}
        </div>
      </section>

      <section className="section">
        <SectionHeader title="Consultas de cada tema" />
        <div className="stack tight">
          {THEMES.map((theme) => (
            <div key={theme.id} className="browse-theme">
              <span className="browse-theme-title small semibold">{theme.title}</span>
              <div className="chip-row">
                {theme.queries.map((query) => (
                  <button key={query} type="button" className="chip" onClick={() => runQuery(query)}>
                    <Search size={14} />
                    {query}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <SectionHeader title="Do seu histórico e favoritos" />
        {localTracks.length > 0 ? (
          <>
            <div className="chip-row">
              {localTracks.slice(0, 14).map((track) => (
                <button
                  key={track.videoId}
                  type="button"
                  className="chip"
                  onClick={() => runQuery(`${track.artist} ${track.title}`.trim())}
                  title={`Buscar de novo: ${track.artist} — ${track.title}`}
                >
                  {track.title}
                </button>
              ))}
            </div>
            <div className="inline" style={{ marginTop: 10 }}>
              <Button
                size="sm"
                variant="ghost"
                icon={<Play size={15} />}
                onClick={() => playFrom(engine, localTracks, 0)}
              >
                Tocar esta mistura
              </Button>
              <span className="xsmall faint">
                tudo aqui é reproduzido pelo mesmo player, sem sair da tela
              </span>
            </div>
          </>
        ) : (
          <p className="small muted">
            Nada no histórico ainda. Depois de ouvir algumas faixas, elas aparecem aqui para você
            reencontrá-las rapidamente.
          </p>
        )}
      </section>
    </div>
  );
}
