/**
 * Painel "Ouvir junto": abrir a sessão, entrar por código, convidar amigos e
 * reagir.
 *
 * Ele responde a três perguntas diferentes, e é por isso que tem três caras:
 *
 * - **sem sessão** — "como eu participo?" A resposta é a mais curta possível:
 *   abrir uma sessão ou digitar um código. Um convite que já chegou aparece
 *   aqui em cima, porque foi para isso que ele veio;
 * - **anfitrião** — "quem está comigo e como chamo mais gente?" Código à vista
 *   (para quem está do lado), lista de amigos para convidar e participantes;
 * - **convidado** — "quem manda aqui?" O nome do anfitrião e a saída. Os
 *   controles de reprodução do convidado viram **pedidos**: quem tem a fila é o
 *   anfitrião, e o painel é onde isso fica claro.
 */

import { useMemo, useState } from "react";
import { Check, ClipboardCopy, DoorOpen, LogIn, Radio, Users, X } from "lucide-react";

import { CIDER_LISTEN_EMOJIS, CiderListen } from "@contracts/constants";
import { trpc } from "@/providers/trpc";
import {
  endListen,
  inviteToListen,
  joinListen,
  leaveListen,
  reactToListen,
  startListen,
  useCiderListen,
} from "../listen";
import { ciderToast, useCiderUi } from "../ui";
import { Button, Modal, Notice } from "./primitives";

