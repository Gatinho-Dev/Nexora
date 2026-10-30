import { useId } from "react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Primitivas visuais do Modal de Configurações (paridade Discord).
 *
 * Todas as abas são compostas só por estes blocos, então o visual (tokens,
 * raio, foco, contraste, estados disabled) fica declarado em um único lugar.
 *
 * Tokens semânticos usados:
 *   Blurple #5865F2 · hover #4752C4 · Red #ED4245 · Green #57F287
 *   Greyple #99AAB5 · fundo principal #313338 · cartão #232428
 */

export const DISCORD = {
  blurple: "#5865F2",
  blurpleHover: "#4752C4",
  red: "#ED4245",
  green: "#57F287",
  yellow: "#FEE75C",
  greyple: "#99AAB5",
  surface: "#313338",
  card: "#232428",
  sidebar: "#2B2D31",
} as const;

/** Cabeçalho de página, no topo de cada aba. */
export function DiscordPageHeader({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <header className={cn("min-w-0", className)}>
      <h2 className="text-xl font-bold text-white">{title}</h2>
      {description ? (
        <p className="mt-1 text-xs text-[#B5BAC1]">{description}</p>
      ) : null}
    </header>
  );
}

/** Título MINÚSCULO de seção dentro de uma aba. */
export function DiscordSectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3
      className={cn(
        "text-[10px] font-bold uppercase tracking-[0.08em] text-[#949BA4]",
        className,
      )}
    >
      {children}
    </h3>
  );
}

/** Cartão agrupador. `tone="danger"` usa a borda vermelha da zona de risco. */
export function DiscordCard({
  title,
  description,
  tone = "default",
  icon,
  className,
  children,
}: {
  title?: string;
  description?: string;
  tone?: "default" | "danger" | "accent";
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border bg-[#232428] p-4",
        tone === "danger" && "border-[#ED4245]/40",
        tone === "accent" && "border-[#5865F2]/40",
        tone === "default" && "border-black/[0.15]",
        className,
      )}
    >
      {(title || description || icon) && (
        <div className="mb-3 flex items-start gap-3">
          {icon ? (
            <span
              className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/5 text-[#B5BAC1]"
              aria-hidden
            >
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            {title ? (
              <p className="text-sm font-bold text-white">{title}</p>
            ) : null}
            {description ? (
              <p className="mt-1 text-[11px] leading-relaxed text-[#B5BAC1]">
                {description}
              </p>
            ) : null}
          </div>
        </div>
      )}
      {children}
    </section>
  );
}

/** Linha divisória entre itens dentro de um mesmo cartão. */
export function DiscordDivider() {
  return <div className="h-px w-full bg-black/20" aria-hidden />;
}

/**
 * Toggle com linha de texto + descrição + interruptor — o par mais repetido do
 * modal. O `<label>` cobre o texto inteiro, então o clique no rótulo também
 * alterna (comportamento esperado e acessível por teclado).
 */
export function DiscordToggle({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  className,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 px-4 py-3",
        disabled && "opacity-60",
        className,
      )}
    >
      <label htmlFor={id} className="min-w-0 cursor-pointer select-none">
        <span className="block text-[13px] font-semibold text-white">
          {label}
        </span>
        {description ? (
          <span className="mt-0.5 block text-[11px] leading-relaxed text-[#B5BAC1]">
            {description}
          </span>
        ) : null}
      </label>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-label={label}
      />
    </div>
  );
}

/** Slider com rótulo e leitura numérica à direita. */
export function DiscordSlider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  onCommit,
  formatValue,
  hints,
  disabled,
  className,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Chamado a cada pixel de arraste (atualiza a UI local). */
  onChange: (value: number) => void;
  /** Chamado ao soltar o ponteiro — é o que despacha ao backend. */
  onCommit?: (value: number) => void;
  formatValue?: (value: number) => string;
  /** Rótulos das extremidades, opcionalmente com um marcador no meio. */
  hints?: string[];
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2 px-4 py-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-semibold text-white">{label}</span>
        <span className="font-mono text-[11px] text-[#B5BAC1]">
          {formatValue ? formatValue(value) : value}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        disabled={disabled}
        onValueChange={([next]) => onChange(next)}
        onValueCommit={([next]) => onCommit?.(next)}
        aria-label={label}
      />
      {hints ? (
        <div className="flex justify-between gap-2 text-[10px] text-[#949BA4]">
          <span>{hints[0]}</span>
          {hints.length > 2 ? <span>{hints[1]}</span> : null}
          <span>{hints[hints.length - 1]}</span>
        </div>
      ) : null}
    </div>
  );
}

