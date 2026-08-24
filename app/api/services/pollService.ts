import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import * as schema from "@db/schema";
import type { PollDTO } from "@contracts/types";

/**
 * pollService — enquetes reais com votos individuais no banco.
 * A chave única (pollId, userId, answerId) garante idempotência: retry de
 * voto nunca duplica. `allowMultiple=false` substitui o voto anterior.
 */

export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 10;
export const POLL_DURATIONS_HOURS = [1, 4, 8, 24, 72, 168] as const;

export async function createPoll(input: {
  messageId: number;
  createdByUserId: number;
  question: string;
  options: string[];
  allowMultiple: boolean;
  durationHours: number | null;
}): Promise<void> {
  const db = getDb();
  await db.transaction(async tx => {
    const [{ id: pollId }] = await tx
      .insert(schema.polls)
      .values({
        messageId: input.messageId,
        question: input.question,
        allowMultiple: input.allowMultiple,
        expiresAt: input.durationHours
          ? new Date(Date.now() + input.durationHours * 3_600_000)
          : null,
        createdByUserId: input.createdByUserId,
      })
      .$returningId();
    await tx.insert(schema.pollAnswers).values(
      input.options.map((text, position) => ({
        pollId,
        text,
        position,
      })),
    );
  });
}

/** Monta o DTO da enquete (com contagem de votos e votos do visualizador). */
export async function getPollForViewer(
  messageId: number,
  viewerId: number | null,
): Promise<PollDTO | null> {
  const db = getDb();
  const [poll] = await db
    .select()
    .from(schema.polls)
    .where(eq(schema.polls.messageId, messageId))
    .limit(1);
  if (!poll) return null;

  const answers = await db
    .select()
    .from(schema.pollAnswers)
    .where(eq(schema.pollAnswers.pollId, poll.id))
    .orderBy(schema.pollAnswers.position);

  const counts = await db
    .select({
      answerId: schema.pollVotes.answerId,
      votes: sql<number>`count(*)`,
    })
    .from(schema.pollVotes)
    .where(eq(schema.pollVotes.pollId, poll.id))
    .groupBy(schema.pollVotes.answerId);
  const countByAnswer = new Map(counts.map(c => [c.answerId, Number(c.votes)]));

  let myAnswerIds: number[] = [];
  if (viewerId) {
    const mine = await db
      .select({ answerId: schema.pollVotes.answerId })
      .from(schema.pollVotes)
      .where(
        and(
          eq(schema.pollVotes.pollId, poll.id),
          eq(schema.pollVotes.userId, viewerId),
        ),
      );
    myAnswerIds = mine.map(m => m.answerId);
  }

  return {
    id: poll.id,
    messageId: poll.messageId,
    question: poll.question,
    allowMultiple: poll.allowMultiple,
    expiresAt: poll.expiresAt,
    closedAt: poll.closedAt,
    answers: answers.map(a => ({
      id: a.id,
      text: a.text,
      votes: countByAnswer.get(a.id) ?? 0,
    })),
    totalVotes: [...countByAnswer.values()].reduce((a, b) => a + b, 0),
    myAnswerIds,
  };
}

