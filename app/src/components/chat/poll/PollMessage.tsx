import { useEffect, useState } from "react";
import { BarChart3, Check, Crown, LoaderCircle, Square } from "lucide-react";
import { cn } from "@/lib/utils";

export type PollData = {
  id: number;
  question: string;
  allowMultiple: boolean;
  expiresAt: string | Date | null;
  closedAt: string | Date | null;
  answers: { id: number; text: string; votes: number }[];
  totalVotes: number;
  myAnswerIds: number[];
};

type PollMessageProps = {
  poll: PollData;
  onVote: (answerIds: number[]) => void;
  onClose: () => void;
  busy?: boolean;
  canClose?: boolean;
};

function toDate(value: string | Date | null): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function formatRemaining(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}

export function PollMessage({
  poll,
  onVote,
  onClose,
  busy = false,
  canClose = false,
}: PollMessageProps) {
  const [nowTick, setNowTick] = useState(0);
  const [nowBase] = useState(() => Date.now());
  const now = nowBase + nowTick * 30000;

  const expiresAt = toDate(poll.expiresAt);
  const isClosed =
    poll.closedAt != null || (expiresAt != null && expiresAt.getTime() <= now);
  const remainingLabel =
    isClosed || !expiresAt
      ? ""
      : `Termina em ${formatRemaining(expiresAt.getTime() - now)}`;

  useEffect(() => {
    if (isClosed || !expiresAt) return;
    const timer = setInterval(() => setNowTick(t => t + 1), 30000);
    return () => clearInterval(timer);
  }, [isClosed, expiresAt]);

  const totalVotes = Math.max(poll.totalVotes, 0);
  const maxVotes = poll.answers.reduce((max, a) => Math.max(max, a.votes), 0);

  const handleVote = (answerId: number) => {
    if (busy || isClosed) return;
    if (poll.allowMultiple) {
      if (poll.myAnswerIds.includes(answerId)) {
        onVote(poll.myAnswerIds.filter(id => id !== answerId));
      } else {
        onVote([...poll.myAnswerIds, answerId]);
      }
    } else {
      onVote(
        poll.myAnswerIds.includes(answerId)
          ? []
          : [answerId],
      );
    }
  };

  return (
    <div className="w-full max-w-md overflow-hidden rounded-lg border border-white/10 bg-[#2b2d31]">
      <div className="flex items-start gap-2 p-3 pb-2">
        <BarChart3 className="mt-0.5 size-5 shrink-0 text-[#5865F2]" />
        <div className="min-w-0 flex-1">
          <span className="mr-2 inline-flex items-center rounded-full bg-[#5865F2]/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#5865F2]">
            Enquete
          </span>
          <p className="break-words font-bold text-white">{poll.question}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2 px-3 pb-2">
        {poll.answers.map(answer => {
          const voted = poll.myAnswerIds.includes(answer.id);
          const percent =
            totalVotes > 0
              ? Math.round((answer.votes / totalVotes) * 100)
              : 0;
          const winner =
            isClosed && answer.votes > 0 && answer.votes === maxVotes;

          return (
            <button
              key={answer.id}
              type="button"
              onClick={() => handleVote(answer.id)}
              disabled={busy || isClosed}
              aria-pressed={voted}
              aria-label={`Votar em: ${answer.text}`}
              className={cn(
                "relative flex w-full items-center gap-3 overflow-hidden rounded-md border px-3 py-2.5 text-left transition-all duration-200",
                voted
                  ? "border-[#5865F2]/60 bg-[#5865F2]/20"
                  : "border-white/10 bg-[#24262c]",
                !busy && !isClosed
                  ? "hover:border-[#5865F2]/40 hover:bg-[#5865F2]/10"
                  : "cursor-default opacity-90",
                busy && "opacity-60",
              )}
            >
              {totalVotes > 0 && (
                <div
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 rounded-md bg-[#5865F2]/25 transition-all duration-200"
                  style={{ width: `${percent}%` }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center border transition-all duration-200",
                    poll.allowMultiple ? "rounded-sm" : "rounded-full",
                    voted
                      ? "border-[#5865F2] bg-[#5865F2]"
                      : "border-white/40",
                  )}
                >
                  {voted &&
                    (poll.allowMultiple ? (
                      <Check className="size-3 text-white" />
                    ) : (
                      <span className="size-1.5 rounded-full bg-white" />
                    ))}
                </span>
                {winner && <Crown className="size-4 shrink-0 text-yellow-400" />}
                <span
                  className={cn(
                    "text-sm break-words",
                    winner ? "font-semibold text-white" : "text-white/90",
                  )}
                >
                  {answer.text}
                </span>
              </span>
              <span className="relative z-10 ml-auto pl-2 text-sm tabular-nums text-white/70">
                {percent}%
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/10 px-3 py-2">
        <span className="text-xs text-white/50">{totalVotes} votos</span>
        <span className="text-xs text-white/50">
          {isClosed ? "Enquete encerrada" : remainingLabel}
        </span>
        {!poll.allowMultiple && (
          <span className="text-xs text-white/30">Escolha única</span>
        )}
        {canClose && !isClosed && (
          <ButtonClose onClick={onClose} disabled={busy} />
        )}
      </div>
    </div>
  );
}

function ButtonClose({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Encerrar enquete"
      className="ml-auto inline-flex min-h-[24px] items-center gap-1 rounded border border-white/10 px-2 py-0.5 text-xs text-white/60 transition-all duration-200 hover:bg-white/5 hover:text-white disabled:opacity-50"
    >
      {disabled ? (
        <LoaderCircle className="size-3 animate-spin" />
      ) : (
        <Square className="size-3" />
      )}
      Encerrar enquete
    </button>
  );
}
