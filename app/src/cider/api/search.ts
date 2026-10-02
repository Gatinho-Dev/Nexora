/**
 * Busca de vídeo no navegador, direto nas instâncias Piped.
 *
 * No Cider 2 desktop isso rodava em Rust (`src-tauri/src/youtube/piped.rs`) e o
 * frontend só recebia JSON pelo IPC. No navegador não há IPC: a própria página
 * busca, e isso funciona porque **as instâncias respondem com
 * `access-control-allow-origin: *`** (verificado em `api.piped.private.coffee` e
 * `pipedapi.ducks.party` com o cabeçalho `Origin` de outro domínio).
 *
 * Consequência de não passar por um servidor nosso: a lista de instâncias é
 * pública e muda com frequência. Por isso o failover é sequencial e o erro que
 * sobe é honesto — diz o que aconteceu com cada uma, em vez de um genérico
 * "falhou".
 */

/** Instâncias públicas do Piped. Mudam com o tempo; o failover cobre a queda. */
const PIPED_INSTANCES = [
  "https://api.piped.private.coffee",
  "https://pipedapi.ducks.party",
] as const;

/** Invidious: mesmo dado, protocolo diferente. Serve de segunda opção. */
const INVIDIOUS_INSTANCES = ["https://invidious.flokinet.to"] as const;

const SEARCH_TIMEOUT_MS = 12_000;

/** Uma tentativa de busca, para o relatório de erro. */
export interface Attempt {
  instance: string;
  error: string;
}

/** Item cru do Piped/Invidious, já normalizado. */
export interface RawVideo {
  videoId: string;
  title: string;
  author: string;
  thumbnail: string;
  /** Segundos. */
  duration: number;
  url: string;
}

/**
 * Como pedir a **próxima página** da mesma busca.
 *
 * As duas fontes paginam de formas diferentes, e a diferença fica encapsulada
 * aqui: o Piped devolve um token opaco (que só serve para outra requisição na
 * mesma instância) e o Invidious um número de página. Quem exibe a lista só
 * precisa saber se há continuação ou não.
 */
export type SearchNext =
  | { protocol: "piped"; instance: string; token: string }
  | { protocol: "invidious"; instance: string; page: number };

/** Teto de páginas do Invidious: a lista cresce, mas não infinitamente. */
const INVIDIOUS_MAX_PAGE = 10;

export interface SearchOutcome {
  videos: RawVideo[];
  /** Instância que respondeu. */
  source: string | null;
  attempts: Attempt[];
  /** Continuação da lista. `null` aqui significa **fim**: não há mais nada. */
  next: SearchNext | null;
}

interface PipedItem {
  url?: string;
  title?: string;
  uploaderName?: string;
  thumbnail?: string;
  duration?: number;
}

interface PipedPayload {
  items?: PipedItem[];
  /** Token de continuação, no formato `{"url":…,"id":…}` (string JSON). */
  nextpage?: string | null;
}

function withTimeout(ms: number): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

/** Piped traz o id dentro da URL (`/watch?v=…`); o campo `id` também existe. */
function pipedVideoId(item: PipedItem): string {
  const direct = (item as { id?: string }).id;
  if (typeof direct === "string" && direct.length >= 11) return direct;
  const url = item.url ?? "";
  const marker = url.indexOf("v=");
  if (marker < 0) return "";
  return url.slice(marker + 2).split("&")[0];
}

function normalizePiped(payload: unknown): RawVideo[] {
  const items = (payload as PipedPayload | null)?.items;
  if (!Array.isArray(items)) return [];
  return items
    .map(item => {
      const videoId = pipedVideoId(item);
      const duration = Number(item.duration ?? 0);
      return {
        videoId,
        title: String(item.title ?? "").trim(),
        author: String(item.uploaderName ?? "").trim(),
        thumbnail: String(item.thumbnail ?? "").trim(),
        duration: Number.isFinite(duration) && duration > 0 ? duration : 0,
        url: `https://www.youtube.com/watch?v=${videoId}`,
      } satisfies RawVideo;
    })
    // Vídeo sem duração ou sem id não dá barra de progresso nem player.
    .filter(video => video.videoId.length >= 11 && video.duration > 0);
}

