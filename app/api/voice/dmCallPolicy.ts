export const DM_UNANSWERED_TIMEOUT_MS = 120_000;

export type DmCallEndReason =
  | "unanswered"
  | "declined"
  | "cancelled"
  | "completed";

export function isDmCallAnswered(participantsEver: ReadonlySet<number>) {
  return participantsEver.size >= 2;
}

export function allInviteesDeclined(
  invitedUserIds: ReadonlySet<number>,
  declinedUserIds: ReadonlySet<number>
) {
  return (
    invitedUserIds.size > 0 &&
    [...invitedUserIds].every(userId => declinedUserIds.has(userId))
  );
}

export function hasUnansweredCallExpired(input: {
  answered: boolean;
  startedAt: number;
  now: number;
}) {
  return (
    !input.answered && input.now - input.startedAt >= DM_UNANSWERED_TIMEOUT_MS
  );
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1_000));
  if (totalSeconds < 10) return "poucos segundos";
  if (totalSeconds < 60) return `${totalSeconds} segundos`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const minuteText = `${minutes} minuto${minutes === 1 ? "" : "s"}`;
  if (seconds === 0) return minuteText;
  return `${minuteText} e ${seconds} segundo${seconds === 1 ? "" : "s"}`;
}

export function formatDmCallHistory(input: {
  initiatorName: string;
  reason: DmCallEndReason;
  startedAt: number;
  endedAt: number;
}) {
  if (input.reason === "unanswered") {
    return `Chamada de ${input.initiatorName} não atendida.`;
  }
  if (input.reason === "declined") {
    return `Chamada de ${input.initiatorName} recusada.`;
  }
  const duration = formatDuration(input.endedAt - input.startedAt);
  return `${input.initiatorName} iniciou uma chamada que durou ${duration}.`;
}
