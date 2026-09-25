import { useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  MessageCircle,
  Sparkles,
  Users,
} from "lucide-react";
import { Link } from "react-router";
import type { ServerDiscoveryDTO } from "@contracts/types";
import { Button } from "@/components/ui/button";
import { PartnerBadge } from "@/components/server/PartnerBadge";
import { cn } from "@/lib/utils";

function formatCount(value: number): string {
  return new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(value);
}

export function CommunityCard({
  server,
  onOpen,
  className,
}: {
  server: ServerDiscoveryDTO;
  onOpen: (server: ServerDiscoveryDTO) => void;
  className?: string;
}) {
  const [bannerFailed, setBannerFailed] = useState(false);
  const [iconFailed, setIconFailed] = useState(false);
  const hasBanner = Boolean(server.bannerUrl) && !bannerFailed;

  return (
    <article
      className={cn(
        "group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-xl",
        className
      )}
    >
      <div className="relative h-32 bg-gradient-to-br from-primary/35 via-card to-sidebar">
        <div className="absolute inset-0 overflow-hidden">
          {hasBanner ? (
            <img
              src={server.bannerUrl!}
              alt={`Banner de ${server.name}`}
              loading="lazy"
              decoding="async"
              onError={() => setBannerFailed(true)}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="absolute inset-0 opacity-60" aria-hidden>
              <div className="absolute -right-10 -top-16 size-40 rounded-full bg-primary/25 blur-3xl" />
              <div className="absolute -bottom-20 -left-8 size-36 rounded-full bg-primary/15 blur-3xl" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/10 to-transparent" />
        </div>
        <div className="absolute bottom-[-28px] left-4 z-10 flex size-14 items-center justify-center overflow-hidden rounded-2xl border-4 border-card bg-sidebar text-sm font-bold text-foreground shadow-lg">
          {server.iconUrl && !iconFailed ? (
            <img
              src={server.iconUrl}
              alt={`Ícone de ${server.name}`}
              loading="lazy"
              decoding="async"
              onError={() => setIconFailed(true)}
              className="h-full w-full object-contain p-1"
            />
          ) : (
            server.name.slice(0, 2).toUpperCase()
          )}
        </div>
        {server.isFeatured && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/35 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-md">
            <Sparkles size={12} aria-hidden /> Destaque
          </span>
        )}
      </div>

      <div className="flex min-h-[190px] flex-col p-4 pt-10">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <h3 className="truncate text-base font-bold tracking-[-0.02em] text-foreground">
                {server.name}
              </h3>
              {server.partnered && <PartnerBadge className="size-4 shrink-0" />}
            </div>
            {server.category && (
              <p className="mt-1 text-xs font-semibold text-primary">
                {server.category.name}
              </p>
            )}
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Ver detalhes de ${server.name}`}
            onClick={() => onOpen(server)}
          >
            <ArrowUpRight size={17} aria-hidden />
          </button>
        </div>

        <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
          {server.description ||
            "Uma comunidade para conversar e compartilhar interesses."}
        </p>

        {server.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {server.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="rounded-md bg-accent px-2 py-1 text-[11px] font-medium text-muted-foreground"
              >
                {tag}
              </span>
            ))}
            {server.tags.length > 3 && (
              <span className="px-1 py-1 text-[11px] text-muted-foreground">
                +{server.tags.length - 3}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto flex items-center gap-3 border-t border-border/70 pt-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5" title="Membros">
            <Users size={14} aria-hidden />
            {formatCount(server.memberCount)} membros
          </span>
          {server.activeMemberCount7d > 0 ? (
            <span
              className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"
              title="Pessoas que enviaram mensagens nos últimos 7 dias"
            >
              <span
                className="size-1.5 rounded-full bg-emerald-500"
                aria-hidden
              />
              {formatCount(server.activeMemberCount7d)} ativos
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1.5"
              title="Mensagens publicadas"
            >
              <MessageCircle size={14} aria-hidden />
              {formatCount(server.messageCount)} mensagens
            </span>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <CalendarDays size={13} aria-hidden />
            Criada em{" "}
            {new Intl.DateTimeFormat("pt-BR", {
              month: "short",
              year: "numeric",
            }).format(new Date(server.createdAt))}
          </span>
          {server.isMember ? (
            <Button asChild size="sm" className="h-9">
              <Link to={`/channels/${server.id}/first`}>Abrir servidor</Link>
            </Button>
          ) : (
            <Button size="sm" className="h-9" onClick={() => onOpen(server)}>
              Entrar
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
