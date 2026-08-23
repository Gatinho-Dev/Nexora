import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiUrl } from "@/lib/endpoints";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type TenorGif = { id: string; url: string; preview: string; desc: string };

export function GifPicker({
  onPick,
  children,
}: {
  onPick: (gifUrl: string) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<TenorGif[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const endpoint = query.trim()
          ? apiUrl(`/api/gifs/search?q=${encodeURIComponent(query.trim())}`)
          : apiUrl("/api/gifs/trending");
        const res = await fetch(endpoint, {
          credentials: "include",
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Falha ao carregar GIFs.");
        setGifs(data.results ?? []);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Falha ao carregar GIFs.");
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-96 p-2" side="top" align="end">
        <div className="space-y-2">
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar GIFs no KLIPY..."
            className="h-9 bg-rail border-white/10 text-sm"
          />
          <div className="max-h-72 overflow-y-auto rounded-lg bg-rail p-1">
            {loading && gifs.length === 0 && (
              <div className="flex items-center justify-center py-10 text-muted2">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
            {!loading && error && (
              <p className="px-3 py-8 text-center text-xs text-muted2">{error}</p>
            )}
            {!loading && !error && gifs.length === 0 && (
              <p className="px-3 py-8 text-center text-xs text-muted2">
                {query ? "Nenhum GIF encontrado." : "Nenhum GIF em alta agora."}
              </p>
            )}
            <div className="grid grid-cols-3 gap-1">
              {gifs.map(g => (
                <button
                  key={g.id}
                  type="button"
                  className="overflow-hidden rounded-md hover:ring-2 ring-[#5865F2] transition-all"
                  title={g.desc}
                  onClick={() => {
                    if (!g.url) {
                      toast.error("GIF inválido.");
                      return;
                    }
                    onPick(g.url);
                    setOpen(false);
                  }}
                >
                  <img
                    src={g.preview || g.url}
                    alt={g.desc || "GIF"}
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
          <a href="https://klipy.com" target="_blank" rel="noopener noreferrer" className="block text-center text-[10px] text-muted-foreground hover:text-white transition-colors">Powered by KLIPY</a>
        </div>
      </PopoverContent>
    </Popover>
  );
}
