import { safeFetchJson } from "./safeFetch";

/**
 * Providers de embed — somente meios OFICIAIS:
 * oEmbed público, APIs públicas documentadas e players autorizados.
 * Nenhum scraping de HTML protegido.
 */

export type EmbedProviderName =
  | "tiktok"
  | "youtube"
  | "twitch"
  | "instagram"
  | "twitter"
  | "spotify"
  | "soundcloud"
  | "reddit"
  | "github"
  | "generic";

export type ResolvedEmbed = {
  provider: EmbedProviderName;
  type: "video" | "audio" | "image" | "article" | "social" | "code" | "unknown";
  title?: string;
  description?: string;
  authorName?: string;
  authorUrl?: string;
  providerName?: string;
  thumbnailUrl?: string;
  /** Player oficial (iframe) — só de domínios na allowlist do frontend. */
  playerUrl?: string;
  videoId?: string;
  /** Proporção vertical (TikTok/Reels/Shorts). */
  vertical?: boolean;
  /** Nota extra (ex.: #issue · estado no GitHub). */
  metadataNote?: string;
};

type OEmbed = {
  title?: string;
  author_name?: string;
  author_url?: string;
  thumbnail_url?: string;
  provider_name?: string;
  html?: string;
};

// ── Extração de IDs ───────────────────────────────────────────

export function extractYouTubeId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    return url.pathname.slice(1).split("/")[0] || null;
  }
  if (!host.endsWith("youtube.com")) return null;
  if (url.pathname === "/watch") return url.searchParams.get("v");
  const shorts = url.pathname.match(/^\/(shorts|live|embed)\/([A-Za-z0-9_-]{6,})/);
  return shorts?.[2] ?? null;
}

export function extractTikTokId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");
  if (host === "vm.tiktok.com" || host === "vt.tiktok.com") return null; // curto: resolvido via oEmbed
  const m = url.pathname.match(/\/video\/(\d+)/);
  return m?.[1] ?? null;
}

// ── Providers ─────────────────────────────────────────────────

export async function resolveYouTube(url: URL): Promise<ResolvedEmbed> {
  const videoId = extractYouTubeId(url);
  if (!videoId) throw new Error("URL do YouTube inválida.");
  let meta: OEmbed | null = null;
  try {
    meta = await safeFetchJson<OEmbed>(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`,
    );
  } catch {
    // Vídeo removido/privado → fallback com player mesmo assim (oEmbed falha
    // para não listados, mas o player nocookie costuma funcionar).
  }
  const isShorts = url.pathname.startsWith("/shorts/");
  return {
    provider: "youtube",
    type: "video",
    title: meta?.title,
    authorName: meta?.author_name,
    authorUrl: meta?.author_url ?? undefined,
    providerName: "YouTube",
    thumbnailUrl:
      meta?.thumbnail_url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    // (thumbnail_url pode ser null no oEmbed — fallback acima cobre)
    playerUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
    videoId: videoId ?? undefined,
    vertical: isShorts,
  };
}

export async function resolveTikTok(url: URL): Promise<ResolvedEmbed> {
  let meta: OEmbed | null = null;
  try {
    meta = await safeFetchJson<OEmbed>(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(url.toString())}`,
    );
  } catch {
    // segue com fallback
  }
  const videoId = extractTikTokId(url);
  const authorFromPath = url.pathname.match(/^\/@([\w.]+)/)?.[1];
  return {
    provider: "tiktok",
    type: "video",
    title: meta?.title,
    authorName: meta?.author_name ?? (authorFromPath ? `@${authorFromPath}` : undefined),
    authorUrl: meta?.author_url ?? undefined,
    providerName: "TikTok",
    thumbnailUrl: meta?.thumbnail_url ?? undefined,
    // Player oficial de embed do TikTok (iframe autorizado).
    playerUrl: videoId ? `https://www.tiktok.com/embed/v2/${videoId}` : undefined,
    videoId: videoId ?? undefined,
    vertical: true,
  };
}

