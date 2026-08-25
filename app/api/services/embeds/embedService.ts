import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../../queries/connection";
import * as schema from "@db/schema";
import { broadcastToChannel, sendToUsers } from "../../realtime";
import {
  resolveGeneric,
  resolveGitHub,
  resolveInstagram,
  resolveReddit,
  resolveSoundCloud,
  resolveSpotify,
  resolveTikTok,
  resolveTwitch,
  resolveTwitter,
  resolveYouTube,
  type EmbedProviderName,
  type ResolvedEmbed,
} from "./providers";
import { buildMessageDTO } from "../../messageRouter";

/** Limite de embeds por mensagem (env). */
export const MAX_EMBEDS_PER_MESSAGE = Number(
  process.env.MAX_EMBEDS_PER_MESSAGE ?? 3,
);

/** TTL do cache por provider (horas). */
const CACHE_TTL_HOURS: Record<EmbedProviderName, number> = {
  tiktok: 6,
  youtube: 12,
  twitch: 1,
  instagram: 6,
  twitter: 3,
  spotify: 24,
  soundcloud: 12,
  reddit: 3,
  github: 24,
  generic: 1,
};

/** Extrai URLs http(s) do texto (fora de spoilers). */
export function extractUrls(content: string): string[] {
  const withoutSpoilers = content.replace(/\|\|[\s\S]*?\|\|/g, "");
  const matches = withoutSpoilers.matchAll(
    /https?:\/\/[^\s<>"')\]]+/g,
  );
  const urls: string[] = [];
  for (const m of matches) {
    const cleaned = m[0].replace(/[.,;:!]+$/, "");
    if (!urls.includes(cleaned)) urls.push(cleaned);
    if (urls.length >= MAX_EMBEDS_PER_MESSAGE) break;
  }
  return urls;
}

export function providerFor(url: URL): EmbedProviderName | null {
  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be" || host.endsWith("youtube.com")) return "youtube";
  if (host.endsWith("tiktok.com")) return "tiktok";
  if (host.endsWith("twitch.tv")) return "twitch";
  if (host === "open.spotify.com" || host.endsWith("spotify.com")) return "spotify";
  if (host.endsWith("soundcloud.com") || host === "snd.sc") return "soundcloud";
  if (host.endsWith("instagram.com")) return "instagram";
  if (host === "twitter.com" || host === "x.com" || host.endsWith(".twitter.com"))
    return "twitter";
  if (host.endsWith("reddit.com") || host === "redd.it") return "reddit";
  if (host === "github.com" || host === "gist.github.com") return "github";
  return "generic";
}

/** Normaliza URL para cache (remove utm_*, fbclid etc.). */
export function normalizeUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const drop = [...url.searchParams.keys()].filter(
      k => k.startsWith("utm_") || k === "fbclid" || k === "gclid" || k === "si",
    );
    drop.forEach(k => url.searchParams.delete(k));
    url.hash = "";
    return url.toString();
  } catch {
    return raw;
  }
}

type Resolver = (url: URL) => Promise<ResolvedEmbed>;
const RESOLVERS: Partial<Record<EmbedProviderName, Resolver>> = {
  youtube: resolveYouTube,
  tiktok: resolveTikTok,
  spotify: resolveSpotify,
  soundcloud: resolveSoundCloud,
  twitch: resolveTwitch,
  reddit: resolveReddit,
  github: resolveGitHub,
  twitter: resolveTwitter,
  instagram: resolveInstagram,
  generic: resolveGeneric,
};

/**
 * Cria linhas processing para as URLs de uma mensagem (fire-and-forget
 * depois do envio — nunca bloqueia).
 */
export async function enqueueEmbedsForMessage(
  messageId: number,
  content: string,
  channelId: number | null,
  conversationId: number | null,
): Promise<void> {
  const urls = extractUrls(content);
  if (urls.length === 0) return;
  const db = getDb();
  const rows = await db
    .insert(schema.messageEmbeds)
    .values(
      urls.map((url, position) => ({
        messageId,
        url: normalizeUrl(url),
        provider: providerFor(new URL(url)) ?? "generic",
        position,
        status: "processing" as const,
      })),
    )
    .catch(() => null);
  if (!rows) return;

  // Processa em background e publica a mensagem atualizada quando pronto.
  void (async () => {
    for (const url of urls) {
      await processEmbed(messageId, normalizeUrl(url)).catch(() => {});
    }
    try {
      const dto = await buildMessageDTO(
        (await getDb().query.messages.findFirst({
          where: eq(schema.messages.id, messageId),
        }))!,
      );
      if (channelId) {
        broadcastToChannel(channelId, { t: "message:update", message: dto });
      } else if (conversationId) {
        const members = await getDb()
          .select({ userId: schema.conversationMembers.userId })
          .from(schema.conversationMembers)
          .where(
            eq(
              schema.conversationMembers.conversationId,
              conversationId,
            ),
          );
        sendToUsers(
          members.map(m => m.userId),
          { t: "message:update", message: dto },
        );
      }
    } catch {
      // mensagem pode ter sido apagada durante o processamento
    }
  })();
}

