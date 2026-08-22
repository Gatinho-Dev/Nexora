import { useEffect } from "react";
import { Avatar } from "./Avatar";
import { statusColor } from "@/lib/statusColor";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  UserPlus,
  Calendar,
  X,
  ShieldCheck,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";

export function ProfileCard({
  userId,
  onClose,
}: {
  userId: number | null;
  onClose: () => void;
}) {
  const { data: user } = trpc.account.getPublicUser.useQuery(
    { userId: userId! },
    { enabled: !!userId }
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!userId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-[#2B2D31] border border-white/10 shadow-2xl text-white animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Banner background */}
        <div className="h-28 w-full bg-[#5865F2] relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 rounded-full bg-black/40 p-1.5 text-white/80 hover:bg-black/60 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Profile Details Container */}
        <div className="px-5 pb-5 pt-0 relative">
          {/* Avatar floating overlapping banner */}
          <div className="-mt-12 mb-3 flex justify-between items-end">
            <div className="rounded-full border-4 border-[#2B2D31] bg-[#2B2D31] inline-block shadow-lg">
              <Avatar
                userId={user?.id ?? userId}
                name={user?.name ?? user?.username ?? "Nexora User"}
                src={user?.avatar}
                size="xl"
                showStatus
                statusOverride={user?.status ?? "online"}
              />
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/10 text-white/80 flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${statusColor(user?.status ?? "online")}`}
              />
              <span className="capitalize">{user?.status ?? "online"}</span>
            </span>
          </div>

          {/* User Display Name & Username */}
          <div className="mb-3">
            <h2 className="text-lg font-bold text-white tracking-wide">
              {user?.name ?? user?.username ?? "Carregando..."}
            </h2>
            <p className="text-xs font-medium text-[#B5BAC1]">
              @{user?.username ?? "username"}
            </p>
          </div>

          <div className="h-[1px] bg-white/10 my-3" />

          {/* Bio section */}
          <div className="mb-4">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#B5BAC1] mb-1">
              Sobre mim
            </h3>
            <p className="text-xs text-white/90 leading-relaxed">
              {user?.bio ||
                "Entusiasmado com a Nexora e tecnologia de comunicação em tempo real."}
            </p>
          </div>

          {/* Member info */}
          <div className="mb-4 flex items-center gap-2 text-xs text-[#B5BAC1]">
            <Calendar className="h-4 w-4 text-[#5865F2]" />
            <span>Membro da Nexora</span>
          </div>

          {/* Roles */}
          <div className="mb-5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#B5BAC1] mb-1.5 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-[#5865F2]" /> Cargos
            </h3>
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-[#5865F2]/20 text-[#5865F2] border border-[#5865F2]/30">
                Comunidade
              </span>
              <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-[#5865F2]/20 text-[#5865F2] border border-[#5865F2]/30">
                Membro
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              className="flex-1 bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium text-xs h-9 rounded-lg"
              onClick={() => {
                toast.success("Pedido de amizade enviado!");
              }}
            >
              <UserPlus className="h-4 w-4 mr-1.5" /> Adicionar amigo
            </Button>
            <Button
              variant="secondary"
              className="flex-1 bg-white/10 hover:bg-white/15 text-white font-medium text-xs h-9 rounded-lg"
              onClick={() => {
                toast.info("Iniciando conversa direta...");
                onClose();
              }}
            >
              <MessageSquare className="h-4 w-4 mr-1.5" /> Enviar mensagem
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
