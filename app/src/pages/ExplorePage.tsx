import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import {
  AlertCircle,
  ChevronDown,
  Compass,
  Filter,
  Link2,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import type { ServerDiscoveryDTO } from "@contracts/types";
import { trpc } from "@/providers/trpc";
import { Seo } from "@/lib/seo";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CommunityCard } from "@/components/explore/CommunityCard";
import { CommunityDetailsDialog } from "@/components/explore/CommunityDetailsDialog";
import { CommunityGridSkeleton } from "@/components/explore/CommunityCardSkeleton";
import { JoinServerModal } from "@/components/modals/JoinServerModal";

const SORT_OPTIONS = [
  { value: "recommended", label: "Recomendados" },
  { value: "popular", label: "Mais populares" },
  { value: "active", label: "Mais ativos" },
  { value: "recent", label: "Mais recentes" },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]["value"];

function hasFilters(
  query: string,
  categoryId: number | null,
  tag: string
): boolean {
  return Boolean(query.trim() || categoryId || tag.trim());
}

export default function ExplorePage() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [tag, setTag] = useState(searchParams.get("tag") ?? "");
  const [categoryId, setCategoryId] = useState<number | null>(() => {
    const value = searchParams.get("category");
    if (!value) return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  });
  const [sort, setSort] = useState<SortValue>("recommended");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedServerId, setSelectedServerId] = useState<number | null>(null);
  const debouncedQuery = useDebouncedValue(query);
  const debouncedTag = useDebouncedValue(tag);
  const filtersActive =
    hasFilters(debouncedQuery, categoryId, debouncedTag) ||
    sort !== "recommended";
  const categories = trpc.server.discoveryCategories.useQuery();
  const featured = trpc.server.discover.useQuery(
    { featuredOnly: true, sort: "recommended", limit: 8 },
    { enabled: !filtersActive }
  );
  const popular = trpc.server.discover.useQuery(
    { sort: "popular", limit: 8 },
    { enabled: !filtersActive }
  );
  const recent = trpc.server.discover.useQuery(
    { sort: "recent", limit: 8 },
    { enabled: !filtersActive }
  );
  const results = trpc.server.discover.useInfiniteQuery(
    {
      query: debouncedQuery.trim() || undefined,
      categoryId: categoryId ?? undefined,
      tag: debouncedTag.trim() || undefined,
      sort,
      limit: 12,
    },
    {
      enabled: filtersActive,
      getNextPageParam: page => page.nextCursor ?? undefined,
    }
  );
  const resultItems = useMemo(
    () => results.data?.pages.flatMap(page => page.items) ?? [],
    [results.data?.pages]
  );
  const selectedServer = useMemo(() => {
    if (selectedServerId === null) return null;
    return [
      ...(featured.data?.items ?? []),
      ...(popular.data?.items ?? []),
      ...(recent.data?.items ?? []),
      ...resultItems,
    ].find(server => server.id === selectedServerId) ?? null;
  }, [featured.data?.items, popular.data?.items, recent.data?.items, resultItems, selectedServerId]);

  const updateCategory = (value: number | null) => {
    setCategoryId(value);
    const next = new URLSearchParams(searchParams);
    if (value) next.set("category", String(value));
    else next.delete("category");
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${next}`
    );
  };

  const clearFilters = () => {
    setQuery("");
    setTag("");
    setCategoryId(null);
    setSort("recommended");
    window.history.replaceState(null, "", window.location.pathname);
  };

  const openServer = (server: ServerDiscoveryDTO) => setSelectedServerId(server.id);
  const retryExplore = () => {
    void featured.refetch();
    void popular.refetch();
    void recent.refetch();
  };
  const sectionError = featured.error ?? popular.error ?? recent.error;
  const anyLoading =
    featured.isPending || popular.isPending || recent.isPending;
  const hasAnyContent =
    Boolean(featured.data?.items.length) ||
    Boolean(popular.data?.items.length) ||
    Boolean(recent.data?.items.length);

  return (
    <>
      <Seo
        title="Explorar comunidades"
        description="Descubra comunidades públicas da Nexora para conversar, jogar, aprender e compartilhar seus interesses."
        canonicalPath="/explore"
        noindex
      />
      <main className="h-full overflow-y-auto bg-chat text-foreground">
        <div className="mx-auto w-full max-w-[1440px] px-4 pb-16 sm:px-6 lg:px-8">
          <header className="flex flex-col gap-6 border-b border-border/70 py-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <Compass size={16} aria-hidden />
                Descoberta da Nexora
              </div>
              <h1 className="mt-3 text-3xl font-bold tracking-[-0.055em] sm:text-4xl">
                Encontre sua comunidade
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
                Descubra comunidades para conversar, jogar, aprender e
                compartilhar seus interesses.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setInviteOpen(true)}
            >
              <Link2 size={16} aria-hidden />
              Entrar com convite
            </Button>
          </header>

          <section className="sticky top-0 z-20 -mx-4 border-b border-border/60 bg-chat/90 px-4 py-4 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Pesquisar comunidades..."
                aria-label="Pesquisar comunidades"
                className="h-12 rounded-xl border-border/80 bg-card pl-12 pr-11 text-base shadow-sm"
              />
              {query && (
                <button
                  type="button"
                  className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                  onClick={() => setQuery("")}
                  aria-label="Limpar pesquisa"
                >
                  <X size={16} aria-hidden />
                </button>
              )}
            </div>
            <div className="mt-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div
                className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1"
                 aria-label="Categorias"

              >
                <Filter
                  size={15}
                  className="shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <CategoryButton
                  active={categoryId === null}
                  onClick={() => updateCategory(null)}
                >
                  Todos
                </CategoryButton>
                {categories.data?.map(category => (
                  <CategoryButton
                    key={category.id}
                    active={categoryId === category.id}
                    onClick={() => updateCategory(category.id)}
                  >
                    {category.name}
                  </CategoryButton>
                ))}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={tag}
                  onChange={event => setTag(event.target.value)}
                  placeholder="Filtrar por tag"
                  aria-label="Filtrar por tag"
                  className="h-9 w-full rounded-lg bg-card text-xs sm:w-40"
                />
                <Select
                  value={sort}
                  onValueChange={value => setSort(value as SortValue)}
                >
                  <SelectTrigger
                    className="h-9 w-full bg-card text-xs sm:w-44"
                    aria-label="Ordenar comunidades"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {filtersActive ? (
            <section className="py-8" aria-labelledby="explore-results-title">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2
                    id="explore-results-title"
                    className="text-xl font-bold tracking-[-0.03em]"
                  >
                    Resultados da busca
                  </h2>
                  <p
                    className="mt-1 text-sm text-muted-foreground"
                    aria-live="polite"
                  >
                    {results.isFetching && !results.isFetchingNextPage
                      ? "Atualizando resultados..."
                      : `${resultItems.length} ${resultItems.length === 1 ? "comunidade" : "comunidades"}`}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Limpar filtros
                </Button>
              </div>
              {results.isPending ? (
                <CommunityGridSkeleton />
              ) : results.error ? (
                <ExploreError onRetry={() => void results.refetch()} />
              ) : resultItems.length === 0 ? (
                <EmptyResults onClear={clearFilters} />
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {resultItems.map(server => (
                      <CommunityCard
                        key={server.id}
                        server={server}
                        onOpen={openServer}
                      />
                    ))}
                  </div>
                  {results.hasNextPage && (
                    <div className="mt-6 flex justify-center">
                      <Button
                        variant="outline"
                        disabled={results.isFetchingNextPage}
                        onClick={() => void results.fetchNextPage()}
                      >
                        {results.isFetchingNextPage
                          ? "Carregando..."
                          : "Carregar mais comunidades"}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </section>
          ) : (
            <>
              {sectionError && (
                <ExploreError onRetry={retryExplore} />
              )}
              {anyLoading && !hasAnyContent ? (
                <div className="py-8">
                  <CommunityGridSkeleton count={9} />
                </div>
              ) : (
                <>
                  <ExploreSection
                    title="Comunidades em destaque"
                    description="Selecionadas pela equipe Nexora."
                    icon={<Sparkles size={17} aria-hidden />}
                    servers={featured.data?.items ?? []}
                    loading={featured.isPending}
                    onOpen={openServer}
                  />
                  <ExploreSection
                    title="Comunidades populares"
                    description="Ordenadas por membros e atividade real."
                    icon={<Users size={17} aria-hidden />}
                    servers={popular.data?.items ?? []}
                    loading={popular.isPending}
                    onOpen={openServer}
                  />
                  <ExploreSection
                    title="Novas comunidades"
                    description="As mais recentes que optaram por aparecer aqui."
                    icon={<ChevronDown size={17} aria-hidden />}
                    servers={recent.data?.items ?? []}
                    loading={recent.isPending}
                    onOpen={openServer}
                  />
                </>
              )}
            </>
          )}
        </div>
      </main>

      <CommunityDetailsDialog
        key={selectedServerId ?? "closed"}
        server={selectedServer}
        open={selectedServer !== null}
        onOpenChange={open => !open && setSelectedServerId(null)}
      />
      <JoinServerModal open={inviteOpen} onOpenChange={setInviteOpen} />
    </>
  );
}

function CategoryButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function ExploreSection({
  title,
  description,
  icon,
  servers,
  loading,
  onOpen,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  servers: ServerDiscoveryDTO[];
  loading: boolean;
  onOpen: (server: ServerDiscoveryDTO) => void;
}) {
  return (
    <section className="py-8" aria-labelledby={`section-${title}`}>
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h2
            id={`section-${title}`}
            className="flex items-center gap-2 text-xl font-bold tracking-[-0.03em]"
          >
            <span className="text-primary">{icon}</span>
            {title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {servers.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {servers.length} exibidas
          </span>
        )}
      </div>
      {loading ? (
        <CommunityGridSkeleton count={3} />
      ) : servers.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {servers.map(server => (
            <CommunityCard key={server.id} server={server} onOpen={onOpen} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Ainda não há comunidades nesta seleção.
        </div>
      )}
    </section>
  );
}

function EmptyResults({ onClear }: { onClear: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
      <Search className="mx-auto size-8 text-muted-foreground" aria-hidden />
      <h3 className="mt-4 text-lg font-bold">Nenhuma comunidade encontrada</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        Experimente pesquisar por outro nome, categoria ou interesse.
      </p>
      <Button className="mt-5" variant="outline" onClick={onClear}>
        Limpar filtros
      </Button>
    </div>
  );
}

function ExploreError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="mb-6 flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between"
      role="alert"
    >
      <span className="inline-flex items-center gap-2">
        <AlertCircle size={17} aria-hidden />
        Não foi possível carregar as comunidades agora.
      </span>
      <Button size="sm" variant="outline" onClick={onRetry}>
        Tentar novamente
      </Button>
    </div>
  );
}
