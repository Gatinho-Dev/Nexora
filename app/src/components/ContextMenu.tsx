import { useEffect, useRef } from "react";
import {
  User,
  MessageSquare,
  Phone,
  UserPlus,
  VolumeX,
  ShieldAlert,
  UserMinus,
  Ban,
  Copy,
  CheckCheck,
  BellOff,
  Edit,
  Trash2,
  Link,
  Settings,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router";

export type ContextMenuState = {
  x: number;
  y: number;
  type: "user" | "channel" | "server";
  id: number;
  name?: string;
} | null;

export function ContextMenu({
  menuState,
  onClose,
  onOpenProfile,
}: {
  menuState: ContextMenuState;
  onClose: () => void;
  onOpenProfile?: (userId: number) => void;
}) {
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  if (!menuState) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
    onClose();
  };

  // Keep menu inside viewport boundaries
  const style = {
    top: Math.min(menuState.y, window.innerHeight - 320),
    left: Math.min(menuState.x, window.innerWidth - 220),
  };

  return (
    <div
      ref={menuRef}
      style={style}
      className="fixed z-50 w-52 rounded-xl bg-panel border border-white/10 p-1.5 shadow-2xl text-xs text-white select-none animate-in fade-in zoom-in-95 duration-100"
    >
      {menuState.type === "user" && (
        <>
          <MenuItem
            icon={<User className="h-4 w-4 text-[#5865F2]" />}
            label="Perfil"
            onClick={() => {
              onOpenProfile?.(menuState.id);
              onClose();
            }}
          />
          <MenuItem
            icon={<MessageSquare className="h-4 w-4 text-emerald-400" />}
            label="Mensagem"
            onClick={() => {
              navigate(`/channels/@me`);
              toast.info("Iniciando mensagem direta...");
              onClose();
            }}
          />
          <MenuItem
            icon={<Phone className="h-4 w-4 text-amber-400" />}
            label="Chamar"
            onClick={() => {
              toast.info("Iniciando chamada...");
              onClose();
            }}
          />
          <MenuItem
            icon={<UserPlus className="h-4 w-4 text-[#5865F2]" />}
            label="Adicionar amigo"
            onClick={() => {
              toast.success("Pedido de amizade enviado!");
              onClose();
            }}
          />
          <MenuDivider />
          <MenuItem
            icon={<VolumeX className="h-4 w-4 text-muted2" />}
            label="Silenciar"
            onClick={() => {
              toast.info("Usuário silenciado.");
              onClose();
            }}
          />
          <MenuItem
            icon={<ShieldAlert className="h-4 w-4 text-muted2" />}
            label="Bloquear"
            onClick={() => {
              toast.info("Usuário bloqueado.");
              onClose();
            }}
          />
          <MenuDivider />
          <MenuItem
            icon={<UserMinus className="h-4 w-4 text-red-400" />}
            label="Expulsar"
            danger
            onClick={() => {
              toast.warning("Ação de expulsão acionada.");
              onClose();
            }}
          />
          <MenuItem
            icon={<Ban className="h-4 w-4 text-red-500" />}
            label="Banir"
            danger
            onClick={() => {
              toast.error("Ação de banimento acionada.");
              onClose();
            }}
          />
          <MenuDivider />
          <MenuItem
            icon={<Copy className="h-4 w-4 text-muted2" />}
            label="Copiar ID"
            onClick={() =>
              copyToClipboard(String(menuState.id), "ID do usuário")
            }
          />
        </>
      )}

      {menuState.type === "channel" && (
        <>
          <MenuItem
            icon={<CheckCheck className="h-4 w-4 text-emerald-400" />}
            label="Marcar como lido"
            onClick={() => {
              toast.success("Canal marcado como lido!");
              onClose();
            }}
          />
          <MenuItem
            icon={<BellOff className="h-4 w-4 text-muted2" />}
            label="Silenciar canal"
            onClick={() => {
              toast.info("Canal silenciado.");
              onClose();
            }}
          />
          <MenuDivider />
          <MenuItem
            icon={<Edit className="h-4 w-4 text-[#5865F2]" />}
            label="Editar canal"
            onClick={() => {
              toast.info("Abrindo edição...");
              onClose();
            }}
          />
          <MenuItem
            icon={<Trash2 className="h-4 w-4 text-red-400" />}
            label="Excluir canal"
            danger
            onClick={() => {
              toast.error("Excluir canal acionado.");
              onClose();
            }}
          />
          <MenuDivider />
          <MenuItem
            icon={<Link className="h-4 w-4 text-muted2" />}
            label="Copiar link"
            onClick={() =>
              copyToClipboard(window.location.href, "Link do canal")
            }
          />
          <MenuItem
            icon={<Copy className="h-4 w-4 text-muted2" />}
            label="Copiar ID"
            onClick={() => copyToClipboard(String(menuState.id), "ID do canal")}
          />
        </>
      )}

      {menuState.type === "server" && (
        <>
          <MenuItem
            icon={<CheckCheck className="h-4 w-4 text-emerald-400" />}
            label="Marcar como lido"
            onClick={() => {
              toast.success("Servidor marcado como lido!");
              onClose();
            }}
          />
          <MenuItem
            icon={<UserPlus className="h-4 w-4 text-[#5865F2]" />}
            label="Convidar pessoas"
            onClick={() => {
              toast.info("Compartilhe o link de convite.");
              onClose();
            }}
          />
          <MenuItem
            icon={<BellOff className="h-4 w-4 text-muted2" />}
            label="Silenciar servidor"
            onClick={() => {
              toast.info("Servidor silenciado.");
              onClose();
            }}
          />
          <MenuDivider />
          <MenuItem
            icon={<Settings className="h-4 w-4 text-muted2" />}
            label="Configurações"
            onClick={() => {
              toast.info("Abrindo configurações do servidor...");
              onClose();
            }}
          />
          <MenuDivider />
          <MenuItem
            icon={<LogOut className="h-4 w-4 text-red-400" />}
            label="Sair do servidor"
            danger
            onClick={() => {
              toast.warning("Sair do servidor acionado.");
              onClose();
            }}
          />
        </>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors font-medium ${
        danger
          ? "text-red-400 hover:bg-red-500/15 hover:text-red-300"
          : "hover:bg-white/10 text-white"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function MenuDivider() {
  return <div className="my-1 h-[1px] bg-white/10" />;
}
