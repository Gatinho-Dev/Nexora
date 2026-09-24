import {
  Hash,
  MessageCircle,
  MoreHorizontal,
  Search,
  Send,
  Wifi,
} from "lucide-react";

const friends = ["Gabi", "Rotiv", "Gal"];
const messages = [
  { author: "Gabi", text: "Oii", time: "agora" },
  { author: "Gabi", text: "Tudo certo?", time: "agora" },
];

export function CliTerminalPreview() {
  return (
    <div
      className="nexora-cli-terminal"
      role="img"
      aria-label="Prévia visual do Nexora CLI com lista de amigos e conversa"
    >
      <div className="nexora-cli-terminal-bar">
        <div className="nexora-cli-terminal-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="nexora-cli-terminal-title">
          <span className="nexora-cli-terminal-prompt">$</span>
          <span>nexora</span>
          <span className="nexora-cli-terminal-live">
            <Wifi size={12} aria-hidden="true" />
            conectado
          </span>
        </div>
        <MoreHorizontal size={17} aria-hidden="true" />
      </div>
      <div className="nexora-cli-terminal-body">
        <aside className="nexora-cli-terminal-sidebar">
          <div className="nexora-cli-terminal-search">
            <Search size={12} aria-hidden="true" />
            <span>Buscar</span>
            <kbd>⌘ K</kbd>
          </div>
          <div className="nexora-cli-terminal-section">
            <span className="nexora-cli-terminal-label">Amigos</span>
            {friends.map(friend => (
              <div className="nexora-cli-terminal-friend" key={friend}>
                <span className="nexora-cli-terminal-avatar">
                  {friend.slice(0, 1)}
                </span>
                <span>{friend}</span>
                <i aria-label="online" />
              </div>
            ))}
          </div>
          <div className="nexora-cli-terminal-section nexora-cli-terminal-section-muted">
            <span className="nexora-cli-terminal-label">Mensagens</span>
            <div className="nexora-cli-terminal-friend">
              <MessageCircle size={13} aria-hidden="true" />
              <span>Gal</span>
              <b>1</b>
            </div>
          </div>
          <div className="nexora-cli-terminal-sidebar-footer">
            <span className="nexora-cli-terminal-avatar">N</span>
            <div>
              <strong>nexora</strong>
              <small>online</small>
            </div>
          </div>
        </aside>
        <section className="nexora-cli-terminal-chat">
          <div className="nexora-cli-terminal-chat-header">
            <div>
              <span className="nexora-cli-terminal-label">GalLoyalitat</span>
              <strong># geral</strong>
            </div>
            <span className="nexora-cli-terminal-online">
              <i /> 3 online
            </span>
          </div>
          <div className="nexora-cli-terminal-messages">
            <div className="nexora-cli-terminal-day">hoje</div>
            {messages.map(message => (
              <div
                className="nexora-cli-terminal-message"
                key={`${message.author}-${message.text}`}
              >
                <span className="nexora-cli-terminal-message-avatar">
                  {message.author.slice(0, 1)}
                </span>
                <div>
                  <div className="nexora-cli-terminal-message-meta">
                    <strong>{message.author}</strong>
                    <time>{message.time}</time>
                  </div>
                  <p>{message.text}</p>
                </div>
              </div>
            ))}
            <div className="nexora-cli-terminal-system">
              <Hash size={12} aria-hidden="true" />
              <span>Você está em #geral</span>
            </div>
          </div>
          <div className="nexora-cli-terminal-composer">
            <span>Digite uma mensagem...</span>
            <Send size={14} aria-hidden="true" />
          </div>
        </section>
      </div>
    </div>
  );
}
