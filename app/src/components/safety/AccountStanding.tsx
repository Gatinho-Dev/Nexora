import { useEffect, useState } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";
import type {
  AccountSafetyDTO,
  AccountStatusDTO,
  SafetyViolationDTO,
} from "@contracts/types";
import { Avatar } from "../Avatar";

/**
 * Configurações → Minha Conta → Status da Conta
 *
 * Horizontal layout inspired by a progress-tracker concept: avatar on the
 * left, headline + description, then the 5-step standing bar. On mobile the
 * bar flips to a vertical list so labels never get squeezed.
 */

const STEPS: { id: AccountStatusDTO; label: string; icon: string }[] = [
  { id: "good_standing", label: "Tudo certo", icon: "✅" },
  { id: "limited", label: "Limitado", icon: "⚠️" },
  { id: "very_limited", label: "Muito limitado", icon: "⚠️" },
  { id: "at_risk", label: "Em risco", icon: "🔴" },
  { id: "suspended", label: "Suspenso", icon: "⛔" },
];

const LEVEL_BY_STATUS: Record<AccountStatusDTO, number> = {
  good_standing: 0,
  limited: 1,
  very_limited: 2,
  at_risk: 3,
  suspended: 4,
  permanently_banned: 4,
};

function stepTone(stepIndex: number, level: number): string {
  if (stepIndex === 0) return "text-[#23A55A]"; // first node is always green when reached
  if (level >= 4) return stepIndex === level ? "text-red-400" : "text-[#6D6F78]";
  if (level >= 3) return stepIndex <= level ? (stepIndex === level ? "text-orange-400" : "text-[#23A55A]") : "text-[#6D6F78]";
  if (level >= 2) return stepIndex <= level ? (stepIndex === level ? "text-amber-400" : "text-[#23A55A]") : "text-[#6D6F78]";
  if (level >= 1) return stepIndex <= level ? (stepIndex === level ? "text-amber-400" : "text-[#23A55A]") : "text-[#6D6F78]";
  return "text-[#6D6F78]";
}

