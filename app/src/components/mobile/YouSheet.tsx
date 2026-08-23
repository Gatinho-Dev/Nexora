import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Avatar } from "../Avatar";
import { useAppStore } from "@/store/useAppStore";
import { realtime } from "@/lib/ws";
import { cn } from "@/lib/utils";
import {
  Settings,
  LogOut,
  ShieldCheck,
  X,
  Pencil,
} from "lucide-react";
import type { UserStatus } from "@contracts/constants";

const STATUS: { id: UserStatus; label: string; dot: string }[] = [
  { id: "online", label: "Online", dot: "bg-online" },
  { id: "idle", label: "Ausente", dot: "bg-idle" },
  { id: "dnd", label: "Não perturbe", dot: "bg-dnd" },
  { id: "invisible", label: "Invisível", dot: "bg-offline" },
];

/**
 * "Você" bottom sheet: perfil rápido, troca de status e atalhos para
 * configurações reais (UserSettingsModal / Status da Conta).
 */
export function YouSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const safety = trpc.safety.me.useQuery(undefined, { enabled: open });
  const authority = trpc.admin.authority.useQuery(undefined, { enabled: open });
  const myBadges = trpc.badge.mine.useQuery(undefined, { enabled: open });
  const currentStatus = useAppStore(
    s => (user ? s.presence[user.id] : undefined)
  );
  const status = currentStatus ?? user?.status ?? "online";

  if (!open || !user) return null;

  const setStatus = (st: UserStatus) => {
    realtime.send({ t: "presence", status: st });
    useAppStore
      .getState()
      .setPresence(user.id, st === "invisible" ? "offline" : st);
  };

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-label="Você">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-white/10 bg-sidebar pb-[calc(env(safe-area-inset-bottom)+16px)] shadow-2xl animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="relative h-24 bg-hov">
          {user.banner ? (
            <img src={user.banner} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-r from-[#5865F2]/40 to-transparent" />
          )}
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="absolute right-3 top-3 rounded-full bg-black/50 p-1.5 text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="-mt-8 px-4">
          <div className="inline-block rounded-full border-4 border-sidebar bg-sidebar">
            <Avatar userId={user.id} name={user.name ?? user.username} src={user.avatar} size="lg" showStatus />
          </div>
          <p className="mt-1 text-lg font-bold">{user.name ?? user.username}</p>
          <p className="text-xs text-muted2">@{user.username}</p>
          {myBadges.data && myBadges.data.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {myBadges.data.slice(0, 6).map(b => (
                <span
                  key={b.id ?? b.slug}
                  title={b.description ?? b.label}
                  className="rounded-md border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{ color: b.color ?? undefined }}
                >
                  {b.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Status picker */}
        <div className="mt-4 grid grid-cols-4 gap-1 px-4">
          {STATUS.map(st => (
            <button
              key={st.id}
              onClick={() => setStatus(st.id)}
              aria-label={`Status ${st.label}`}
              className={cn(
                "flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-lg py-2 text-[10px] font-semibold transition-colors",
                status === st.id ? "bg-white/10 text-bodyx" : "text-muted2 hover:bg-white/5"
              )}
            >
              <span className={cn("h-2.5 w-2.5 rounded-full", st.dot)} />
              {st.label}
            </button>
          ))}
        </div>

        {/* Links */}
        <nav className="mt-4 space-y-1 px-4 pb-2">
          <SheetLink icon={<Settings className="h-5 w-5" />} label="Configurações" onClick={() => navigate("/channels/@me")} close={onClose} hint="Abrir painel completo" />
          <SheetLink
            icon={<ShieldCheck className="h-5 w-5" />}
            label={
              safety.data?.safety.accountStatus &&
              safety.data.safety.accountStatus !== "good_standing"
                ? "Status da conta · atenção"
                : "Status da conta"
            }
            dot={
              safety.data?.safety.accountStatus === "good_standing"
                ? "bg-online"
                : safety.data?.safety.accountStatus === "suspended" ||
                    safety.data?.safety.permanentBan
                  ? "bg-dnd"
                  : "bg-idle"
            }
            onClick={() => navigate("/channels/@me")}
            close={onClose}
            hint="Infrações e conformidade"
          />
          {authority.data?.canAccess && (
            <SheetLink
              icon={<ShieldCheck className="h-5 w-5" />}
              label="Painel Nexora"
              onClick={() => navigate("/nexora-admin")}
              close={onClose}
            />
          )}
          <button
            onClick={() => logout()}
            className="flex min-h-[48px] w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-red-400 hover:bg-red-500/10"
          >
            <LogOut className="h-5 w-5" /> Sair da Nexora
          </button>
        </nav>

        <p className="mt-2 hidden">
          <Pencil className="h-3 w-3" />
        </p>
      </div>
    </div>
  );

  function SheetLink({
    icon,
    label,
    onClick,
    close,
    hint,
    dot,
  }: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    close: () => void;
    hint?: string;
    dot?: string;
  }) {
    return (
      <button
        onClick={() => {
          onClick();
          close();
        }}
        className="flex min-h-[48px] w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-bodyx hover:bg-white/5"
      >
        <span className="text-muted2">{icon}</span>
        <span className="min-w-0 flex-1 truncate">
          {label}
          {hint && <span className="block text-[11px] font-normal text-faint">{hint}</span>}
        </span>
        {dot && <span className={cn("h-2.5 w-2.5 rounded-full", dot)} />}
      </button>
    );
  }
}