/**
 * Token de continuação do Piped, quando ele oferece um.
 *
 * O valor é o próprio campo `nextpage` da resposta — uma string JSON — enviado
 * de volta tal e qual em `/nextpage/search`. Sem ele, a lista acabou.
 */
function pipedNextToken(payload: unknown, instance: string): SearchNext | null {
  const token = (payload as PipedPayload | null)?.nextpage;
  if (typeof token !== "string" || token.length === 0) return null;
  return { protocol: "piped", instance, token };
}

interface InvidiousItem {
  videoId?: string;
  title?: string;
  author?: string;
  videoThumbnails?: Array<{ url?: string }>;
  lengthSeconds?: number;
}

function normalizeInvidious(payload: unknown): RawVideo[] {
  const items = (payload as unknown[] | null) as InvidiousItem[] | null;
  if (!Array.isArray(items)) return [];
  return items
    .map(item => {
      const videoId = String(item.videoId ?? "");
      const duration = Number(item.lengthSeconds ?? 0);
      return {
        videoId,
        title: String(item.title ?? "").trim(),
        author: String(item.author ?? "").trim(),
        thumbnail: item.videoThumbnails?.[1]?.url ?? item.videoThumbnails?.[0]?.url ?? "",
        duration: Number.isFinite(duration) && duration > 0 ? duration : 0,
        url: `https://www.youtube.com/watch?v=${videoId}`,
      } satisfies RawVideo;
    })
    .filter(video => video.videoId.length >= 11 && video.duration > 0);
}

/**
 * Busca em todas as instâncias, na ordem, até uma responder.
 *
 * O `AbortController` é compartilhado por todas: o tempo total da busca não é a
 * soma das instâncias, e sim o que o usuário está disposto a esperar. Uma
 * instância que estoura o orçamento global é abandonada, e as seguintes herdam
 * o mesmo orçamento — que é o comportamento honesto: se a primeira está
 * lenta, as outras também estarão.
 *
 * Com `next`, a função **não** refaz o failover: ela pede exatamente a página
 * indicada. A lista cresce por rolagem (uma página por vez), e não por busca
 * nova — é o que faz o carregamento progressivo continuar de onde parou.
 */