export async function resolveSpotify(url: URL): Promise<ResolvedEmbed> {
  let meta: OEmbed | null = null;
  try {
    meta = await safeFetchJson<OEmbed>(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(url.toString())}`,
    );
  } catch {
    // fallback
  }
  return {
    provider: "spotify",
    type: "audio",
    title: meta?.title,
    thumbnailUrl: meta?.thumbnail_url ?? undefined,
    providerName: "Spotify",
    playerUrl: `https://open.spotify.com/embed${url.pathname}`,
  };
}

export async function resolveSoundCloud(url: URL): Promise<ResolvedEmbed> {
  const meta = await safeFetchJson<OEmbed>(
    `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url.toString())}`,
  );
  // O oEmbed retorna html com iframe do player oficial — extrai o src.
  const src = meta.html?.match(/src="(https:\/\/w\.soundcloud\.com\/player[^"]+)"/)?.[1];
  return {
    provider: "soundcloud",
    type: "audio",
    title: meta.title,
    authorName: meta.author_name,
    authorUrl: meta.author_url,
    thumbnailUrl: meta.thumbnail_url ?? undefined,
    providerName: "SoundCloud",
    playerUrl: src,
  };
}

export async function resolveTwitch(url: URL): Promise<ResolvedEmbed> {
  const host = url.hostname.replace(/^www\./, "");
  // O player oficial exige ?parent=<host> — o frontend injeta o host atual.
  if (host === "clips.twitch.tv") {
    const slug = url.pathname.split("/").filter(Boolean)[0];
    if (!slug) throw new Error("Clip inválido.");
    return {
      provider: "twitch",
      type: "video",
      providerName: "Twitch",
      title: `Clip de ${slug}`,
      playerUrl: `https://clips.twitch.tv/embed?clip=${slug}&parent=__HOST__`,
    };
  }
  const [, maybeSegment, channelOrVod, id] = url.pathname.split("/");
  if (maybeSegment === "videos" && id) {
    return {
      provider: "twitch",
      type: "video",
      providerName: "Twitch",
      title: `VOD ${id}`,
      playerUrl: `https://player.twitch.tv/?video=${id}&parent=__HOST__&autoplay=false`,
    };
  }
  const channel = maybeSegment ?? channelOrVod;
  if (!channel) throw new Error("Canal inválido.");
  return {
    provider: "twitch",
    type: "video",
    providerName: "Twitch",
    title: `🔴 ${channel} — ao vivo ou offline`,
    authorName: channel,
    playerUrl: `https://player.twitch.tv/?channel=${channel}&parent=__HOST__&autoplay=false`,
  };
}

export async function resolveReddit(url: URL): Promise<ResolvedEmbed> {
  // API pública oficial: URL + .json
  const jsonUrl = `${url.toString().replace(/\/$/, "")}.json`;
  const data = await safeFetchJson<
    { data?: { children?: { data?: Record<string, unknown> }[] } }[]
  >(jsonUrl);
  const post = data?.[0]?.data?.children?.[0]?.data;
  if (!post) throw new Error("Post não encontrado.");
  const title = typeof post.title === "string" ? post.title : undefined;
  const author = typeof post.author === "string" ? post.author : undefined;
  const subreddit = typeof post.subreddit === "string" ? post.subreddit : undefined;
  const thumbnail =
    typeof post.thumbnail === "string" && post.thumbnail.startsWith("http")
      ? post.thumbnail
      : undefined;
  const selftext =
    typeof post.selftext === "string" ? post.selftext.slice(0, 400) : undefined;
  const urlOver =
    typeof post.url_overridden_by_dest === "string"
      ? post.url_overridden_by_dest
      : undefined;
  const isVideo = post.is_video === true || /\.(mp4|gifv)$/i.test(urlOver ?? "");
  return {
    provider: "reddit",
    type: isVideo ? "video" : "social",
    title,
    description: selftext,
    authorName: author ? `u/${author}` : undefined,
    providerName: subreddit ? `r/${subreddit}` : "Reddit",
    thumbnailUrl: thumbnail,
  };
}

