import { useState } from "react";
import {
  BadgeCheck,
  Handshake,
  Loader2,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { AdminPartnerServerDTO } from "@contracts/types";
import { trpc } from "@/providers/trpc";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function PartnerServersPanel() {
  const utils = trpc.useUtils();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AdminPartnerServerDTO | null>(null);
  const authority = trpc.admin.authority.useQuery();
  const isOwner = authority.data?.authority === "owner";
  const debouncedQuery = useDebouncedValue(query);
  const search = trpc.admin.searchServers.useQuery(
    { query: debouncedQuery.trim() || undefined, limit: 12 },
    { enabled: debouncedQuery.trim().length > 0 }
  );
  const partners = trpc.admin.listPartnerServers.useQuery();
  const setPartnership = trpc.admin.setServerPartnership.useMutation({
    onSuccess: async result => {
      toast.success(
        result.server.partnered
          ? "Servidor marcado como parceiro."
          : "Parceria removida."
      );
      setSelected(current =>
        current?.id === result.server.id
          ? { ...current, partnered: result.server.partnered }
          : current
      );
      await Promise.all([
        utils.admin.searchServers.invalidate(),
        utils.admin.listPartnerServers.invalidate(),
        utils.server.get.invalidate({ serverId: result.server.id }),
        utils.server.list.invalidate(),
        utils.server.discover.invalidate(),
        utils.badge.mine.invalidate(),
        utils.badge.forUser.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });
  const setFeatured = trpc.admin.setServerFeatured.useMutation({
    onSuccess: async (_result, variables) => {
      toast.success("Destaque atualizado.");
      setSelected(current =>
        current?.id === variables.serverId
          ? { ...current, isFeatured: !current.isFeatured }
          : current
      );
      await Promise.all([
        utils.admin.searchServers.invalidate(),
        utils.admin.listPartnerServers.invalidate(),
        utils.server.discover.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });

  return (
    <section className="rounded-xl border border-white/[0.075] bg-[#22252b] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Handshake className="h-4 w-4 text-[#7383FF]" aria-hidden />
            Servidores parceiros
          </div>
          <p className="mt-1 text-[11px] leading-5 text-[#8e959f]">
            O status vem do servidor e pode ser removido sem afetar o código ou
            os dados da comunidade.
          </p>
        </div>
        <span className="text-[11px] text-[#8e959f]">
          {partners.data?.length ?? 0} parceiros
        </span>
      </div>

      <div className="relative mt-4">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#68707b]"
          aria-hidden
        />
        <Input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Buscar por nome, ID ou proprietário"
          className="h-10 border-white/[0.08] bg-[#17191e] pl-9 text-xs text-white placeholder:text-[#68707b]"
          aria-label="Buscar servidor para parceria"
        />
      </div>

      {search.isFetching && (
        <p className="mt-3 inline-flex items-center gap-2 text-[11px] text-[#9ca3ad]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Buscando servidores...
        </p>
      )}
      {search.data && search.data.length > 0 && (
        <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto">
          {search.data.map(server => (
            <li key={server.id}>
              <button
                type="button"
                onClick={() => setSelected(server)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-[#c8cdd5] transition-colors hover:bg-white/[0.05]"
              >
                <ServerAvatar server={server} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-white">
                    {server.name}
                  </span>
                  <span className="block text-[10px] text-[#7f8792]">
                    ID {server.id}
                  </span>
                </span>
                {server.partnered && (
                  <BadgeCheck
                    className="h-4 w-4 text-[#7383FF]"
                    aria-label="Parceiro"
                  />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {search.data &&
        search.data.length === 0 &&
        debouncedQuery.trim() &&
        !search.isFetching && (
           <p className="mt-3 text-[11px] text-[#8e959f]">
             {/^\d+$/.test(debouncedQuery.trim())
               ? "Servidor não encontrado."
               : "Nenhum servidor encontrado."}
           </p>

        )}

      {selected && (
        <div className="mt-4 rounded-lg border border-white/[0.08] bg-[#1a1c21] p-3">
          <div className="flex items-start gap-3">
            <ServerAvatar server={selected} large />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">
                {selected.name}
              </p>
              <p className="mt-1 text-[10px] text-[#858c96]">
                ID {selected.id}
              </p>
            </div>
            <button
              type="button"
              className="rounded-md p-1 text-[#7f8792] hover:bg-white/[0.06] hover:text-white"
              onClick={() => setSelected(null)}
              aria-label="Fechar servidor selecionado"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-md bg-white/[0.04] p-2.5">
              <dt className="text-[#858c96]">Proprietário</dt>
              <dd className="mt-1 truncate font-semibold text-white">
                {selected.ownerName ?? selected.ownerUsername ?? "—"}
              </dd>
            </div>
            <div className="rounded-md bg-white/[0.04] p-2.5">
              <dt className="text-[#858c96]">Membros</dt>
              <dd className="mt-1 font-semibold text-white">
                {selected.memberCount}
              </dd>
            </div>
            <div className="rounded-md bg-white/[0.04] p-2.5">
              <dt className="text-[#858c96]">Descoberta</dt>
              <dd className="mt-1 font-semibold text-white">
                {selected.publicDiscovery ? "Pública" : "Privada"}
              </dd>
            </div>
            <div className="rounded-md bg-white/[0.04] p-2.5">
              <dt className="text-[#858c96]">Status</dt>
              <dd className="mt-1 font-semibold text-white">
                {selected.partnered ? "Parceiro" : "Comum"}
              </dd>
            </div>
          </dl>
          {!isOwner && (
            <p className="mt-3 text-[10px] leading-4 text-amber-300/80">
              Somente o proprietário da plataforma pode alterar parceria ou
              destaque.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={!isOwner || setPartnership.isPending}
              onClick={() =>
                setPartnership.mutate({
                  serverId: selected.id,
                  partnered: !selected.partnered,
                })
              }
              className={
                selected.partnered
                  ? "border border-[#ed4245]/20 bg-[#ed4245]/10 text-[#ff9d9f] hover:bg-[#ed4245]/15"
                  : "bg-[#5865F2] text-white hover:bg-[#5664e6]"
              }
            >
              {selected.partnered ? "Remover parceria" : "Ativar parceria"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={
                !isOwner || !selected.publicDiscovery || setFeatured.isPending
              }
              onClick={() =>
                setFeatured.mutate({
                  serverId: selected.id,
                  featured: !selected.isFeatured,
                })
              }
              className="border-white/10 bg-transparent text-[#c8cdd5] hover:bg-white/[0.05] hover:text-white"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {selected.isFeatured
                ? "Remover destaque"
                : "Destacar no Explorar"}
            </Button>
          </div>
        </div>
      )}

      {!selected && partners.data && partners.data.length > 0 && (
        <div className="mt-4 border-t border-white/[0.06] pt-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#7f8792]">
            Parceiros atuais
          </p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {partners.data.map(server => (
              <li key={server.id}>
                <button
                  type="button"
                  onClick={() => setSelected(server)}
                  className="flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-white/[0.05]"
                >
                  <ServerAvatar server={server} />
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white">
                    {server.name}
                  </span>
                  <BadgeCheck
                    className="h-4 w-4 text-[#7383FF]"
                    aria-label="Parceiro"
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ServerAvatar({
  server,
  large = false,
}: {
  server: AdminPartnerServerDTO;
  large?: boolean;
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-lg bg-[#4654D8] text-[10px] font-bold text-white",
        large ? "size-12 rounded-xl text-sm" : "size-7"
      )}
    >
      {server.iconUrl ? (
        <img
          src={server.iconUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        server.name.slice(0, 2).toUpperCase()
      )}
    </span>
  );
}