/** Resolve uma URL (com cache no banco por TTL) e atualiza a linha. */
export async function processEmbed(
  messageId: number,
  normalizedUrl: string,
): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.messageEmbeds)
    .where(
      and(
        eq(schema.messageEmbeds.messageId, messageId),
        eq(schema.messageEmbeds.url, normalizedUrl),
      ),
    )
    .limit(1);
  if (!row || row.status !== "processing") return;

  // Cache global: outra mensagem já buscou essa URL recentemente?
  const ttl = CACHE_TTL_HOURS[(row.provider as EmbedProviderName) ?? "generic"] ?? 1;
  const cacheCutoff = new Date(Date.now() - ttl * 3_600_000);
  const [recent] = await db
    .select()
    .from(schema.messageEmbeds)
    .where(
      and(
        eq(schema.messageEmbeds.url, normalizedUrl),
        eq(schema.messageEmbeds.status, "ready"),
      ),
    )
    .limit(1);
  if (
    recent &&
    recent.fetchedAt &&
    recent.fetchedAt > cacheCutoff &&
    recent.id !== row.id
  ) {
    // Deduplicação: reutiliza metadata recente da mesma URL.
    await db
      .update(schema.messageEmbeds)
      .set({
        provider: recent.provider,
        type: recent.type,
        title: recent.title,
        description: recent.description,
        authorName: recent.authorName,
        authorUrl: recent.authorUrl,
        providerName: recent.providerName,
        thumbnailUrl: recent.thumbnailUrl,
        playerUrl: recent.playerUrl,
        videoId: recent.videoId,
        status: "ready",
        fetchedAt: new Date(),
      })
      .where(eq(schema.messageEmbeds.id, row.id));
    return;
  }

  let resolved: ResolvedEmbed | null = null;
  try {
    const url = new URL(normalizedUrl);
    const provider = (row.provider as EmbedProviderName) ?? "generic";
    const resolver = RESOLVERS[provider] ?? resolveGeneric;
    resolved = await resolver(url);
  } catch {
    await db
      .update(schema.messageEmbeds)
      .set({ status: "failed", fetchedAt: new Date() })
      .where(eq(schema.messageEmbeds.id, row.id));
    return;
  }

  await db
    .update(schema.messageEmbeds)
    .set({
      provider: resolved.provider,
      type: resolved.type,
      title: resolved.title?.slice(0, 290) ?? null,
      description: resolved.description?.slice(0, 590) ?? null,
      authorName: resolved.authorName?.slice(0, 110) ?? null,
      authorUrl: resolved.authorUrl ?? null,
      providerName: resolved.providerName?.slice(0, 70) ?? null,
      thumbnailUrl: resolved.thumbnailUrl ?? null,
      playerUrl: resolved.playerUrl ?? null,
      videoId: resolved.videoId ?? null,
      status: "ready",
      fetchedAt: new Date(),
    })
    .where(eq(schema.messageEmbeds.id, row.id));
}

/** Anexa embeds (ordenados) a uma lista de mensagens. */
export async function attachEmbeds<
  T extends { id: number; embeds?: unknown },
>(messages: T[]): Promise<T[]> {
  const ids = messages.map(m => m.id);
  if (ids.length === 0) return messages;
  const rows = await getDb()
    .select()
    .from(schema.messageEmbeds)
    .where(inArray(schema.messageEmbeds.messageId, ids));
  if (rows.length === 0) return messages;
  const byMessage = new Map<number, typeof rows>();
  for (const row of rows) {
    const list = byMessage.get(row.messageId) ?? [];
    list.push(row);
    byMessage.set(row.messageId, list);
  }
  for (const message of messages) {
    const list = byMessage
      .get(message.id)
      ?.sort((a, b) => a.position - b.position);
    if (list && list.length > 0) {
      (message as { embeds?: unknown }).embeds = list;
    }
  }
  return messages;
}

/** Autor/moderador remove o preview (a URL continua na mensagem). */
export async function removeEmbed(
  embedId: number,
  requesterId: number,
  canManage: boolean,
): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.messageEmbeds)
    .where(eq(schema.messageEmbeds.id, embedId))
    .limit(1);
  if (!row) return false;
  if (!canManage) {
    const [message] = await db
      .select({ authorId: schema.messages.authorId })
      .from(schema.messages)
      .where(eq(schema.messages.id, row.messageId))
      .limit(1);
    if (!message || message.authorId !== requesterId) return false;
  }
  await db
    .delete(schema.messageEmbeds)
    .where(eq(schema.messageEmbeds.id, embedId));
  return true;
}
