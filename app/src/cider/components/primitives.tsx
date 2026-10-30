/**
 * Primitivas de interface do Cider.
 *
 * Cada componente escreve exatamente as mesmas classes do Cider 2 desktop
 * (`.btn`, `.switch`, `.progress`, `.media-card`, …): o CSS copiado do desktop
 * é a fonte do visual, e um componente que inventasse a própria estrutura
 * divergiria da aparência que o usuário pediu para manter.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Loader2, Play } from "lucide-react";

/* ------------------------------------------------------------------ *
 * Botões                                                             *
 * ------------------------------------------------------------------ */

type ButtonVariant = "surface" | "primary" | "ghost" | "danger";

export function Button({
  children,
  variant = "surface",
  size,
  icon,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "lg";
  icon?: ReactNode;
}) {
  const classes = [
    "btn",
    variant === "primary" ? "primary" : variant === "ghost" ? "ghost" : variant === "danger" ? "danger" : "",
    size === "sm" ? "sm" : size === "lg" ? "lg" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" className={classes} {...rest}>
      {icon}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  active,
  tone,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  active?: boolean;
  tone?: "play";
  children: ReactNode;
}) {
  const classes = [
    "btn",
    "icon",
    tone === "play" ? "play" : "",
    active ? "on" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      className={classes}
      aria-label={label}
      title={label}
      aria-pressed={active}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Formulários                                                        *
 * ------------------------------------------------------------------ */

/** Interruptor (a classe `.switch` do desktop usa `data-on`). */
export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className="switch"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      data-on={checked ? "true" : "false"}
      onClick={() => onChange(!checked)}
    />
  );
}

/** Controle deslizante com valor visível. */
export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  label,
  format,
  disabled,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  label: string;
  format?: (value: number) => string;
  disabled?: boolean;
}) {
  return (
    <div className="slider">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="value">{format ? format(value) : String(value)}</span>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Barra de progresso (arrasto real, como no desktop)                 *
 * ------------------------------------------------------------------ */

export function ProgressSlider({
  positionMs,
  durationMs,
  onSeek,
  style = "bar",
  label = "Progresso",
}: {
  positionMs: number;
  durationMs: number;
  onSeek: (value: number) => void;
  style?: "bar" | "thin" | "wave";
  label?: string;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [draft, setDraft] = useState(0);

  const total = Math.max(1, durationMs);
  const shown = dragging ? draft : Math.min(positionMs, total);
  const percent = Math.max(0, Math.min(100, (shown / total) * 100));

  const valueFromEvent = useCallback(
    (clientX: number): number => {
      const track = trackRef.current;
      if (!track) return 0;
      const rect = track.getBoundingClientRect();
      const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
      return Math.round(Math.max(0, Math.min(1, ratio)) * total);
    },
    [total],
  );

  useEffect(() => {
    if (!dragging) return undefined;
    const onMove = (event: PointerEvent) => setDraft(valueFromEvent(event.clientX));
    const onUp = (event: PointerEvent) => {
      const value = valueFromEvent(event.clientX);
      setDragging(false);
      onSeek(value);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, onSeek, valueFromEvent]);

  return (
    <div
      className="progress"
      data-style={style}
      data-dragging={dragging ? "true" : "false"}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(total / 1000)}
      aria-valuenow={Math.round(shown / 1000)}
      onPointerDown={(event) => {
        event.preventDefault();
        setDraft(valueFromEvent(event.clientX));
        setDragging(true);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") onSeek(Math.min(total, positionMs + 5000));
        if (event.key === "ArrowLeft") onSeek(Math.max(0, positionMs - 5000));
      }}
    >
      <div className="progress-track" ref={trackRef}>
        <div className="progress-fill" style={{ width: `${percent}%` }} />
        <div className="progress-handle" style={{ left: `${percent}%` }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Estruturas de página                                               *
 * ------------------------------------------------------------------ */

export function SectionHeader({
  title,
  action,
  kicker,
}: {
  title: string;
  action?: ReactNode;
  kicker?: string;
}) {
  return (
    <div className="section-head">
      <div>
        {kicker ? <div className="page-kicker">{kicker}</div> : null}
        <h3>{title}</h3>
      </div>
      {action ? <div className="section-actions">{action}</div> : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: ReactNode;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon}
      <h3>{title}</h3>
      <p>{message}</p>
      {action ? <div className="inline" style={{ justifyContent: "center" }}>{action}</div> : null}
    </div>
  );
}

export function Notice({
  tone = "info",
  title,
  children,
  icon,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  title?: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="notice" data-tone={tone}>
      {icon}
      <div>
        {title ? <strong>{title}</strong> : null}
        {title ? <br /> : null}
        {children}
      </div>
    </div>
  );
}

export function Spinner({ label = "Carregando" }: { label?: string }) {
  return (
    <span className="inline" role="status" aria-label={label}>
      <Loader2 size={16} className="cider-spin" />
    </span>
  );
}

export function Badge({
  children,
  tone,
  title,
}: {
  children: ReactNode;
  tone?: "accent" | "success" | "warning" | "danger" | "explicit";
  title?: string;
}) {
  return (
    <span className={`badge ${tone ?? ""}`.trim()} title={title}>
      {children}
    </span>
  );
}

export function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat-tile">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Cartões de mídia                                                   *
 * ------------------------------------------------------------------ */

export function MediaCard({
  title,
  subtitle,
  artworkUrl,
  round,
  badge,
  onOpen,
  onPlay,
  style,
}: {
  title: string;
  subtitle?: string;
  artworkUrl?: string;
  round?: boolean;
  badge?: ReactNode;
  onOpen: () => void;
  onPlay?: () => void;
  style?: CSSProperties;
}) {
  return (
    <div className="media-card" data-lift="true" style={style}>
      {/* O botão de abrir e o de tocar são irmãos: um botão dentro do outro
          seria HTML inválido e o clique se perderia. */}
      <div className="cover-wrap">
        <button
          type="button"
          className="cover-open"
          onClick={onOpen}
          aria-label={`Abrir ${title}`}
          style={{ display: "block", width: "100%", height: "100%", border: 0, padding: 0, background: "none", cursor: "pointer" }}
        >
          {artworkUrl ? (
            <img className={`cover${round ? " round" : ""}`} src={artworkUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
          ) : (
            <div className="cover-fallback" aria-hidden="true">
              {title.slice(0, 1).toUpperCase()}
            </div>
          )}
        </button>
        {onPlay ? (
          <span className="play-float">
            <IconButton label={`Tocar ${title}`} tone="play" onClick={onPlay}>
              <Play size={16} />
            </IconButton>
          </span>
        ) : null}
      </div>
      <div className="stack tight">
        <button type="button" className="title link-like" onClick={onOpen} title={title}>
          {title}
        </button>
        {subtitle ? <span className="subtitle">{subtitle}</span> : null}
        {badge ? <span>{badge}</span> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Modal                                                              *
 * ------------------------------------------------------------------ */

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className={`modal${wide ? " wide" : ""}`} onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="Fechar">
            Fechar
          </Button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}
