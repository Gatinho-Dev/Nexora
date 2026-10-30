/**
 * `/cider` — o Cider 2 web dentro da Nexora.
 *
 * Este arquivo é só o invólucro: portão de autenticação, folhas de estilo e o
 * aplicativo. O `CiderProvider` **não** é montado aqui — ele já vive acima do
 * roteador no `App.tsx`, para o `<iframe>` do YouTube nunca ser desmontado ao
 * navegar. Montá-lo de novo criaria um segundo motor e um segundo player
 * tocando a mesma faixa. Todo o aplicativo está em `src/cider/`: casca, telas,
 * temas e motor.
 *
 * O portão de autenticação existe porque a Nexora é quem dá identidade à
 * presença de "tocando agora": sem conta, o Cider não teria para quem publicar.
 */

import { Disc3, Loader2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router";

import { CiderApp } from "@/cider/CiderApp";
import { useAuth } from "@/hooks/useAuth";

import "@/cider/styles/tokens.css";
import "@/cider/styles/base.css";
import "@/cider/styles/layout.css";
import "@/cider/styles/components.css";
import "@/cider/styles/pages.css";
import "@/cider/styles/settings.css";
import "@/cider/styles/youtube.css";
import "@/cider/styles/lyrics.css";
import "@/cider/styles/bridge.css";
// Por último: as classes que só existem no site (dock, mini-player, telas
// novas) precisam vencer as cópias do desktop na mesma especificidade.
import "@/cider/styles/web.css";

export default function CiderPage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="cider-root cider-gate">
        <Loader2 size={24} className="cider-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="cider-root cider-gate">
        <div className="stack" style={{ maxWidth: 420, textAlign: "center" }}>
          <div className="inline justify-center gap-2">
            <Disc3 size={26} style={{ color: "var(--cider-accent)" }} />
            <h1 className="now-playing-title" style={{ fontSize: "var(--cider-text-xl)" }}>
              Cider 2
            </h1>
          </div>
          <p className="muted">
            Entre na sua conta da Nexora para ouvir. O que você estiver ouvindo aparece no perfil, na
            lista de amigos e no chat.
          </p>
          {/* Volta para o endereço exato onde a pessoa estava: abrir a
              Biblioteca pelo link direto e ser mandado para a tela inicial
              depois do login seria perder o que ela pediu. */}
          <button
            className="btn primary lg"
            onClick={() =>
              navigate(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`)
            }
          >
            Entrar para ouvir
          </button>
        </div>
      </div>
    );
  }

  return <CiderApp />;
}