export function AccountStanding({
  user,
  safety,
  violations,
}: {
  user: { id: number; name?: string | null; username?: string | null; avatar?: string | null };
  safety: AccountSafetyDTO;
  violations: SafetyViolationDTO[];
}) {
  const level = LEVEL_BY_STATUS[safety.accountStatus];
  const suspended = safety.accountStatus === "suspended";
  const banned = safety.accountStatus === "permanently_banned";

  const title = banned
    ? "Sua conta está permanentemente banida"
    : suspended
      ? "Sua conta está suspensa"
      : level >= 3
        ? "Sua conta está em risco"
        : level === 2
          ? "Sua conta está muito limitada"
          : level === 1
            ? "Sua conta possui limitações"
            : "Sua conta está toda em ordem";

  const highlightClass =
    banned || suspended
      ? "text-red-400"
      : level >= 3
        ? "text-orange-400"
        : level > 0
          ? "text-amber-400"
          : "text-[#23A55A]";
  const plainTitle = title.replace(/(toda em ordem|possui limitações|muito limitada|em risco|suspensa|permanentemente banida)/, "");

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="shrink-0">
          <Avatar
            userId={user.id}
            name={user.name ?? user.username}
            src={user.avatar ?? null}
            size="lg"
            showStatus={false}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold leading-snug">
            {plainTitle}
            <span className={highlightClass}>{title.slice(plainTitle.length)}</span>
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-muted2">
            {level === 0 && !banned && !suspended ? (
              <>
                Obrigado por respeitar os{" "}
                <Link to="/legal/terms" className="chat-link font-semibold">
                  Termos de Serviço
                </Link>{" "}
                e as{" "}
                <Link to="/legal/guidelines" className="chat-link font-semibold">
                  Diretrizes da Comunidade
                </Link>{" "}
                do Nexora. Se você infringir as regras, isso será exibido aqui.
              </>
            ) : banned ? (
              <>Sua conta foi encerrada permanentemente após atingir o limite de infrações graves confirmadas.</>
            ) : suspended ? (
              <>Sua conta está temporariamente impedida de utilizar determinadas funcionalidades do Nexora.</>
            ) : level >= 3 ? (
              <>Sua conta está próxima de ser permanentemente banida. Uma nova infração grave confirmada poderá resultar no encerramento permanente.</>
            ) : level === 2 ? (
              <>Sua conta possui múltiplas violações. Novas infrações poderão resultar em restrições mais severas.</>
            ) : (
              <>Detectamos uma violação das regras do Nexora. Algumas funcionalidades podem estar limitadas.</>
            )}
          </p>

          {(suspended || banned) && (
            <SuspensionCountdown until={safety.suspendedUntil} banned={banned} />
          )}

          {/* Desktop: horizontal tracker · Mobile: vertical list */}
          <AccountStatusProgress level={level} />
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-faint">
          Infrações da conta · {safety.severeStrikes} / {safety.maxSevereStrikes} graves confirmadas
        </p>
        {violations.filter(v => v.strikeApplied || v.status === "pending_review").length === 0 ? (
          <p className="rounded-lg bg-white/[0.04] px-3 py-2.5 text-xs text-muted2">
            Nenhuma infração ativa. Continue seguindo nossas Diretrizes da Comunidade.
          </p>
        ) : (
          <ul className="space-y-2">
            {violations
              .filter(v => v.strikeApplied || v.status === "pending_review")
              .map(v => (
                <li key={v.id}>
                  <ViolationCard violation={v} />
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SuspensionCountdown({
  until,
  banned,
}: {
  until: Date | string | null;
  banned: boolean;
}) {
  // Labels are computed inside a timer callback (never during render) so the
  // component stays pure; a placeholder shows before the first tick.
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    if (banned || !until) return;
    const target = new Date(until).getTime();
    const update = () => {
      const ms = target - Date.now();
      const days = Math.floor(ms / 86_400_000);
      const hours = Math.floor((ms % 86_400_000) / 3_600_000);
      const minutes = Math.max(0, Math.floor((ms % 3_600_000) / 60_000));
      setLabel(
        `${days > 0 ? `${days} ${days === 1 ? "dia" : "dias"}, ` : ""}${hours} ${hours === 1 ? "hora" : "horas"} e ${minutes} ${minutes === 1 ? "minuto" : "minutos"} restantes`
      );
    };
    const kick = window.setTimeout(() => {
      update();
      window.setInterval(update, 30_000);
    }, 0);
    return () => window.clearTimeout(kick);
  }, [until, banned]);

  if (banned) {
    return (
      <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-xs font-bold text-red-300">
        🚫 Banimento permanente
      </p>
    );
  }
  const target = until ? new Date(until) : null;
  if (!target) return null;

  const formatted = target.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-200">
      <p className="font-bold">Suspensão termina em:</p>
      <p>{formatted}</p>
      {label && <p className="mt-0.5 text-red-300/90">{label}</p>}
    </div>
  );
}

function AccountStatusProgress({ level }: { level: number }) {
  const active = Math.min(level, STEPS.length - 1);
  return (
    <>
      {/* Horizontal (sm+) */}
      <div
        className="mt-4 hidden items-start sm:flex"
        role="img"
        aria-label={`Nível da conta: ${STEPS[active].label}`}
      >
        {STEPS.map((step, i) => {
          const done = i < active || (i === 0 && level === 0);
          const current = i === active && !(level === 0);
          const tone = stepTone(i, level);
          return (
            <div key={step.id} className="flex min-w-0 flex-1 items-center last:flex-none">
              <div className="flex w-16 shrink-0 flex-col items-center gap-1">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border-2 text-sm transition-colors duration-300",
                    i <= active
                      ? cn(
                          i === 0 && level === 0
                            ? "border-[#23A55A]"
                            : current
                              ? level >= 3
                                ? "border-red-400"
                                : "border-amber-400"
                              : "border-[#23A55A]",
                          tone
                        )
                      : "border-[#3F4147] text-transparent",
                    current && "bg-white/[0.06]"
                  )}
                >
                  {i === 0 && level === 0 ? "✓" : done || current ? step.icon : ""}
                </span>
                <span
                  className={cn(
                    "max-w-full truncate text-center text-[10px] font-semibold leading-tight",
                    i <= active ? "text-bodyx" : "text-[#6D6F78]"
                  )}
                >
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <span
                  className={cn(
                    "-mt-5 h-0.5 flex-1 rounded-full transition-colors duration-300",
                    i < active ? "bg-[#23A55A]/70" : "bg-[#3F4147]"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Vertical (mobile) */}
      <ol className="mt-4 space-y-0 sm:hidden">
        {STEPS.map((step, i) => {
          const isLast = i === STEPS.length - 1;
          const reached = i <= Math.min(level, STEPS.length - 1);
          return (
            <li key={step.id} className="flex gap-2.5">
              <div className="flex flex-col items-center">
                <span
                  aria-hidden
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs",
                    reached
                      ? i === 0 && level === 0
                        ? "border-[#23A55A] text-[#23A55A]"
                        : i === Math.min(level, STEPS.length - 1)
                          ? level >= 3
                            ? "border-red-400 text-red-400"
                            : "border-amber-400 text-amber-400"
                          : "border-[#23A55A] text-[#23A55A]"
                      : "border-[#3F4147]"
                  )}
                >
                  {reached ? (i === 0 && level === 0 ? "✓" : step.icon) : ""}
                </span>
                {!isLast && <span className="my-0.5 w-0.5 flex-1 bg-[#3F4147]" />}
              </div>
              <span
                className={cn(
                  "pb-3 text-xs font-semibold",
                  reached ? "text-bodyx" : "text-[#6D6F78]"
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </>
  );
}

const ACTION_LABELS: Record<SafetyViolationDTO["action"], string> = {
  none: "Sem ação adicional",
  warning: "Advertência",
  limited: "Funcionalidades limitadas",
  content_blocked: "Conteúdo bloqueado",
  three_day_suspension: "Suspensão de 3 dias",
  temporary_suspension: "Suspensão temporária",
  permanent_ban: "Banimento permanente",
};

const STATUS_LABELS: Record<SafetyViolationDTO["status"], string> = {
  pending_review: "Em análise",
  confirmed: "Confirmada",
  false_positive: "Falso positivo",
  resolved: "Resolvida",
};

export function ViolationCard({ violation }: { violation: SafetyViolationDTO }) {
  const pending = violation.status === "pending_review";
  const severeLabel =
    violation.category === "sexual_minor"
      ? "Conteúdo sexual envolvendo possível menor"
      : violation.category === "sexual_minor_violation"
        ? "Violação grave de segurança"
        : "Violação das diretrizes";

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5">
      <p className="flex items-center gap-1.5 text-sm font-bold">
        <span aria-hidden>⚠️</span>
        Infração {violation.severity === "severe" ? "grave" : violation.severity}
        {pending && (
          <span className="ml-auto rounded-md bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-300">
            Em análise
          </span>
        )}
      </p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="font-semibold text-faint">Data:</dt>
        <dd>{new Date(violation.createdAt).toLocaleDateString("pt-BR")}</dd>
        <dt className="font-semibold text-faint">Motivo:</dt>
        <dd>{violation.category === "manual_moderator_action" ? "Decisão da moderação" : severeLabel}</dd>
        <dt className="font-semibold text-faint">Ação:</dt>
        <dd>{ACTION_LABELS[violation.action]}</dd>
        <dt className="font-semibold text-faint">Status:</dt>
        <dd>{STATUS_LABELS[violation.status]}</dd>
      </dl>
    </div>
  );
}