export function CiderListenPanel() {
  const open = useCiderUi((store) => store.listenOpen);
  const setOpen = useCiderUi((store) => store.setListenOpen);
  const session = useCiderListen((store) => store.session);
  const invite = useCiderListen((store) => store.invite);
  const error = useCiderListen((store) => store.error);
  const hostPresent = useCiderListen((store) => store.hostPresent);
  const offline = useCiderListen((store) => store.offline);
  const [code, setCode] = useState("");

  const host = session?.members.find((member) => member.userId === session.hostId) ?? null;

  return (
    <Modal open={open} title="Ouvir junto" onClose={() => setOpen(false)}>
      <div className="listen-panel">
        {error ? (
          <Notice tone="warning" title="Não deu">
            {error}
          </Notice>
        ) : null}

        {offline && session ? (
          <Notice tone="warning" title="Sem conexão">
            A sessão fica guardada nesta aba: assim que a conexão voltar, você retoma de onde estava.
          </Notice>
        ) : null}

        {/*
          * O anfitrião caído não encerra a sessão: ela **espera** por ele. Dizer
          * isso é melhor do que deixar a sala parecendo quebrada — e melhor do
          * que esconder que existe um prazo.
        */}
        {session && !hostPresent && session.me.role === "guest" ? (
          <Notice tone="warning" title="O anfitrião caiu da sessão">
            A sala espera ele voltar por {Math.round(CiderListen.HOST_GRACE_MS / 60_000)} minutos — a
            música fica parada onde estava. Se ele não voltar, a sessão termina sozinha.
          </Notice>
        ) : null}

        {session ? (
          <>
            <div className="listen-head" data-away={!hostPresent ? "true" : "false"}>
              <span className="listen-role">
                <Radio size={15} />
                {session.me.role === "host"
                  ? "Você é o anfitrião desta sessão"
                  : `Ouvindo com ${host?.name ?? "o anfitrião"}`}
              </span>
              {session.me.role === "host" ? <CodeChip code={session.code} /> : null}
            </div>

            <ReactionRow />

            <div className="listen-section">
              <div className="listen-section-label">
                <Users size={14} /> {session.members.length} na sessão
              </div>
              <div className="listen-members">
                {session.members.map((member) => (
                  <div className="listen-member" key={member.userId}>
                    <span className="listen-avatar" aria-hidden="true">
                      {member.avatar ? (
                        <img src={member.avatar} alt="" />
                      ) : (
                        member.name.slice(0, 1).toUpperCase()
                      )}
                    </span>
                    <span className="listen-member-name truncate">{member.name}</span>
                    <span className="listen-member-role">
                      {member.role === "host"
                        ? "anfitrião"
                        : member.userId === session.me.userId
                          ? "você"
                          : "convidado"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {session.me.role === "host" ? <InviteFriends /> : null}
          </>
        ) : (
          <>
            {invite ? (
              <Notice tone="success" title={`${invite.fromName} chamou você`} icon={<Radio size={15} />}>
                <div className="stack gap-2">
                  <span>Entrar na sessão e ouvir o que está tocando lá?</span>
                  <Button
                    variant="primary"
                    icon={<LogIn size={15} />}
                    onClick={() => {
                      joinListen(invite.code);
                      setOpen(false);
                    }}
                  >
                    Entrar na sessão
                  </Button>
                </div>
              </Notice>
            ) : null}

            <p className="small muted">
              Numa sessão, todo mundo ouve a mesma faixa no mesmo ponto: quem abre é o{" "}
              <strong>anfitrião</strong> e manda na fila; quem entra acompanha e pode reagir — e pedir
              para pular, voltar ou pausar.
            </p>

            <Button variant="primary" icon={<Radio size={15} />} onClick={startListen}>
              Começar uma sessão
            </Button>

            <div className="listen-divider" role="separator">
              ou entre com um código
            </div>

            <form
              className="listen-join"
              onSubmit={(event) => {
                event.preventDefault();
                joinListen(code);
                setCode("");
              }}
            >
              <input
                className="listen-code-input"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="ABCDEF"
                aria-label="Código da sessão"
                maxLength={8}
                spellCheck={false}
                autoComplete="off"
              />
              <Button type="submit" icon={<LogIn size={15} />} disabled={code.replace(/[\s-]/g, "").length !== 6}>
                Entrar
              </Button>
            </form>
          </>
        )}
      </div>

      {session ? (
        <div className="listen-foot">
          {session.me.role === "host" ? (
            <Button variant="danger" icon={<DoorOpen size={15} />} onClick={endListen}>
              Encerrar a sessão
            </Button>
          ) : (
            <Button icon={<DoorOpen size={15} />} onClick={leaveListen}>
              Sair da sessão
            </Button>
          )}
          <span className="xsmall faint">
            {session.me.role === "host"
              ? "Encerrar devolve todos para as próprias filas."
              : "Sair não interrompe quem ficou."}
          </span>
        </div>
      ) : null}
    </Modal>
  );
}

/** O código precisa ser lido em voz alta e copiado — as duas coisas à vista. */
function CodeChip({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const done = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_600);
    };
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard
        .writeText(code)
        .then(done)
        .catch(() => ciderToast("info", "Código da sessão", code));
      return;
    }
    ciderToast("info", "Código da sessão", code);
  };
  return (
    <button type="button" className="listen-code" onClick={copy} title="Copiar o código">
      <span className="listen-code-value">{code}</span>
      {copied ? <Check size={14} /> : <ClipboardCopy size={14} />}
    </button>
  );
}

/** Reações da sessão — a lista é fechada, e é a mesma dos dois lados. */
function ReactionRow() {
  return (
    <div className="listen-reactions" role="group" aria-label="Reagir">
      {CIDER_LISTEN_EMOJIS.map((emoji) => (
        <button
          type="button"
          key={emoji}
          className="listen-reaction"
          onClick={() => reactToListen(emoji)}
          aria-label={`Reagir com ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

/**
 * Lista de amigos para convidar.
 *
 * Só amigos **aceitos**: o convite toca na tela do outro, então a lista é
 * exatamente quem pode recebê-lo — o servidor recusa o resto, e mostrar um nome
 * que a resposta vai recusar seria uma promessa falsa.
 */
function InviteFriends() {
  const session = useCiderListen((store) => store.session);
  const friends = trpc.friend.list.useQuery(undefined, { enabled: !!session });
  const [term, setTerm] = useState("");

  const accepted = useMemo(
    () => (friends.data ?? []).filter((friend) => friend.status === "ACCEPTED"),
    [friends.data],
  );

  const inSession = useMemo(
    () => new Set((session?.members ?? []).map((member) => member.userId)),
    [session?.members],
  );

  const visible = useMemo(() => {
    const needle = term.trim().toLowerCase();
    const list = accepted.filter((friend) => {
      const name = (friend.user.name ?? friend.user.username ?? "").toLowerCase();
      return needle ? name.includes(needle) : true;
    });
    return list.slice(0, 24);
  }, [accepted, term]);

  return (
    <div className="listen-section">
      <div className="listen-section-label">
        <Users size={14} /> Convidar amigos
      </div>
      {accepted.length > 6 ? (
        <input
          className="listen-invite-search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Buscar amigo"
          aria-label="Buscar amigo para convidar"
        />
      ) : null}
      {friends.isLoading ? (
        <p className="small muted">Carregando seus amigos…</p>
      ) : visible.length === 0 ? (
        <p className="small muted">
          {accepted.length === 0
            ? "Você ainda não tem amigos por aqui. O código acima vale para quem você quiser chamar."
            : "Nenhum amigo com esse nome."}
        </p>
      ) : (
        <div className="listen-friends">
          {visible.map((friend) => {
            const name = friend.user.name ?? friend.user.username ?? "Alguém";
            const already = inSession.has(friend.user.id);
            return (
              <div className="listen-friend" key={friend.user.id}>
                <span className="listen-avatar" aria-hidden="true">
                  {friend.user.avatar ? (
                    <img src={friend.user.avatar} alt="" />
                  ) : (
                    name.slice(0, 1).toUpperCase()
                  )}
                </span>
                <span className="listen-member-name truncate">{name}</span>
                {already ? (
                  <span className="listen-member-role">
                    <X size={13} /> na sessão
                  </span>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => {
                      inviteToListen(friend.user.id);
                      ciderToast("info", "Convite enviado", `Esperando ${name} entrar na sessão.`);
                    }}
                  >
                    Convidar
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
