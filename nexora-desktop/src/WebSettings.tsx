import { useEffect, useState } from "react";
import { X } from "lucide-react";

/**
 * Configurações da conta Nexora Web espelhadas no Desktop.
 * Toda chamada passa pelo RPC validado do processo principal (`validRpc`),
 * que só aceita os procedimentos listados lá.
 */

type Session = { id: string; isCurrent: boolean; createdAt?: string; userAgent?: string | null; ip?: string | null };

const rpc = <T,>(path: string, input?: unknown) => window.nexora.rpc<T>(path, input);
const errorText = (err: unknown) => (err instanceof Error ? err.message : "Algo deu errado.");

export function WebSettings({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"sessions" | "privacy" | "username">("sessions");
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="web-settings-title" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <div className="eyebrow">NEXORA WEB</div>
            <h2 id="web-settings-title">Conta</h2>
          </div>
          <button className="icon-button" aria-label="Fechar" onClick={onClose}><X size={20} /></button>
        </header>
        <nav className="settings-tabs" aria-label="Abas da conta">
          <button className={tab === "sessions" ? "primary" : ""} onClick={() => setTab("sessions")}>Dispositivos conectados</button>
          <button className={tab === "username" ? "primary" : ""} onClick={() => setTab("username")}>Nome de usuário</button>
          <button className={tab === "privacy" ? "primary" : ""} onClick={() => setTab("privacy")}>Privacidade</button>
        </nav>
        {tab === "sessions" && <SessionsPanel />}
        {tab === "username" && <UsernamePanel />}
        {tab === "privacy" && <PrivacyPanel />}
      </section>
    </div>
  );
}

function SessionsPanel() {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => rpc<Session[]>("account.sessionsList").then(setSessions).catch((err) => setError(errorText(err)));
  useEffect(() => { void load(); }, []);

  const revoke = async (sessionId: string) => {
    setBusy(true);
    setError("");
    try {
      await rpc("account.sessionRevoke", { sessionId });
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const revokeOthers = async () => {
    setBusy(true);
    setError("");
    try {
      await rpc("account.sessionRevokeOthers");
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {error && <div className="error" role="alert">{error}</div>}
      {sessions === null && !error && <p>Carregando sessões…</p>}
      {sessions?.map((session) => (
        <div key={session.id} className="update-box">
          <div>
            <strong>{session.isCurrent ? "Este computador" : "Outra sessão"}</strong>
            <small>{session.createdAt ? `Iniciada em ${new Date(session.createdAt).toLocaleString("pt-BR")}` : "Sessão ativa"}</small>
          </div>
          {!session.isCurrent && <button disabled={busy} onClick={() => void revoke(session.id)}>Encerrar</button>}
        </div>
      ))}
      {sessions && sessions.some((s) => !s.isCurrent) && (
        <button className="primary" disabled={busy} onClick={() => void revokeOthers()}>Encerrar todas as outras sessões</button>
      )}
    </div>
  );
}

function UsernamePanel() {
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const valid = /^[a-zA-Z0-9_.-]{3,32}$/.test(username);

  const save = async () => {
    setBusy(true);
    setStatus(null);
    try {
      await rpc("account.setUsername", { username });
      setStatus({ kind: "ok", text: "Nome de usuário atualizado." });
      setUsername("");
    } catch (err) {
      setStatus({ kind: "error", text: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(event) => { event.preventDefault(); if (valid && !busy) void save(); }}>
      <label>
        <span><strong>Novo nome de usuário</strong><small>De 3 a 32 caracteres: letras, números, ponto, hífen ou sublinhado.</small></span>
        <input value={username} maxLength={32} onChange={(event) => setUsername(event.target.value)} autoComplete="off" />
      </label>
      {status && <div className={status.kind === "error" ? "error" : "settings-version"} role={status.kind === "error" ? "alert" : "status"}>{status.text}</div>}
      <button className="primary" type="submit" disabled={!valid || busy}>Salvar</button>
    </form>
  );
}

function PrivacyPanel() {
  const [readReceipts, setReadReceipts] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    rpc<{ readReceipts: boolean }>("account.privacy").then((value) => setReadReceipts(value.readReceipts)).catch((err) => setError(errorText(err)));
  }, []);

  const toggle = async (next: boolean) => {
    setError("");
    try {
      await rpc("account.setPrivacy", { readReceipts: next });
      setReadReceipts(next);
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <div>
      {error && <div className="error" role="alert">{error}</div>}
      <label>
        <span><strong>Confirmações de leitura</strong><small>Mostrar a outras pessoas quando você leu as mensagens.</small></span>
        <input type="checkbox" checked={readReceipts ?? false} disabled={readReceipts === null} onChange={(event) => void toggle(event.target.checked)} />
      </label>
    </div>
  );
}
