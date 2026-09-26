import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/endpoints";

export type GifResult = { id: string; url: string; preview: string; desc: string };

const gifCache = new Map<string, { url: string; preview: string }[]>();
const MAX_CACHED_ENDPOINTS = 20;
const SEARCH_DEBOUNCE_MS = 250;

/**
 * Busca de GIFs no Klipy (o mesmo provedor do seletor do compositor).
 *
 * O hook só consulta enquanto `active` é verdadeiro — o seletor do chat abre
 * com o popover, o modal de avatar troca a tela inteira para a busca — e
 * reaproveita um cache por endpoint para não repetir a mesma requisição a cada
 * abertura.
 */
export function useGifSearch(active: boolean) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      const endpoint = query.trim()
        ? apiUrl(`/api/gifs/search?q=${encodeURIComponent(query.trim())}`)
        : apiUrl("/api/gifs/trending");
      const cached = gifCache.get(endpoint);
      if (cached) {
        setGifs(
          cached.map((gif, index) => ({
            id: `cached-${index}-${gif.url}`,
            url: gif.url,
            preview: gif.preview,
            desc: "",
          })),
        );
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(endpoint, {
          credentials: "include",
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Falha ao carregar GIFs.");
        const results: GifResult[] = data.results ?? [];
        setGifs(results);
        gifCache.set(
          endpoint,
          results.map(gif => ({ url: gif.url, preview: gif.preview })),
        );
        if (gifCache.size > MAX_CACHED_ENDPOINTS) {
          const oldest = gifCache.keys().next().value;
          if (oldest !== undefined) gifCache.delete(oldest);
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setError(error instanceof Error ? error.message : "Falha ao carregar GIFs.");
      } finally {
        setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [active, query]);

  return { query, setQuery, gifs, loading, error };
}