export type DiscordOption<T extends string | number> = {
  value: T;
  label: string;
  description?: string;
};

/** Grupo de cartões clicáveis com semântica de radio group. */
export function DiscordRadioCards<T extends string | number>({
  legend,
  options,
  value,
  onChange,
  columns = 2,
  disabledValues = [],
  className,
}: {
  legend: string;
  options: DiscordOption<T>[];
  value: T;
  onChange: (value: T) => void;
  columns?: 1 | 2 | 3;
  disabledValues?: T[];
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={legend}
      className={cn(
        "grid gap-2",
        columns === 3
          ? "sm:grid-cols-3"
          : columns === 2
            ? "sm:grid-cols-2"
            : "grid-cols-1",
        className,
      )}
    >
      {options.map(option => {
        const selected = option.value === value;
        const disabled = disabledValues.includes(option.value);
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "min-h-16 rounded-lg border px-3 py-2 text-left transition-colors",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2]",
              selected
                ? "border-[#5865F2] bg-[#5865F2]/25 text-white"
                : "border-white/[0.08] bg-[#1E1F22] text-[#B5BAC1] hover:border-white/20 hover:text-white",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            <span className="block text-xs font-bold">{option.label}</span>
            {option.description ? (
              <span className="mt-1 block text-[10px] leading-snug opacity-80">
                {option.description}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Dropdown com rótulo acima — para dispositivos e políticas. */
export function DiscordSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-2 px-4 py-3">
      <label className="block text-[13px] font-semibold text-white">
        {label}
      </label>
      <Select value={value} onValueChange={next => onChange(next as T)} disabled={disabled}>
        <SelectTrigger
          className="border-black/20 bg-[#1E1F22] text-white"
          aria-label={label}
        >
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent className="border-black/20 bg-[#1E1F22] text-white">
          {options.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint ? <p className="text-[10px] text-[#949BA4]">{hint}</p> : null}
    </div>
  );
}

/** Linha "rótulo → valor → botão Editar", usada na Minha Conta. */
export function DiscordInfoRow({
  label,
  value,
  actionLabel = "Editar",
  onAction,
  actionDisabled,
}: {
  label: string;
  value: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
}) {
  return (
    <div className="flex min-h-[3.25rem] items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-[#949BA4]">{label}</p>
        <p className="mt-0.5 truncate text-[13px] text-white">{value}</p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={onAction}
        disabled={actionDisabled || !onAction}
        className="shrink-0 bg-[#4E5058] text-white hover:bg-[#6D6F78]"
      >
        {actionLabel}
      </Button>
    </div>
  );
}

/** Botão de risco com contorno vermelho, para desativar/excluir conta. */
export function DiscordDangerButton({
  children,
  onClick,
  disabled,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "min-h-10 rounded-lg border border-[#ED4245] px-4 py-2 text-[13px] font-semibold text-[#ED4245] transition-colors",
        "hover:bg-[#ED4245] hover:text-white",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ED4245]",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-[#ED4245]",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Botão primário Blurple (usado em ações de confirmação). */
export function DiscordPrimaryButton({
  children,
  onClick,
  disabled,
  className,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <Button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "bg-[#5865F2] text-white hover:bg-[#4752C4]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2]",
        className,
      )}
    >
      {children}
    </Button>
  );
}

/**
 * Grupo de abas internas (ex.: "Perfil de Usuário" × "Perfil de Servidor").
 * Mantém o modal em um nível só de navegação.
 */
export function DiscordSubTabs<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  tabs: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("flex gap-1 border-b border-black/20", className)}
    >
      {tabs.map(tab => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.value)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-[13px] font-semibold transition-colors",
              selected
                ? "border-[#5865F2] text-white"
                : "border-transparent text-[#B5BAC1] hover:text-white",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/** Medidor de áudio do teste de microfone (verde quando há sinal). */
export function DiscordLevelMeter({ level }: { level: number }) {
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-[#1E1F22]"
      role="progressbar"
      aria-label="Nível do microfone"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(level)}
    >
      <div
        className="h-full rounded-full transition-[width,background-color] duration-75"
        style={{
          width: `${Math.min(100, Math.max(0, level))}%`,
          backgroundColor: level > 12 ? "#57F287" : "#5865F2",
        }}
      />
    </div>
  );
}