export async function searchVideos(
  query: string,
  limit = 25,
  next: SearchNext | null = null
): Promise<SearchOutcome> {
  const trimmed = query.trim();
  if (!trimmed) return { videos: [], source: null, attempts: [], next: null };
  if (next) return searchNextPage(trimmed, limit, next);

  const attempts: Attempt[] = [];
  const { signal, done } = withTimeout(SEARCH_TIMEOUT_MS);

  try {
    for (const instance of PIPED_INSTANCES) {
      if (signal.aborted) break;
      const url = `${instance}/search?q=${encodeURIComponent(trimmed)}&filter=videos`;
      try {
        const response = await fetch(url, {
          signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          attempts.push({ instance, error: `HTTP ${response.status}` });
          continue;
        }
        const payload = await response.json();
        const videos = normalizePiped(payload).slice(0, limit);
        if (videos.length === 0) {
          attempts.push({ instance, error: "resposta sem vídeos" });
          continue;
        }
        return { videos, source: instance, attempts, next: pipedNextToken(payload, instance) };
      } catch (error) {
        attempts.push({ instance, error: describeFetchError(error) });
      }
    }

    for (const instance of INVIDIOUS_INSTANCES) {
      if (signal.aborted) break;
      const url = `${instance}/api/v1/search?q=${encodeURIComponent(trimmed)}&type=video`;
      try {
        const response = await fetch(url, {
          signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          attempts.push({ instance, error: `HTTP ${response.status}` });
          continue;
        }
        const videos = normalizeInvidious(await response.json()).slice(0, limit);
        if (videos.length === 0) {
          attempts.push({ instance, error: "resposta sem vídeos" });
          continue;
        }
        return {
          videos,
          source: instance,
          attempts,
          next: { protocol: "invidious", instance, page: 2 },
        };
      } catch (error) {
        attempts.push({ instance, error: describeFetchError(error) });
      }
    }
  } finally {
    done();
  }

  return { videos: [], source: null, attempts, next: null };
}

/** Pede uma continuação já conhecida (token do Piped ou página do Invidious). */
async function searchNextPage(
  query: string,
  limit: number,
  next: SearchNext
): Promise<SearchOutcome> {
  const attempts: Attempt[] = [];
  const { signal, done } = withTimeout(SEARCH_TIMEOUT_MS);

  try {
    if (next.protocol === "piped") {
      const url =
        `${next.instance}/nextpage/search?q=${encodeURIComponent(query)}` +
        `&filter=videos&nextpage=${encodeURIComponent(next.token)}`;
      try {
        const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
        if (!response.ok) {
          attempts.push({ instance: next.instance, error: `HTTP ${response.status}` });
          return { videos: [], source: null, attempts, next: null };
        }
        const payload = await response.json();
        return {
          videos: normalizePiped(payload).slice(0, limit),
          source: next.instance,
          attempts,
          next: pipedNextToken(payload, next.instance),
        };
      } catch (error) {
        // A instância caiu no meio da lista: a continuação morre com ela, porque
        // o token só vale nessa instância. Fim honesto, não lista embaralhada.
        attempts.push({ instance: next.instance, error: describeFetchError(error) });
        return { videos: [], source: null, attempts, next: null };
      }
    }

    if (next.page > INVIDIOUS_MAX_PAGE) {
      return { videos: [], source: null, attempts, next: null };
    }

    const url =
      `${next.instance}/api/v1/search?q=${encodeURIComponent(query)}` +
      `&type=video&page=${next.page}`;
    try {
      const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
      if (!response.ok) {
        attempts.push({ instance: next.instance, error: `HTTP ${response.status}` });
        return { videos: [], source: null, attempts, next: null };
      }
      const videos = normalizeInvidious(await response.json()).slice(0, limit);
      return {
        videos,
        source: next.instance,
        attempts,
        next:
          videos.length > 0 && next.page < INVIDIOUS_MAX_PAGE
            ? { protocol: "invidious", instance: next.instance, page: next.page + 1 }
            : null,
      };
    } catch (error) {
      attempts.push({ instance: next.instance, error: describeFetchError(error) });
      return { videos: [], source: null, attempts, next: null };
    }
  } finally {
    done();
  }
}

function describeFetchError(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "tempo esgotado";
  }
  if (error instanceof TypeError) {
    // `fetch` só lança TypeError para falha de rede/CORS, nunca para HTTP.
    return "sem resposta (rede ou CORS)";
  }
  return error instanceof Error ? error.message : "erro desconhecido";
}

/** Mensagem de erro aggregate, honesta sobre cada instância. */
export function describeSearchFailure(attempts: Attempt[]): string {
  if (attempts.length === 0) {
    return "Nenhuma instância respondeu. Tente de novo em alguns minutos.";
  }
  const detail = attempts
    .map(attempt => `${hostOf(attempt.instance)}: ${attempt.error}`)
    .join(" · ");
  return `Nenhuma fonte respondeu agora (${detail}). As instâncias comunitárias caem com frequência — tente de novo em alguns minutos.`;
}

function hostOf(instance: string): string {
  try {
    return new URL(instance).host;
  } catch {
    return instance;
  }
}

/** Instâncias em uso, para o Diagnóstico mostrar o que está sendo consultado. */
export function searchInstances(): Array<{ url: string; protocol: "piped" | "invidious" }> {
  return [
    ...PIPED_INSTANCES.map((url) => ({ url, protocol: "piped" as const })),
    ...INVIDIOUS_INSTANCES.map((url) => ({ url, protocol: "invidious" as const })),
  ];
}

export const __testing = {
  normalizePiped,
  normalizeInvidious,
  pipedVideoId,
  pipedNextToken,
  PIPED_INSTANCES,
};