export async function resolveGitHub(url: URL): Promise<ResolvedEmbed> {
  // API pública oficial (sem auth): repos, issues, pulls, commits.
  const segments = url.pathname.replace(/\/$/, "").split("/").filter(Boolean);
  let apiPath: string;
  if (segments.length === 2) {
    apiPath = `/repos/${segments[0]}/${segments[1]}`;
  } else if (segments.length === 4 && ["issues", "pull"].includes(segments[2])) {
    apiPath = `/repos/${segments[0]}/${segments[1]}/${segments[2] === "pull" ? "pulls" : "issues"}/${segments[3]}`;
  } else if (segments.length === 5 && segments[2] === "commit") {
    apiPath = `/repos/${segments[0]}/${segments[1]}/commits/${segments[4]}`;
  } else {
    apiPath = `/${segments.join("/")}`;
  }
  const api = `https://api.github.com${apiPath}`;
  const data = await safeFetchJson<Record<string, unknown>>(api);
  const full_name = typeof data.full_name === "string" ? data.full_name : undefined;
  const description =
    typeof data.description === "string" ? data.description : undefined;
  const owner =
    typeof (data.owner as { login?: string })?.login === "string"
      ? (data.owner as { login: string }).login
      : undefined;
  const title = typeof data.title === "string" ? data.title : undefined;
  const state = typeof data.state === "string" ? data.state : undefined;
  const number = typeof data.number === "number" ? data.number : undefined;
  return {
    provider: "github",
    type: "code",
    title: title ?? full_name,
    description,
    authorName: owner ? `@${owner}` : undefined,
    providerName: "GitHub",
    thumbnailUrl: owner ? `https://github.com/${owner}.png` : undefined,
    metadataNote:
      number !== undefined && state
        ? `#${number} · ${state === "open" ? "Aberto" : "Fechado"}`
        : undefined,
  } as ResolvedEmbed;
}

export async function resolveTwitter(url: URL): Promise<ResolvedEmbed> {
  // oEmbed oficial do publish.twitter.com (público).
  const meta = await safeFetchJson<OEmbed>(
    `https://publish.twitter.com/oembed?url=${encodeURIComponent(url.toString())}`,
  );
  const author = meta.author_name;
  const handle = meta.author_url?.split("/").pop();
  // O html é um blockquote oficial — não renderizamos HTML; extraimos o texto.
  const text = meta.html
    ?.replace(/<blockquote[^>]*>/, "")
    .replace(/<\/blockquote>[\s\S]*$/, "")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .trim()
    .slice(0, 400);
  return {
    provider: "twitter",
    type: "social",
    title: author ? `${author}${handle ? ` (@${handle})` : ""}` : undefined,
    description: text,
    authorName: author,
    authorUrl: meta.author_url,
    providerName: "X / Twitter",
  };
}

export async function resolveInstagram(url: URL): Promise<ResolvedEmbed> {
  // Sem oEmbed público desde 2020 — tenta OG genérico; cai no fallback card.
  const { fetchOpenGraph } = await import("./openGraph");
  const og = await fetchOpenGraph(url.toString());
  return {
    provider: "instagram",
    type: "social",
    title: og.title,
    description: og.description,
    thumbnailUrl: og.image,
    providerName: "Instagram",
    authorName: url.pathname.match(/^\/([\w.]+)\//)?.[1]
      ? `@${url.pathname.match(/^\/([\w.]+)\//)![1]}`
      : undefined,
  };
}

export async function resolveGeneric(url: URL): Promise<ResolvedEmbed> {
  const { fetchOpenGraph } = await import("./openGraph");
  const og = await fetchOpenGraph(url.toString());
  return {
    provider: "generic",
    type: "article",
    title: og.title,
    description: og.description,
    thumbnailUrl: og.image,
    providerName: og.siteName ?? url.hostname,
  };
}
