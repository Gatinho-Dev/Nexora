import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { DMSidebar } from "@/components/DMSidebar";
import { FriendsPanel } from "@/components/FriendsPanel";
import { SidebarPortal } from "@/components/SidebarPortal";
import { useOutletContext } from "react-router";
import type { AppOutletContext } from "@/lib/appOutletContext";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Amigos em tela cheia (mobile) ou com sidebar no desktop. No celular é a
 * página dos tabs Online/Todos/Pendentes/Bloqueados + adicionar amigo.
 */
export function FriendsPage() {
  const { onOpenProfile } = useOutletContext<AppOutletContext>();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  if (!isMobile) {
    return (
      <div className="flex flex-1 min-h-0">
        <SidebarPortal>
          <DMSidebar onOpenProfile={onOpenProfile} />
        </SidebarPortal>
        <FriendsPanel onOpenProfile={onOpenProfile} />
      </div>
    );
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col bg-chat text-foreground">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-black/20 bg-chat px-3 select-none shadow-sm">
        <button
          onClick={() => navigate("/channels/@me")}
          className="-ml-1 rounded p-1.5 text-muted2 hover:bg-white/10 hover:text-foreground transition-colors active:scale-95"
          aria-label="Voltar para o início"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-sm font-bold">Amigos</h1>
      </header>
      <FriendsPanel onOpenProfile={onOpenProfile} />
    </main>
  );
}
