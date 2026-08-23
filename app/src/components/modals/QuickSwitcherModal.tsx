import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { User, Search, Compass } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export function QuickSwitcherModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const { data: servers } = trpc.server.list.useQuery(undefined, {
    enabled: open,
  });
  const { data: dms } = trpc.dm.list.useQuery(undefined, { enabled: open });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange]);

  if (!open) return null;

  const filteredServers = (servers ?? []).filter(s =>
    s.name.toLowerCase().includes(query.toLowerCase())
  );

  const filteredDMs = (dms ?? []).filter(d => {
    const name = d.otherUser?.name ?? d.otherUser?.username ?? "";
    return name.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden bg-sidebar border border-white/10 text-white rounded-2xl shadow-2xl select-none">
        <DialogTitle className="sr-only">Quick Switcher Nexora</DialogTitle>
        <div className="p-3 border-b border-white/10 flex items-center gap-2 bg-chat">
          <Search className="h-4 w-4 text-[#5865F2] shrink-0" />
          <input
            autoFocus
            className="w-full bg-transparent outline-none text-sm text-white placeholder:text-muted2"
            placeholder="Para onde você quer ir na Nexora? (digite o nome da DM ou servidor)"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-2 text-xs">
          {/* DMs */}
          {filteredDMs.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[10px] font-bold uppercase text-muted2">
                MENSAGENS DIRETAS
              </div>
              {filteredDMs.slice(0, 5).map(d => (
                <button
                  key={d.id}
                  onClick={() => {
                    navigate(`/channels/@me/${d.id}`);
                    onOpenChange(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/10 text-left transition-colors"
                >
                  <User className="h-4 w-4 text-[#5865F2]" />
                  <span className="font-bold text-white">
                    {d.otherUser?.name ?? d.otherUser?.username ?? "Usuário"}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Servers */}
          {filteredServers.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[10px] font-bold uppercase text-muted2">
                COMUNIDADES
              </div>
              {filteredServers.slice(0, 5).map(s => (
                <button
                  key={s.id}
                  onClick={() => {
                    navigate(`/channels/${s.id}/first`);
                    onOpenChange(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/10 text-left transition-colors"
                >
                  <Compass className="h-4 w-4 text-amber-400" />
                  <span className="font-bold text-white">{s.name}</span>
                </button>
              ))}
            </div>
          )}

          {filteredDMs.length === 0 && filteredServers.length === 0 && (
            <div className="p-6 text-center text-muted2">
              Nenhum canal ou usuário encontrado com &quot;{query}&quot;.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
