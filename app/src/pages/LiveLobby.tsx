import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Radio, Users, Zap } from "lucide-react";
import { NexoraAppIcon } from "@/components/NexoraBrand";
import { Seo } from "@/lib/seo";
import { createLiveRoom } from "@/lib/live/api";
import { ensureSessionId, saveIdentity } from "@/lib/live/identity";
import { validateNickname, validateRoomName } from "@contracts/live";
import "./Live.css";

/**
 * Lobby do Nexora Live — /live
 *
 * Fluxo mínimo: nick → criar sala OU colar código/link. Sem cadastro.
 */
export default function LiveLobby() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const trimmedNick = nickname.trim();

  function nickError(): string | null {
    if (!trimmedNick) return null;
    const validation = validateNickname(trimmedNick);
    return validation.ok ? null : validation.error;
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const validation = validateNickname(trimmedNick);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }
    setError(null);
    setCreating(true);
    try {
      ensureSessionId();
      const nameValidation = validateRoomName(roomName);
      if (!nameValidation.ok) {
        setError(nameValidation.error);
        setCreating(false);
        return;
      }
      const { code, hostToken } = await createLiveRoom(
        nameValidation.value ?? undefined
      );
      saveIdentity({
        sessionId: ensureSessionId(),
        nickname: validation.value,
        sessionToken: "",
        hostToken,
        roomCode: code,
      });
      navigate(`/live/${code}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível criar a sala."
      );
    } finally {
      setCreating(false);
    }
  }

  function handleJoin(e: FormEvent) {
    e.preventDefault();
    const validation = validateNickname(trimmedNick);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }
    // Aceita link completo (https://nexorachat.cloud/live/AB7K2Q) ou código.
    const match = roomInput.trim().match(/\/live\/([a-zA-Z0-9]+)/);
    const code = (match ? match[1] : roomInput.trim())
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6);
    if (code.length !== 6) {
      setError("Digite um código ou link de sala válido.");
      return;
    }
    setError(null);
    navigate(`/live/${code}?join=1`, {
      state: { nickname: validation.value },
    });
  }

  const nickProblem = nickError();

  return (
    <div className="live-landing">
      <Seo
        title="Nexora Live — Converse por voz, vídeo e tela"
        description="Crie uma sala gratuita no Nexora Live e converse com seus amigos por voz, vídeo, compartilhamento de tela e chat. Sem cadastro."
        canonicalPath="/live"
      />
      <a className="landing-skip-link" href="#live-conteudo">
        Pular para o conteúdo
      </a>

      <header className="landing-header">
        <div className="landing-shell landing-nav-row">
          <Link to="/" className="landing-brand" aria-label="Voltar ao Nexora">
            <NexoraAppIcon className="landing-brand__icon" decorative />
            <span>Nexora Live</span>
            <span className="live-beta-badge" aria-label="Recurso em beta">
              Beta
            </span>
          </Link>
          <div className="landing-nav-actions">
            <Link className="landing-button landing-button--ghost" to="/">
              <ArrowLeft aria-hidden /> Nexora
            </Link>
          </div>
        </div>
      </header>

      <main id="live-conteudo" className="live-lobby">
        <section className="live-lobby__hero">
          <div className="live-lobby__badge" aria-hidden>
            <Radio size={16} />
          </div>
          <h1>
            Nexora Live
            <span className="live-beta-badge live-beta-badge--hero" aria-label="Recurso em beta">
              Beta
            </span>
          </h1>
          <p className="live-lobby__lead">
            Crie uma sala e converse com seus amigos.
          </p>
          <p className="live-lobby__hint">
            Sem cadastro. Sem complicação. Seu nick é temporário e não é
            necessário criar uma conta.
          </p>
        </section>

        <section className="live-lobby__card" aria-label="Entrar no Nexora Live">
          <form onSubmit={handleCreate} className="live-lobby__form">
            <label htmlFor="live-room-name" className="live-lobby__label">
              Nome da sala <span className="live-lobby__optional">(opcional)</span>
            </label>
            <input
              id="live-room-name"
              className="live-lobby__input"
              value={roomName}
              onChange={e => setRoomName(e.target.value.slice(0, 40))}
              placeholder="Ex.: Jogos de sexta"
              autoComplete="off"
              maxLength={40}
            />

            <label htmlFor="live-nick" className="live-lobby__label">
              Qual é o seu nick?
            </label>
            <input
              id="live-nick"
              className="live-lobby__input"
              value={nickname}
              onChange={e => setNickname(e.target.value.slice(0, 24))}
              placeholder="Gatinho_Dev"
              autoComplete="off"
              maxLength={24}
              aria-invalid={!!nickProblem}
              aria-describedby={nickProblem ? "live-nick-error" : undefined}
            />
            {nickProblem && (
              <p id="live-nick-error" className="live-lobby__error" role="alert">
                {nickProblem}
              </p>
            )}

            <button
              type="submit"
              className="landing-button landing-button--primary landing-button--large live-lobby__cta"
              disabled={creating || !trimmedNick}
            >
              <Zap aria-hidden />
              {creating ? "Criando sala..." : "Criar sala"}
            </button>
          </form>

          <div className="live-lobby__divider" role="separator">
            <span>ou entre em uma sala</span>
          </div>

          <form onSubmit={handleJoin} className="live-lobby__form">
            <label htmlFor="live-code" className="live-lobby__label">
              Código ou link da sala
            </label>
            <input
              id="live-code"
              className="live-lobby__input"
              value={roomInput}
              onChange={e => setRoomInput(e.target.value)}
              placeholder="AB7K2Q ou https://…/live/AB7K2Q"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="submit"
              className="landing-button landing-button--ghost landing-button--large live-lobby__cta"
              disabled={!trimmedNick || !roomInput.trim()}
            >
              <Users aria-hidden />
              Entrar em uma sala
            </button>
          </form>

          {error && (
            <p className="live-lobby__error" role="alert">
              {error}
            </p>
          )}
        </section>
      </main>

      <footer className="live-lobby__footer">
        <p>
          Ao usar o Nexora Live você concorda com os{" "}
          <Link to="/terms">Termos</Link> e a{" "}
          <Link to="/privacy">Política de Privacidade</Link> da Nexora.
        </p>
      </footer>
    </div>
  );
}
