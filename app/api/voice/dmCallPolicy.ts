export const DM_UNANSWERED_TIMEOUT_MS = 120_000;

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
