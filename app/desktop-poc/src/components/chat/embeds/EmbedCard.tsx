import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Play, RefreshCcw, X } from "lucide-react";
import { trpc } from "@/providers/trpc";
import type { MessageEmbedDTO } from "@contracts/types";
import { cn } from "@/lib/utils";

/**
 * Card de embed de link com FACADE: mostra thumbnail + play; o player
 * oficial (iframe) só monta quando o usuário clica — economiza memória,
 * CPU e evita scripts de terceiros sem interação. Nunca autoplay com som.
 */

// Allowlist de domínios de player (iframe autorizado).
const TRUSTED_PLAYER_HOSTS = [
  "www.tiktok.com",
  "www.youtube-nocookie.com",
  "www.youtube.com",
  "player.twitch.tv",
  "clips.twitch.tv",
  "open.spotify.com",
  "w.soundcloud.com",
];

const PROVIDER_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  youtube: "YouTube",
  twitch: "Twitch",
  instagram: "Instagram",
  twitter: "X / Twitter",
  spotify: "Spotify",
  soundcloud: "SoundCloud",
  reddit: "Reddit",
  github: "GitHub",
  generic: "",
};

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function playerUrlFor(embed: MessageEmbedDTO): string | null {
  if (!embed.playerUrl) return null;
  try {
    const host = new URL(embed.playerUrl).hostname;
    if (!TRUSTED_PLAYER_HOSTS.includes(host)) return null;
    // Twitch exige parent = host atual.
    if (host.endsWith("twitch.tv")) {
      return embed.playerUrl.replace("__HOST__", window.location.hostname);
    }
    return embed.playerUrl;
  } catch {
    return null;
  }
}

function Skeleton() {
  return (
    <div
      className="mt-1 max-w-[544px] animate-pulse rounded-xl border border-white/10 bg-white/[0.03] p-3 select-none"
      role="status"
      aria-label="Carregando preview"
    >
      <div className="h-3 w-24 rounded bg-white/10" />
      <div className="mt-2 aspect-video max-h-64 w-full rounded-lg bg-white/[0.06]" />
      <div className="mt-2 h-3 w-3/4 rounded bg-white/10" />
      <div className="mt-1.5 h-3 w-1/2 rounded bg-white/[0.06]" />
    </div>
  );
}

export function EmbedCard({
  embed,
  canRemove,
  onRemove,
}: {
  embed: MessageEmbedDTO;
  canRemove?: boolean;
  onRemove?: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const removePreview = trpc.embed.remove.useMutation({
    onSuccess: () => {
      toast.success("Preview removido.");
      onRemove?.();
    },
    onError: e => toast.error(e.message),
  });
  const refresh = trpc.embed.refresh.useMutation({
    onSuccess: () => toast.success("Atualizando preview…"),
    onError: e => toast.error(e.message),
  });

  const label = PROVIDER_LABELS[embed.provider] ?? embed.providerName ?? "";
  const vertical = ["tiktok", "instagram"].includes(embed.provider);

  if (embed.status === "processing") return <Skeleton />;

  if (embed.status === "failed" || embed.status === "unsupported") {
    return (
      <div className="mt-1 flex max-w-[544px] items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5 text-xs text-muted2 select-none">
        <span className="min-w-0 flex-1 truncate">
          Não foi possível carregar o preview de {label || "deste link"}.
        </span>
        <a
          href={embed.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center gap-1 rounded-md bg-white/5 px-2 py-1 font-semibold text-bodyx hover:bg-white/10"
        >
          <ExternalLink className="h-3 w-3" /> Abrir
        </a>
      </div>
    );
  }

  const playerUrl = playerUrlFor(embed);
  const aspect = vertical ? "aspect-[9/16] max-h-[480px]" : "aspect-video";

  return (
    <div
      className="mt-1 max-w-[544px] overflow-hidden rounded-xl border border-white/10 bg-[#232529] select-none"
      role="article"
      aria-label={`Preview de ${label || embed.url}`}
    >
      {/* Header: provider + autor */}
      <div className="flex items-center gap-2 px-3 pt-2.5 text-[11px]">
        <img
          src={`https://www.google.com/s2/favicons?domain=${safeHost(embed.url)}&sz=32`}
          alt=""
          aria-hidden
          loading="lazy"
          className="h-4 w-4 rounded"
        />
        <span className="font-bold text-[#9da4ae]">
          {label || embed.providerName || "Link"}
        </span>
        {embed.authorName && (
          <span className="truncate text-muted2">{embed.authorName}</span>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          <button
            onClick={() => refresh.mutate({ messageId: embed.messageId })}
            title="Atualizar preview"
            aria-label="Atualizar preview"
            className="rounded p-1 text-muted2 transition-colors hover:bg-white/10 hover:text-white"
          >
            <RefreshCcw className={cn("h-3 w-3", refresh.isPending && "animate-spin")} />
          </button>
          {canRemove && (
            <button
              onClick={() => removePreview.mutate({ embedId: embed.id })}
              title="Remover preview"
              aria-label="Remover preview"
              className="rounded p-1 text-muted2 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Mídia: facade com thumbnail + play */}
      {playerUrl && !playing ? (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className={cn(
            "group relative mt-2 block w-full overflow-hidden bg-black",
            vertical ? "mx-auto max-w-[300px] rounded-xl" : "",
          )}
          aria-label={`Reproduzir vídeo de ${label || embed.providerName}`}
        >
          <div className={cn("relative w-full", vertical ? aspect : aspect)}>
            {embed.thumbnailUrl ? (
              <img
                src={embed.thumbnailUrl}
                alt=""
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
              />
            ) : (
              <div className="absolute inset-0 bg-[#111]" />
            )}
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-transform group-hover:scale-110">
                <Play className="ml-0.5 h-6 w-6" />
              </span>
            </span>
          </div>
        </button>
      ) : playerUrl && playing ? (
        <div
          className={cn(
            "relative mt-2 w-full overflow-hidden bg-black",
            vertical ? "mx-auto max-w-[300px] rounded-xl" : "",
          )}
        >
          <div className={cn("relative w-full", aspect)}>
            <iframe
              src={playerUrl}
              title={`Player de ${label || embed.providerName}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
              className="absolute inset-0 h-full w-full border-0"
            />
          </div>
        </div>
      ) : embed.thumbnailUrl ? (
        <a
          href={embed.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block"
        >
          <img
            src={embed.thumbnailUrl}
            alt={embed.title ?? "Prévia do link"}
            loading="lazy"
            className="max-h-72 w-full object-cover"
          />
        </a>
      ) : null}

      {/* Texto */}
      <div className="px-3 pb-3 pt-2">
        {embed.title && (
          <a
            href={embed.url}
            target="_blank"
            rel="noopener noreferrer"
            className="line-clamp-2 text-xs font-bold text-[#7383FF] hover:underline"
          >
            {embed.title}
          </a>
        )}
        {embed.description && (
          <p className="mt-1 line-clamp-3 text-[11px] leading-4 text-[#b7bdc6]">
            {embed.description}
          </p>
        )}
        <a
          href={embed.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-muted2 hover:text-bodyx"
        >
          {embed.url.replace(/^https?:\/\//, "").slice(0, 60)}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
