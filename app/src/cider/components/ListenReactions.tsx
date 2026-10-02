/**
 * As reações de "Ouvir junto" por cima do player.
 *
 * Duas partes, com papéis diferentes:
 *
 * - a **barra** é a mão: fica acima da playbar, sempre ao alcance, e mostra com
 *   quem se está ouvindo (clicar nela abre o painel da sessão);
 * - as **reações que sobem** são a resposta: cada uma sobe da altura da barra,
 *   ganha um deslocamento próprio para não subirem coladas e some sozinha.
 *
 * A barra só existe quando há sessão — sem sessão não há para quem reagir, e uma
 * fileira de emojis decorativa seria só ruído sobre a música.
 */

import { Users, WifiOff } from "lucide-react";

import { CIDER_LISTEN_EMOJIS } from "@contracts/constants";
import { reactToListen, useCiderListen } from "../listen";
import { useCiderUi } from "../ui";

export function CiderListenOverlay() {
  const session = useCiderListen((store) => store.session);
  const reactions = useCiderListen((store) => store.reactions);
  const hostPresent = useCiderListen((store) => store.hostPresent);
  const offline = useCiderListen((store) => store.offline);
  const setOpen = useCiderUi((store) => store.setListenOpen);

  if (!session) return null;

  const host = session.members.find((member) => member.userId === session.hostId);
  /*
   * "Reconectando" a partir de dois motivos diferentes, e ambos importam para
   * quem está ouvindo: o anfitrião caiu (a música fica parada no ponto em que
   * ele estava) ou a **própria** conexão caiu (a sessão volta quando ela subir).
   */
  const away = !hostPresent || offline;
  const label = offline
    ? "Reconectando a sessão…"
    : !hostPresent
      ? "Anfitrião reconectando…"
      : session.me.role === "host"
        ? `Sessão ${session.code}`
        : `Ouvindo com ${host?.name ?? "o anfitrião"}`;

  return (
    <>
      <div className="listen-dock">
        <button
          type="button"
          className="listen-chip"
          data-state={away ? "away" : "live"}
          onClick={() => setOpen(true)}
          title="Abrir o painel de Ouvir junto"
        >
          {away ? <WifiOff size={14} /> : <Users size={14} />}
          <span className="truncate">{label}</span>
        </button>
        <div className="listen-dock-emojis" role="group" aria-label="Reagir">
          {CIDER_LISTEN_EMOJIS.map((emoji) => (
            <button
              type="button"
              key={emoji}
              className="listen-dock-emoji"
              onClick={() => reactToListen(emoji)}
              aria-label={`Reagir com ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <div className="listen-floats" aria-hidden="true">
        {reactions.map((reaction) => (
          <span
            key={reaction.id}
            className="listen-float"
            style={{ left: `${82 + reaction.drift}%` }}
            title={`${reaction.name} reagiu`}
          >
            {reaction.emoji}
          </span>
        ))}
      </div>
    </>
  );
}