/** Anexa enquetes a uma lista de mensagens (uma query por tabela). */
export async function attachPolls<T extends { id: number; poll?: PollDTO | null }>(
  messages: T[],
  viewerId: number | null,
): Promise<T[]> {
  const ids = messages.map(m => m.id);
  if (ids.length === 0) return messages;
  const db = getDb();
  const pollRows = await db
    .select()
    .from(schema.polls)
    .where(inArray(schema.polls.messageId, ids));
  if (pollRows.length === 0) return messages;

  const pollIds = pollRows.map(p => p.id);
  const answers = await db
    .select()
    .from(schema.pollAnswers)
    .where(inArray(schema.pollAnswers.pollId, pollIds))
    .orderBy(schema.pollAnswers.position);
  const counts = await db
    .select({
      pollId: schema.pollVotes.pollId,
      answerId: schema.pollVotes.answerId,
      votes: sql<number>`count(*)`,
    })
    .from(schema.pollVotes)
    .where(inArray(schema.pollVotes.pollId, pollIds))
    .groupBy(schema.pollVotes.pollId, schema.pollVotes.answerId);

  let mine: { pollId: number; answerId: number }[] = [];
  if (viewerId) {
    mine = await db
      .select({
        pollId: schema.pollVotes.pollId,
        answerId: schema.pollVotes.answerId,
      })
      .from(schema.pollVotes)
      .where(
        and(
          inArray(schema.pollVotes.pollId, pollIds),
          eq(schema.pollVotes.userId, viewerId),
        ),
      );
  }

  const pollByMessage = new Map(pollRows.map(p => [p.messageId, p]));
  for (const message of messages) {
    const poll = pollByMessage.get(message.id);
    if (!poll) continue;
    const pollAnswers = answers.filter(a => a.pollId === poll.id);
    const countByAnswer = new Map(
      counts
        .filter(c => c.pollId === poll.id)
        .map(c => [c.answerId, Number(c.votes)]),
    );
    message.poll = {
      id: poll.id,
      messageId: poll.messageId,
      question: poll.question,
      allowMultiple: poll.allowMultiple,
      expiresAt: poll.expiresAt,
      closedAt: poll.closedAt,
      answers: pollAnswers.map(a => ({
        id: a.id,
        text: a.text,
        votes: countByAnswer.get(a.id) ?? 0,
      })),
      totalVotes: [...countByAnswer.values()].reduce((a, b) => a + b, 0),
      myAnswerIds: mine
        .filter(m => m.pollId === poll.id)
        .map(m => m.answerId),
    };
  }
  return messages;
}

export type VoteResult = {
  poll: PollDTO;
  replaced: boolean;
};

/**
 * Registra votos. Sem allowMultiple: substitui o voto anterior (transação).
 * Enquete encerrada/expirada rejeita novos votos.
 */
export async function vote(input: {
  messageId: number;
  userId: number;
  answerIds: number[];
}): Promise<VoteResult | null> {
  const db = getDb();
  const [poll] = await db
    .select()
    .from(schema.polls)
    .where(eq(schema.polls.messageId, input.messageId))
    .limit(1);
  if (!poll) return null;
  if (poll.closedAt || (poll.expiresAt && poll.expiresAt <= new Date())) {
    throw new Error("Esta enquete já foi encerrada.");
  }

  const answers = await db
    .select()
    .from(schema.pollAnswers)
    .where(eq(schema.pollAnswers.pollId, poll.id));
  const validIds = new Set(answers.map(a => a.id));
  const requested = [...new Set(input.answerIds)];
  if (requested.length === 0 || requested.some(id => !validIds.has(id))) {
    throw new Error("Resposta inválida.");
  }
  if (!poll.allowMultiple && requested.length > 1) {
    throw new Error("Esta enquete aceita apenas uma resposta.");
  }

  let replaced = false;
  await db.transaction(async tx => {
    const previous = await tx
      .select()
      .from(schema.pollVotes)
      .where(
        and(
          eq(schema.pollVotes.pollId, poll.id),
          eq(schema.pollVotes.userId, input.userId),
        ),
      );
    const keep = new Set(requested);
    const toDelete = previous.filter(v => !keep.has(v.answerId));
    if (toDelete.length > 0) replaced = true;
    if (!poll.allowMultiple && previous.length > 0) replaced = true;
    if (toDelete.length > 0) {
      await tx.delete(schema.pollVotes).where(
        inArray(
          schema.pollVotes.id,
          toDelete.map(v => v.id),
        ),
      );
    }
    for (const answerId of requested) {
      await tx
        .insert(schema.pollVotes)
        .values({ pollId: poll.id, answerId, userId: input.userId })
        .onDuplicateKeyUpdate({ set: { answerId } });
    }
  });

  const pollDto = await getPollForViewer(input.messageId, input.userId);
  if (!pollDto) return null;
  return { poll: pollDto, replaced };
}

/** Encerra antecipadamente (autor ou MANAGE_MESSAGES). */
export async function closePoll(
  messageId: number,
): Promise<PollDTO | null> {
  const db = getDb();
  await db
    .update(schema.polls)
    .set({ closedAt: new Date() })
    .where(eq(schema.polls.messageId, messageId));
  return getPollForViewer(messageId, null);
}

export async function getPollOwner(messageId: number): Promise<number | null> {
  const [poll] = await getDb()
    .select({ createdByUserId: schema.polls.createdByUserId })
    .from(schema.polls)
    .where(eq(schema.polls.messageId, messageId))
    .limit(1);
  return poll?.createdByUserId ?? null;
}
