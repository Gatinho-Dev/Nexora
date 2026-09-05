import { z } from "zod";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  lte,
  sql,
} from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "../middleware";
import { getDb } from "../queries/connection";
import * as schema from "@db/schema";
import {
  getMemberPermissions,
  requireChannelAccess,
  requireAnyPermission,
  requireMemberBelowActor,
  requirePermission,
} from "../utils/permissions";
import { logServerAudit } from "../services/serverAudit";
import {
  broadcastToChannel,
  broadcastToServer,
  sendToUsers,
  setLiveStageSpeaker,
  setLiveVoiceMuted,
} from "../realtime";
import { publicFileUrl } from "../lib/urls";
import { rateLimit } from "../utils/rateLimit";
import { RateLimits } from "@contracts/constants";
import { lastChannelMessageAt } from "../services/serverModeration";

const onboardingOptionSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(100),
  description: z.string().max(240).optional(),
  roleIds: z.array(z.number()).max(20).optional(),
  channelIds: z.array(z.number()).max(50).optional(),
  interests: z.array(z.string().min(1).max(48)).max(20).optional(),
});
const httpUrlSchema = z.string().url().max(800).refine(value => {
  const protocol = new URL(value).protocol;
  return protocol === "https:" || protocol === "http:";
}, "Use uma URL HTTP(S) válida.");

async function serverForChannel(channelId: number) {
  const channel = await getDb().query.channels.findFirst({
    where: eq(schema.channels.id, channelId),
  });
  if (!channel) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Canal não encontrado." });
  }
  return channel;
}

async function activeStage(channelId: number) {
  return getDb().query.stageSessions.findFirst({
    where: and(
      eq(schema.stageSessions.channelId, channelId),
      eq(schema.stageSessions.status, "ACTIVE"),
    ),
    orderBy: desc(schema.stageSessions.id),
  });
}

export const serverFeaturesRouter = createRouter({
  channelSettings: authedQuery
    .input(z.object({ channelId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { channel, perms } = await requireChannelAccess(ctx.user.id, input.channelId);
      const settings = await getDb().query.channelAdvancedSettings.findFirst({
        where: eq(schema.channelAdvancedSettings.channelId, channel.id),
      });
      const base = settings ?? {
        channelId: channel.id,
        slowModeSeconds: 0,
        forumView: "list" as const,
        forumRequireTag: channel.forcedTags,
        forumAutoArchiveHours: null,
        stageTopic: null,
        priorityAttenuation: 50,
      };
      const canBypass = perms.has("ADMINISTRATOR") || perms.has("BYPASS_SLOWMODE");
      const lastSentAt = canBypass || base.slowModeSeconds <= 0
        ? null
        : await lastChannelMessageAt(ctx.user.id, channel.id);
      return {
        ...base,
        slowModeRetryAt: lastSentAt
          ? new Date(lastSentAt.getTime() + base.slowModeSeconds * 1000)
          : null,
        canBypassSlowMode: canBypass,
      };
    }),

  updateChannelSettings: authedQuery
    .input(z.object({
      channelId: z.number(),
      slowModeSeconds: z.number().int().min(0).max(86_400),
      forumView: z.enum(["list", "cards", "compact"]),
      forumRequireTag: z.boolean(),
      forumAutoArchiveHours: z.number().int().min(1).max(8760).nullable(),
      stageTopic: z.string().max(180).nullable(),
      priorityAttenuation: z.number().int().min(0).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      const channel = await serverForChannel(input.channelId);
      await requirePermission(ctx.user.id, channel.serverId, "MANAGE_CHANNELS");
      await getDb().insert(schema.channelAdvancedSettings).values(input).onDuplicateKeyUpdate({ set: {
        slowModeSeconds: input.slowModeSeconds,
        forumView: input.forumView,
        forumRequireTag: input.forumRequireTag,
        forumAutoArchiveHours: input.forumAutoArchiveHours,
        stageTopic: input.stageTopic,
        priorityAttenuation: input.priorityAttenuation,
        updatedAt: new Date(),
      } });
      await logServerAudit({
        serverId: channel.serverId,
        actorUserId: ctx.user.id,
        action: "CHANNEL_ADVANCED_SETTINGS_UPDATE",
        targetType: "channel",
        targetId: channel.id,
        metadata: {
          slowModeSeconds: input.slowModeSeconds,
          forumView: input.forumView,
          forumRequireTag: input.forumRequireTag,
          forumAutoArchiveHours: input.forumAutoArchiveHours,
          priorityAttenuation: input.priorityAttenuation,
        },
      });
      await broadcastToServer(channel.serverId, { t: "server:refresh", serverId: channel.serverId });
      return { ok: true };
    }),

  forumTags: authedQuery
    .input(z.object({ channelId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { channel } = await requireChannelAccess(ctx.user.id, input.channelId);
      if (channel.type !== "FORUM" && channel.type !== "MEDIA") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Este canal não aceita tags de fórum." });
      }
      return getDb().select().from(schema.forumTags)
        .where(eq(schema.forumTags.channelId, channel.id))
        .orderBy(asc(schema.forumTags.position), asc(schema.forumTags.id));
    }),

  upsertForumTag: authedQuery
    .input(z.object({
      id: z.number().optional(),
      channelId: z.number(),
      name: z.string().min(1).max(32),
      color: z.string().regex(/^#[0-9a-f]{6}$/i),
      emoji: z.string().max(64).nullable(),
      position: z.number().int().min(0).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      const channel = await serverForChannel(input.channelId);
      await requireAnyPermission(ctx.user.id, channel.serverId, ["MANAGE_FORUMS", "MANAGE_CHANNELS"]);
      if (input.id) {
        const tag = await getDb().query.forumTags.findFirst({ where: and(
          eq(schema.forumTags.id, input.id),
          eq(schema.forumTags.channelId, channel.id),
        ) });
        if (!tag) throw new TRPCError({ code: "NOT_FOUND", message: "Tag não encontrada." });
        await getDb().update(schema.forumTags).set({
          name: input.name.trim(),
          color: input.color,
          emoji: input.emoji,
          position: input.position,
        }).where(eq(schema.forumTags.id, tag.id));
        return { id: tag.id };
      }
      const [{ id }] = await getDb().insert(schema.forumTags).values({
        channelId: channel.id,
        name: input.name.trim(),
        color: input.color,
        emoji: input.emoji,
        position: input.position,
      }).$returningId();
      await logServerAudit({ serverId: channel.serverId, actorUserId: ctx.user.id, action: "FORUM_TAG_CREATE", targetType: "forum_tag", targetId: id });
      return { id };
    }),

  deleteForumTag: authedQuery
    .input(z.object({ channelId: z.number(), tagId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const channel = await serverForChannel(input.channelId);
      await requireAnyPermission(ctx.user.id, channel.serverId, ["MANAGE_FORUMS", "MANAGE_CHANNELS"]);
      const tag = await getDb().query.forumTags.findFirst({ where: and(
        eq(schema.forumTags.id, input.tagId),
        eq(schema.forumTags.channelId, channel.id),
      ) });
      if (!tag) throw new TRPCError({ code: "NOT_FOUND", message: "Tag não encontrada." });
      await getDb().delete(schema.forumPostTags).where(eq(schema.forumPostTags.tagId, tag.id));
      await getDb().delete(schema.forumTags).where(eq(schema.forumTags.id, tag.id));
      await logServerAudit({ serverId: channel.serverId, actorUserId: ctx.user.id, action: "FORUM_TAG_DELETE", targetType: "forum_tag", targetId: tag.id });
      return { ok: true };
    }),

  forumPostMetadata: authedQuery
    .input(z.object({ messageId: z.number() }))
    .query(async ({ ctx, input }) => {
      const post = await getDb().query.forumPosts.findFirst({ where: eq(schema.forumPosts.messageId, input.messageId) });
      if (!post) return null;
      await requireChannelAccess(ctx.user.id, post.channelId);
      const rows = await getDb()
        .select({ tag: schema.forumTags })
        .from(schema.forumPostTags)
        .innerJoin(schema.forumTags, eq(schema.forumTags.id, schema.forumPostTags.tagId))
        .where(eq(schema.forumPostTags.postId, post.id));
      return { ...post, tags: rows.map(row => row.tag) };
    }),

  updateForumPost: authedQuery
    .input(z.object({
      messageId: z.number(),
      action: z.enum(["close", "reopen", "lock", "archive", "pin", "unpin", "delete"]),
      reason: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const post = await getDb().query.forumPosts.findFirst({ where: eq(schema.forumPosts.messageId, input.messageId) });
      if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Post não encontrado." });
      const { channel, perms } = await requireChannelAccess(ctx.user.id, post.channelId);
      const canManage = perms.has("ADMINISTRATOR") || perms.has("MANAGE_FORUMS");
      const isOwner = post.authorId === ctx.user.id;
      if (!canManage && !(isOwner && ["close", "reopen"].includes(input.action))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode gerenciar este post." });
      }
      if (input.action === "delete") {
        if (!canManage) throw new TRPCError({ code: "FORBIDDEN" });
        const replyRows = await getDb().select({ id: schema.messages.id }).from(schema.messages).where(eq(schema.messages.replyToId, post.messageId));
        const messageIds = [post.messageId, ...replyRows.map(row => row.id)];
        await getDb().delete(schema.attachments).where(inArray(schema.attachments.messageId, messageIds));
        await getDb().delete(schema.messageReactions).where(inArray(schema.messageReactions.messageId, messageIds));
        await getDb().delete(schema.forumPostTags).where(eq(schema.forumPostTags.postId, post.id));
        await getDb().delete(schema.messages).where(inArray(schema.messages.id, messageIds));
        await getDb().delete(schema.forumPosts).where(eq(schema.forumPosts.id, post.id));
      } else {
        const now = new Date();
        const status = input.action === "close" ? "CLOSED" as const
          : input.action === "reopen" ? "OPEN" as const
          : input.action === "lock" ? "LOCKED" as const
          : input.action === "archive" ? "ARCHIVED" as const
          : post.status;
        await getDb().update(schema.forumPosts).set({
          status,
          pinned: input.action === "pin" ? true : input.action === "unpin" ? false : post.pinned,
          closedAt: input.action === "close" ? now : input.action === "reopen" ? null : post.closedAt,
          archivedAt: input.action === "archive" ? now : input.action === "reopen" ? null : post.archivedAt,
          updatedAt: now,
        }).where(eq(schema.forumPosts.id, post.id));
      }
      await logServerAudit({
        serverId: channel.serverId,
        actorUserId: ctx.user.id,
        action: `FORUM_POST_${input.action.toUpperCase()}`,
        targetType: "forum_post",
        targetId: post.id,
        targetUserId: post.authorId,
        reason: input.reason ?? null,
      });
      await broadcastToChannel(channel.id, { t: "forum:refresh", channelId: channel.id });
      return { ok: true };
    }),

  events: authedQuery
    .input(z.object({ serverId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (!(await getMemberPermissions(ctx.user.id, input.serverId))) throw new TRPCError({ code: "FORBIDDEN" });
      const rows = await getDb()
        .select({ event: schema.serverEvents, details: schema.serverEventDetails })
        .from(schema.serverEvents)
        .leftJoin(schema.serverEventDetails, eq(schema.serverEventDetails.eventId, schema.serverEvents.id))
        .where(eq(schema.serverEvents.serverId, input.serverId))
        .orderBy(asc(schema.serverEvents.startsAt));
      const interests = rows.length ? await getDb().select().from(schema.serverEventInterests).where(inArray(schema.serverEventInterests.eventId, rows.map(row => row.event.id))) : [];
      return rows.map(row => ({
        ...row.event,
        ...row.details,
        effectiveStatus: row.event.status === "CANCELLED" ? "CANCELLED" as const
          : row.details?.endedAt ? "ENDED" as const
          : row.event.status,
        interestedCount: interests.filter(interest => interest.eventId === row.event.id).length,
        interested: interests.some(interest => interest.eventId === row.event.id && interest.userId === ctx.user.id),
      }));
    }),

  setEventInterest: authedQuery
    .input(z.object({ eventId: z.number(), interested: z.boolean(), reminderMinutes: z.number().int().min(0).max(10080).nullable() }))
    .mutation(async ({ ctx, input }) => {
      const event = await getDb().query.serverEvents.findFirst({ where: eq(schema.serverEvents.id, input.eventId) });
      if (!event || !(await getMemberPermissions(ctx.user.id, event.serverId))) throw new TRPCError({ code: "NOT_FOUND", message: "Evento não encontrado." });
      if (input.interested) await getDb().insert(schema.serverEventInterests).values({ eventId: event.id, userId: ctx.user.id, reminderMinutes: input.reminderMinutes }).onDuplicateKeyUpdate({ set: { reminderMinutes: input.reminderMinutes } });
      else await getDb().delete(schema.serverEventInterests).where(and(eq(schema.serverEventInterests.eventId, event.id), eq(schema.serverEventInterests.userId, ctx.user.id)));
      await broadcastToServer(event.serverId, { t: "events:refresh", serverId: event.serverId });
      return { ok: true };
    }),

  setEventStatus: authedQuery
    .input(z.object({ eventId: z.number(), status: z.enum(["SCHEDULED", "ACTIVE", "ENDED", "CANCELLED"]), reason: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const event = await getDb().query.serverEvents.findFirst({ where: eq(schema.serverEvents.id, input.eventId) });
      if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "Evento não encontrado." });
      await requireAnyPermission(ctx.user.id, event.serverId, ["MANAGE_EVENTS", "MANAGE_SERVER"]);
      await getDb().update(schema.serverEvents).set({ status: input.status === "ENDED" ? "ACTIVE" : input.status }).where(eq(schema.serverEvents.id, event.id));
      await getDb().insert(schema.serverEventDetails).values({
        eventId: event.id,
        endedAt: input.status === "ENDED" ? new Date() : null,
        timezone: "UTC",
      }).onDuplicateKeyUpdate({ set: { endedAt: input.status === "ENDED" ? new Date() : null, updatedAt: new Date() } });
      await logServerAudit({ serverId: event.serverId, actorUserId: ctx.user.id, action: `EVENT_${input.status}`, targetType: "event", targetId: event.id, reason: input.reason ?? null });
      await broadcastToServer(event.serverId, { t: "events:refresh", serverId: event.serverId });
      return { ok: true };
    }),

  stage: authedQuery
    .input(z.object({ channelId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { channel } = await requireChannelAccess(ctx.user.id, input.channelId);
      if (channel.type !== "STAGE") throw new TRPCError({ code: "BAD_REQUEST", message: "Este não é um canal Stage." });
      const session = await activeStage(channel.id);
      if (!session) return null;
      const participants = await getDb().select({ participant: schema.stageParticipants, user: schema.users }).from(schema.stageParticipants).innerJoin(schema.users, eq(schema.users.id, schema.stageParticipants.userId)).where(eq(schema.stageParticipants.sessionId, session.id)).orderBy(schema.stageParticipants.role, schema.stageParticipants.id);
      return { session, participants: participants.map(row => ({ ...row.participant, user: { id: row.user.id, username: row.user.username, name: row.user.name, avatar: row.user.avatar } })) };
    }),

  startStage: authedQuery
    .input(z.object({ channelId: z.number(), topic: z.string().min(1).max(180) }))
    .mutation(async ({ ctx, input }) => {
      const channel = await serverForChannel(input.channelId);
      if (channel.type !== "STAGE") throw new TRPCError({ code: "BAD_REQUEST", message: "Este não é um canal Stage." });
      await requireAnyPermission(ctx.user.id, channel.serverId, ["MANAGE_STAGE", "MANAGE_CHANNELS"]);
      if (await activeStage(channel.id)) throw new TRPCError({ code: "CONFLICT", message: "Já existe um Stage ativo neste canal." });
      const [{ id }] = await getDb().insert(schema.stageSessions).values({ serverId: channel.serverId, channelId: channel.id, topic: input.topic.trim(), createdByUserId: ctx.user.id }).$returningId();
      await getDb().insert(schema.stageParticipants).values({ sessionId: id, userId: ctx.user.id, role: "MODERATOR", requestState: "ACCEPTED" });
      await getDb().insert(schema.stageSpeakers).values({ channelId: channel.id, userId: ctx.user.id, grantedByUserId: ctx.user.id }).onDuplicateKeyUpdate({ set: { grantedByUserId: ctx.user.id, grantedAt: new Date() } });
      await setLiveStageSpeaker(channel.id, ctx.user.id, true);
      await logServerAudit({ serverId: channel.serverId, actorUserId: ctx.user.id, action: "STAGE_START", targetType: "stage", targetId: id, metadata: { topic: input.topic.trim() } });
      await broadcastToChannel(channel.id, { t: "stage:refresh", channelId: channel.id });
      return { id };
    }),

  endStage: authedQuery
    .input(z.object({ channelId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const channel = await serverForChannel(input.channelId);
      await requireAnyPermission(ctx.user.id, channel.serverId, ["MANAGE_STAGE", "MANAGE_CHANNELS"]);
      const session = await activeStage(channel.id);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Nenhum Stage ativo." });
      const participants = await getDb().select({ userId: schema.stageParticipants.userId }).from(schema.stageParticipants).where(eq(schema.stageParticipants.sessionId, session.id));
      await getDb().update(schema.stageSessions).set({ status: "ENDED", endedAt: new Date() }).where(eq(schema.stageSessions.id, session.id));
      await getDb().delete(schema.stageSpeakers).where(eq(schema.stageSpeakers.channelId, channel.id));
      await Promise.all(participants.map(participant => setLiveStageSpeaker(channel.id, participant.userId, false)));
      await logServerAudit({ serverId: channel.serverId, actorUserId: ctx.user.id, action: "STAGE_END", targetType: "stage", targetId: session.id });
      await broadcastToChannel(channel.id, { t: "stage:refresh", channelId: channel.id });
      return { ok: true };
    }),

  requestToSpeak: authedQuery
    .input(z.object({ channelId: z.number(), requested: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { channel, perms } = await requireChannelAccess(ctx.user.id, input.channelId);
      if (!perms.has("REQUEST_TO_SPEAK") && !perms.has("ADMINISTRATOR")) throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode pedir para falar." });
      const session = await activeStage(channel.id);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Nenhum Stage ativo." });
      await getDb().insert(schema.stageParticipants).values({
        sessionId: session.id,
        userId: ctx.user.id,
        role: "AUDIENCE",
        requestState: input.requested ? "PENDING" : "NONE",
        requestedAt: input.requested ? new Date() : null,
      }).onDuplicateKeyUpdate({ set: {
        requestState: input.requested ? "PENDING" : "NONE",
        requestedAt: input.requested ? new Date() : null,
        updatedAt: new Date(),
      } });
      const moderators = await getDb().select({ userId: schema.stageParticipants.userId }).from(schema.stageParticipants).where(and(eq(schema.stageParticipants.sessionId, session.id), eq(schema.stageParticipants.role, "MODERATOR")));
      if (input.requested) sendToUsers(moderators.map(row => row.userId), { t: "stage:request", channelId: channel.id, userId: ctx.user.id });
      await broadcastToChannel(channel.id, { t: "stage:refresh", channelId: channel.id });
      return { ok: true };
    }),

  moderateStageParticipant: authedQuery
    .input(z.object({ channelId: z.number(), userId: z.number(), action: z.enum(["accept", "reject", "audience", "mute", "remove"]) }))
    .mutation(async ({ ctx, input }) => {
      const channel = await serverForChannel(input.channelId);
      await requireAnyPermission(ctx.user.id, channel.serverId, ["MANAGE_STAGE", "MANAGE_CHANNELS"]);
      const session = await activeStage(channel.id);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Nenhum Stage ativo." });
      let participant = await getDb().query.stageParticipants.findFirst({ where: and(eq(schema.stageParticipants.sessionId, session.id), eq(schema.stageParticipants.userId, input.userId)) });
      if (!participant) {
        const member = await getDb().query.serverMembers.findFirst({ where: and(
          eq(schema.serverMembers.serverId, channel.serverId),
          eq(schema.serverMembers.userId, input.userId),
        ) });
        if (!member) throw new TRPCError({ code: "NOT_FOUND", message: "Participante não encontrado." });
        const [{ id }] = await getDb().insert(schema.stageParticipants).values({
          sessionId: session.id,
          userId: input.userId,
          role: "AUDIENCE",
          requestState: "NONE",
        }).$returningId();
        participant = await getDb().query.stageParticipants.findFirst({ where: eq(schema.stageParticipants.id, id) });
      }
      if (!participant) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível sincronizar o participante." });
      if (input.action === "remove") {
        await getDb().delete(schema.stageParticipants).where(eq(schema.stageParticipants.id, participant.id));
        await getDb().delete(schema.stageSpeakers).where(and(eq(schema.stageSpeakers.channelId, channel.id), eq(schema.stageSpeakers.userId, input.userId)));
        await setLiveStageSpeaker(channel.id, input.userId, false);
      } else {
        const promote = input.action === "accept";
        await getDb().update(schema.stageParticipants).set({
          role: promote ? "SPEAKER" : input.action === "audience" || input.action === "reject" ? "AUDIENCE" : participant.role,
          requestState: promote ? "ACCEPTED" : input.action === "reject" ? "REJECTED" : participant.requestState,
          muted: input.action === "mute" ? true : promote ? false : participant.muted,
          updatedAt: new Date(),
        }).where(eq(schema.stageParticipants.id, participant.id));
        if (promote) await getDb().insert(schema.stageSpeakers).values({ channelId: channel.id, userId: input.userId, grantedByUserId: ctx.user.id }).onDuplicateKeyUpdate({ set: { grantedByUserId: ctx.user.id, grantedAt: new Date() } });
        if (["audience", "reject"].includes(input.action)) await getDb().delete(schema.stageSpeakers).where(and(eq(schema.stageSpeakers.channelId, channel.id), eq(schema.stageSpeakers.userId, input.userId)));
        await setLiveStageSpeaker(channel.id, input.userId, promote);
        if (input.action === "mute") await setLiveVoiceMuted(channel.id, input.userId, true);
      }
      sendToUsers([input.userId], { t: "stage:moderation", channelId: channel.id, action: input.action });
      await logServerAudit({ serverId: channel.serverId, actorUserId: ctx.user.id, action: `STAGE_PARTICIPANT_${input.action.toUpperCase()}`, targetType: "member", targetUserId: input.userId, targetId: session.id });
      await broadcastToChannel(channel.id, { t: "stage:refresh", channelId: channel.id });
      return { ok: true };
    }),

  onboarding: authedQuery
    .input(z.object({ serverId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (!(await getMemberPermissions(ctx.user.id, input.serverId))) throw new TRPCError({ code: "FORBIDDEN" });
      const [config, questions, answers] = await Promise.all([
        getDb().query.onboardingConfigs.findFirst({ where: eq(schema.onboardingConfigs.serverId, input.serverId) }),
        getDb().select().from(schema.onboardingQuestions).where(eq(schema.onboardingQuestions.serverId, input.serverId)).orderBy(asc(schema.onboardingQuestions.position)),
        getDb().query.onboardingAnswers.findFirst({ where: and(eq(schema.onboardingAnswers.serverId, input.serverId), eq(schema.onboardingAnswers.userId, ctx.user.id)) }),
      ]);
      return { config: config ?? null, questions, answers: answers ?? null };
    }),

  updateOnboarding: authedQuery
    .input(z.object({
      serverId: z.number(),
      enabled: z.boolean(),
      welcomeTitle: z.string().max(120).nullable(),
      welcomeMessage: z.string().max(2000).nullable(),
      coverImageUrl: z.string().url().max(800).nullable(),
      requireRules: z.boolean(),
      questions: z.array(z.object({ prompt: z.string().min(1).max(240), options: z.array(onboardingOptionSchema).min(1).max(20), required: z.boolean(), multiple: z.boolean() })).max(20),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireAnyPermission(ctx.user.id, input.serverId, ["MANAGE_ONBOARDING", "MANAGE_SERVER"]);
      // An onboarding choice must never be able to assign a role or expose a
      // recommended channel belonging to another server.
      const roleIds = [...new Set(input.questions.flatMap(question =>
        question.options.flatMap(option => option.roleIds ?? []),
      ))];
      const channelIds = [...new Set(input.questions.flatMap(question =>
        question.options.flatMap(option => option.channelIds ?? []),
      ))];
      const [validRoles, validChannels] = await Promise.all([
        roleIds.length
          ? getDb().select({ id: schema.roles.id }).from(schema.roles).where(and(
              eq(schema.roles.serverId, input.serverId),
              inArray(schema.roles.id, roleIds),
            ))
          : [],
        channelIds.length
          ? getDb().select({ id: schema.channels.id }).from(schema.channels).where(and(
              eq(schema.channels.serverId, input.serverId),
              inArray(schema.channels.id, channelIds),
            ))
          : [],
      ]);
      if (validRoles.length !== roleIds.length || validChannels.length !== channelIds.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Uma opção de onboarding referencia um cargo ou canal inválido." });
      }
      await getDb().insert(schema.onboardingConfigs).values({
        serverId: input.serverId,
        enabled: input.enabled,
        welcomeTitle: input.welcomeTitle,
        welcomeMessage: input.welcomeMessage,
        coverImageUrl: input.coverImageUrl,
        requireRules: input.requireRules,
      }).onDuplicateKeyUpdate({ set: {
        enabled: input.enabled,
        welcomeTitle: input.welcomeTitle,
        welcomeMessage: input.welcomeMessage,
        coverImageUrl: input.coverImageUrl,
        requireRules: input.requireRules,
        updatedAt: new Date(),
      } });
      await getDb().delete(schema.onboardingQuestions).where(eq(schema.onboardingQuestions.serverId, input.serverId));
      if (input.questions.length) await getDb().insert(schema.onboardingQuestions).values(input.questions.map((question, position) => ({ serverId: input.serverId, ...question, position })));
      await logServerAudit({ serverId: input.serverId, actorUserId: ctx.user.id, action: "ONBOARDING_UPDATE", targetType: "server", targetId: input.serverId });
      await broadcastToServer(input.serverId, { t: "onboarding:refresh", serverId: input.serverId });
      return { ok: true };
    }),

  completeOnboarding: authedQuery
    .input(z.object({ serverId: z.number(), answers: z.record(z.string(), z.array(z.string().max(64)).max(20)) }))
    .mutation(async ({ ctx, input }) => {
      if (!(await getMemberPermissions(ctx.user.id, input.serverId))) throw new TRPCError({ code: "FORBIDDEN" });
      const questions = await getDb().select().from(schema.onboardingQuestions).where(eq(schema.onboardingQuestions.serverId, input.serverId));
      for (const question of questions) {
        const selected = input.answers[String(question.id)] ?? [];
        if (question.required && selected.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: `Responda: ${question.prompt}` });
        if (!question.multiple && selected.length > 1) throw new TRPCError({ code: "BAD_REQUEST", message: `Escolha apenas uma opção em: ${question.prompt}` });
        if (selected.some(id => !(question.options ?? []).some(option => option.id === id))) throw new TRPCError({ code: "BAD_REQUEST", message: "Uma resposta não pertence a esta pergunta." });
      }
      const selectedOptions = questions.flatMap(question => (question.options ?? []).filter(option => (input.answers[String(question.id)] ?? []).includes(option.id)));
      const interests = [...new Set(selectedOptions.flatMap(option => option.interests ?? []))];
      const roleIds = [...new Set(selectedOptions.flatMap(option => option.roleIds ?? []))];
      if (roleIds.length) {
        const validRoles = await getDb().select({ id: schema.roles.id }).from(schema.roles).where(and(eq(schema.roles.serverId, input.serverId), inArray(schema.roles.id, roleIds)));
        if (validRoles.length) await getDb().insert(schema.memberRoles).values(validRoles.map(role => ({ serverId: input.serverId, userId: ctx.user.id, roleId: role.id }))).onDuplicateKeyUpdate({ set: { userId: ctx.user.id } });
      }
      await getDb().insert(schema.onboardingAnswers).values({ serverId: input.serverId, userId: ctx.user.id, answers: input.answers, interests }).onDuplicateKeyUpdate({ set: { answers: input.answers, interests, completedAt: new Date(), updatedAt: new Date() } });
      await getDb().update(schema.serverMembers).set({ rulesAcceptedAt: new Date() }).where(and(eq(schema.serverMembers.serverId, input.serverId), eq(schema.serverMembers.userId, ctx.user.id)));
      await broadcastToServer(input.serverId, { t: "server:refresh", serverId: input.serverId });
      return { interests, recommendedChannelIds: [...new Set(selectedOptions.flatMap(option => option.channelIds ?? []))] };
    }),

  guide: authedQuery
    .input(z.object({ serverId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (!(await getMemberPermissions(ctx.user.id, input.serverId))) throw new TRPCError({ code: "FORBIDDEN" });
      return (await getDb().query.serverGuides.findFirst({ where: eq(schema.serverGuides.serverId, input.serverId) })) ?? {
        serverId: input.serverId, welcomeMessage: null, rules: [], resources: [], recommendedChannelIds: [], tasks: [], faq: [],
      };
    }),

  updateGuide: authedQuery
    .input(z.object({
      serverId: z.number(), welcomeMessage: z.string().max(2000).nullable(),
      rules: z.array(z.string().min(1).max(500)).max(50),
      resources: z.array(z.object({ label: z.string().min(1).max(80), url: httpUrlSchema })).max(50),
      recommendedChannelIds: z.array(z.number()).max(50),
      tasks: z.array(z.object({ id: z.string().min(1).max(64), label: z.string().min(1).max(160), channelId: z.number().optional() })).max(50),
      faq: z.array(z.object({ question: z.string().min(1).max(240), answer: z.string().min(1).max(1000) })).max(50),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireAnyPermission(ctx.user.id, input.serverId, ["MANAGE_ONBOARDING", "MANAGE_SERVER"]);
      const channelIds = [...new Set([
        ...input.recommendedChannelIds,
        ...input.tasks.flatMap(task => task.channelId == null ? [] : [task.channelId]),
      ])];
      if (channelIds.length) {
        const channels = await getDb().select({ id: schema.channels.id }).from(schema.channels).where(and(
          eq(schema.channels.serverId, input.serverId),
          inArray(schema.channels.id, channelIds),
        ));
        if (channels.length !== channelIds.length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Um canal recomendado ou de tarefa não pertence a este servidor." });
        }
      }
      await getDb().insert(schema.serverGuides).values(input).onDuplicateKeyUpdate({ set: { ...input, updatedAt: new Date() } });
      await logServerAudit({ serverId: input.serverId, actorUserId: ctx.user.id, action: "SERVER_GUIDE_UPDATE", targetType: "server", targetId: input.serverId });
      await broadcastToServer(input.serverId, { t: "onboarding:refresh", serverId: input.serverId });
      return { ok: true };
    }),

  community: authedQuery
    .input(z.object({ serverId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (!(await getMemberPermissions(ctx.user.id, input.serverId))) throw new TRPCError({ code: "FORBIDDEN" });
      return (await getDb().query.communitySettings.findFirst({ where: eq(schema.communitySettings.serverId, input.serverId) })) ?? null;
    }),

  updateCommunity: authedQuery
    .input(z.object({ serverId: z.number(), enabled: z.boolean(), rulesChannelId: z.number().nullable(), announcementChannelId: z.number().nullable(), spamProtectionEnabled: z.boolean(), minimumModerationEnabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await requireAnyPermission(ctx.user.id, input.serverId, ["MANAGE_COMMUNITY", "MANAGE_SERVER"]);
      if (input.enabled && (!input.rulesChannelId || !input.announcementChannelId || !input.spamProtectionEnabled || !input.minimumModerationEnabled)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Comunidade exige canal de regras, anúncios, moderação mínima e proteção contra spam." });
      }
      if (input.rulesChannelId || input.announcementChannelId) {
        const ids = [input.rulesChannelId, input.announcementChannelId].filter((id): id is number => id != null);
        const channels = await getDb().select().from(schema.channels).where(and(eq(schema.channels.serverId, input.serverId), inArray(schema.channels.id, ids)));
        if (channels.length !== new Set(ids).size) throw new TRPCError({ code: "BAD_REQUEST", message: "Um canal selecionado não pertence ao servidor." });
        const announcement = channels.find(channel => channel.id === input.announcementChannelId);
        if (announcement && announcement.type !== "ANNOUNCEMENT") throw new TRPCError({ code: "BAD_REQUEST", message: "Escolha um canal de anúncios válido." });
      }
      await getDb().insert(schema.communitySettings).values({ serverId: input.serverId, rulesChannelId: input.rulesChannelId, announcementChannelId: input.announcementChannelId, spamProtectionEnabled: input.spamProtectionEnabled, minimumModerationEnabled: input.minimumModerationEnabled, enabledAt: input.enabled ? new Date() : null }).onDuplicateKeyUpdate({ set: { rulesChannelId: input.rulesChannelId, announcementChannelId: input.announcementChannelId, spamProtectionEnabled: input.spamProtectionEnabled, minimumModerationEnabled: input.minimumModerationEnabled, enabledAt: input.enabled ? new Date() : null, updatedAt: new Date() } });
      await getDb().update(schema.servers).set({ communityEnabled: input.enabled }).where(eq(schema.servers.id, input.serverId));
      await logServerAudit({ serverId: input.serverId, actorUserId: ctx.user.id, action: input.enabled ? "COMMUNITY_ENABLE" : "COMMUNITY_DISABLE", targetType: "server", targetId: input.serverId });
      await broadcastToServer(input.serverId, { t: "server:refresh", serverId: input.serverId });
      return { ok: true };
    }),

  insights: authedQuery
    .input(z.object({ serverId: z.number(), from: z.string().datetime(), to: z.string().datetime() }))
    .query(async ({ ctx, input }) => {
      await requireAnyPermission(ctx.user.id, input.serverId, ["VIEW_SERVER_INSIGHTS", "MANAGE_SERVER"]);
      const from = new Date(input.from);
      const to = new Date(input.to);
      if (to <= from || to.getTime() - from.getTime() > 366 * 86_400_000) throw new TRPCError({ code: "BAD_REQUEST", message: "Período inválido." });
      const db = getDb();
      const channelRows = await db.select({ id: schema.channels.id }).from(schema.channels).where(eq(schema.channels.serverId, input.serverId));
      const channelIds = channelRows.map(row => row.id);
      const [memberCounts, messageCounts, eventCounts, inviteRows, daily] = await Promise.all([
        db.select({
          total: sql<number>`count(*)`,
          active: sql<number>`sum(case when ${schema.serverMembers.lastActiveAt} >= ${from} then 1 else 0 end)`,
          fresh: sql<number>`sum(case when ${schema.serverMembers.joinedAt} between ${from} and ${to} then 1 else 0 end)`,
        }).from(schema.serverMembers).where(eq(schema.serverMembers.serverId, input.serverId)),
        channelIds.length ? db.select({ messages: sql<number>`count(*)`, activeChannels: sql<number>`count(distinct ${schema.messages.channelId})`, authors: sql<number>`count(distinct ${schema.messages.authorId})` }).from(schema.messages).where(and(inArray(schema.messages.channelId, channelIds), gte(schema.messages.createdAt, from), lte(schema.messages.createdAt, to))) : Promise.resolve([{ messages: 0, activeChannels: 0, authors: 0 }]),
        db.select({ count: sql<number>`count(*)` }).from(schema.serverEvents).where(and(eq(schema.serverEvents.serverId, input.serverId), gte(schema.serverEvents.createdAt, from), lte(schema.serverEvents.createdAt, to))),
        db.select({ code: schema.invites.code, uses: schema.invites.uses }).from(schema.invites).where(eq(schema.invites.serverId, input.serverId)).orderBy(desc(schema.invites.uses)).limit(20),
        db.select().from(schema.serverInsights).where(and(eq(schema.serverInsights.serverId, input.serverId), gte(schema.serverInsights.day, from), lte(schema.serverInsights.day, to))).orderBy(asc(schema.serverInsights.day)),
      ]);
      const membersTotal = Number(memberCounts[0]?.total ?? 0);
      const activeMembers = Number(memberCounts[0]?.active ?? 0);
      return {
        summary: {
          membersTotal,
          activeMembers,
          retention: membersTotal ? Math.round((activeMembers / membersTotal) * 1000) / 10 : 0,
          newMembers: Number(memberCounts[0]?.fresh ?? 0),
          messages: Number(messageCounts[0]?.messages ?? 0),
          activeChannels: Number(messageCounts[0]?.activeChannels ?? 0),
          returningMembers: Number(messageCounts[0]?.authors ?? 0),
          events: Number(eventCounts[0]?.count ?? 0),
          inviteSources: inviteRows,
        },
        daily,
      };
    }),

  soundboard: authedQuery
    .input(z.object({ serverId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (!(await getMemberPermissions(ctx.user.id, input.serverId))) throw new TRPCError({ code: "FORBIDDEN" });
      const rows = await getDb().select({ sound: schema.soundboardSounds, favorite: schema.soundboardFavorites.id }).from(schema.soundboardSounds).leftJoin(schema.soundboardFavorites, and(eq(schema.soundboardFavorites.soundId, schema.soundboardSounds.id), eq(schema.soundboardFavorites.userId, ctx.user.id))).where(eq(schema.soundboardSounds.serverId, input.serverId)).orderBy(asc(schema.soundboardSounds.name));
      return rows.map(row => ({ ...row.sound, favorite: Boolean(row.favorite), url: publicFileUrl(row.sound.fileId) }));
    }),

  upsertSound: authedQuery
    .input(z.object({ id: z.number().optional(), serverId: z.number(), fileId: z.number(), name: z.string().min(1).max(64), emoji: z.string().max(64).nullable(), volume: z.number().int().min(0).max(100), durationMs: z.number().int().min(100).max(10_000) }))
    .mutation(async ({ ctx, input }) => {
      await requireAnyPermission(ctx.user.id, input.serverId, ["MANAGE_SOUNDBOARD", "MANAGE_SERVER"]);
      const file = await getDb().query.files.findFirst({ where: and(eq(schema.files.id, input.fileId), eq(schema.files.uploaderId, ctx.user.id)) });
      if (!file || !file.mimeType.startsWith("audio/")) throw new TRPCError({ code: "BAD_REQUEST", message: "Envie um arquivo de áudio válido." });
      if (input.id) {
        const sound = await getDb().query.soundboardSounds.findFirst({ where: and(eq(schema.soundboardSounds.id, input.id), eq(schema.soundboardSounds.serverId, input.serverId)) });
        if (!sound) throw new TRPCError({ code: "NOT_FOUND", message: "Som não encontrado." });
        await getDb().update(schema.soundboardSounds).set({ fileId: input.fileId, name: input.name, emoji: input.emoji, volume: input.volume, durationMs: input.durationMs }).where(eq(schema.soundboardSounds.id, sound.id));
        return { id: sound.id };
      }
      const [{ id }] = await getDb().insert(schema.soundboardSounds).values({ serverId: input.serverId, fileId: input.fileId, createdByUserId: ctx.user.id, name: input.name, emoji: input.emoji, volume: input.volume, durationMs: input.durationMs }).$returningId();
      await logServerAudit({ serverId: input.serverId, actorUserId: ctx.user.id, action: "SOUNDBOARD_SOUND_CREATE", targetType: "soundboard_sound", targetId: id });
      await broadcastToServer(input.serverId, { t: "soundboard:refresh", serverId: input.serverId });
      return { id };
    }),

  deleteSound: authedQuery
    .input(z.object({ serverId: z.number(), id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAnyPermission(ctx.user.id, input.serverId, ["MANAGE_SOUNDBOARD", "MANAGE_SERVER"]);
      const sound = await getDb().query.soundboardSounds.findFirst({ where: and(eq(schema.soundboardSounds.id, input.id), eq(schema.soundboardSounds.serverId, input.serverId)) });
      if (!sound) throw new TRPCError({ code: "NOT_FOUND", message: "Som não encontrado." });
      await getDb().delete(schema.soundboardFavorites).where(eq(schema.soundboardFavorites.soundId, sound.id));
      await getDb().delete(schema.soundboardSounds).where(eq(schema.soundboardSounds.id, sound.id));
      await logServerAudit({ serverId: input.serverId, actorUserId: ctx.user.id, action: "SOUNDBOARD_SOUND_DELETE", targetType: "soundboard_sound", targetId: sound.id });
      await broadcastToServer(input.serverId, { t: "soundboard:refresh", serverId: input.serverId });
      return { ok: true };
    }),

  playSound: authedQuery
    .input(z.object({ channelId: z.number(), soundId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      rateLimit(`soundboard:${ctx.user.id}`, RateLimits.soundboardPlay.limit, RateLimits.soundboardPlay.windowMs);
      const { channel, perms } = await requireChannelAccess(ctx.user.id, input.channelId);
      if (!["VOICE", "STAGE"].includes(channel.type)) throw new TRPCError({ code: "BAD_REQUEST", message: "Entre em um canal de voz para tocar sons." });
      if (!perms.has("USE_SOUNDBOARD") && !perms.has("ADMINISTRATOR")) throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode usar o Soundboard." });
      const sound = await getDb().query.soundboardSounds.findFirst({ where: and(eq(schema.soundboardSounds.id, input.soundId), eq(schema.soundboardSounds.serverId, channel.serverId)) });
      if (!sound) throw new TRPCError({ code: "NOT_FOUND", message: "Som não encontrado." });
      await broadcastToChannel(channel.id, { t: "soundboard:play", channelId: channel.id, soundId: sound.id, userId: ctx.user.id, url: publicFileUrl(sound.fileId), volume: sound.volume });
      return { ok: true };
    }),

  favoriteSound: authedQuery
    .input(z.object({ soundId: z.number(), favorite: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (input.favorite) await getDb().insert(schema.soundboardFavorites).values({ userId: ctx.user.id, soundId: input.soundId }).onDuplicateKeyUpdate({ set: { soundId: input.soundId } });
      else await getDb().delete(schema.soundboardFavorites).where(and(eq(schema.soundboardFavorites.userId, ctx.user.id), eq(schema.soundboardFavorites.soundId, input.soundId)));
      return { ok: true };
    }),

  audioClips: authedQuery.query(async ({ ctx }) => {
    const rows = await getDb().select({ clip: schema.audioClips, file: schema.files }).from(schema.audioClips).innerJoin(schema.files, eq(schema.files.id, schema.audioClips.fileId)).where(eq(schema.audioClips.userId, ctx.user.id)).orderBy(desc(schema.audioClips.id)).limit(100);
    return rows.map(row => ({ ...row.clip, url: publicFileUrl(row.file.id), filename: row.file.filename, mimeType: row.file.mimeType, size: row.file.size }));
  }),

  saveAudioClip: authedQuery
    .input(z.object({ id: z.number().optional(), fileId: z.number(), name: z.string().min(1).max(64), startMs: z.number().int().min(0), endMs: z.number().int().min(1), volume: z.number().int().min(0).max(100), waveform: z.array(z.number().min(0).max(1)).min(8).max(512) }).refine(value => value.endMs > value.startMs && value.endMs - value.startMs <= 60_000, "O clipe deve ter no máximo 60 segundos."))
    .mutation(async ({ ctx, input }) => {
      const file = await getDb().query.files.findFirst({ where: and(eq(schema.files.id, input.fileId), eq(schema.files.uploaderId, ctx.user.id)) });
      if (!file || !file.mimeType.startsWith("audio/")) throw new TRPCError({ code: "BAD_REQUEST", message: "Arquivo de áudio inválido." });
      if (input.id) {
        const clip = await getDb().query.audioClips.findFirst({ where: and(eq(schema.audioClips.id, input.id), eq(schema.audioClips.userId, ctx.user.id)) });
        if (!clip) throw new TRPCError({ code: "NOT_FOUND", message: "Clipe não encontrado." });
        await getDb().update(schema.audioClips).set({ fileId: input.fileId, name: input.name, startMs: input.startMs, endMs: input.endMs, volume: input.volume, waveform: input.waveform }).where(eq(schema.audioClips.id, clip.id));
        sendToUsers([ctx.user.id], { t: "preferences:refresh", scope: "audio-clips" });
        return { id: clip.id };
      }
      const [{ id }] = await getDb().insert(schema.audioClips).values({ userId: ctx.user.id, fileId: input.fileId, name: input.name, startMs: input.startMs, endMs: input.endMs, volume: input.volume, waveform: input.waveform }).$returningId();
      sendToUsers([ctx.user.id], { t: "preferences:refresh", scope: "audio-clips" });
      return { id };
    }),

  deleteAudioClip: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const clip = await getDb().query.audioClips.findFirst({ where: and(eq(schema.audioClips.id, input.id), eq(schema.audioClips.userId, ctx.user.id)) });
      if (!clip) throw new TRPCError({ code: "NOT_FOUND", message: "Clipe não encontrado." });
      await getDb().delete(schema.audioClips).where(eq(schema.audioClips.id, clip.id));
      sendToUsers([ctx.user.id], { t: "preferences:refresh", scope: "audio-clips" });
      return { ok: true };
    }),

  prioritySettings: authedQuery
    .input(z.object({ serverId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (!(await getMemberPermissions(ctx.user.id, input.serverId))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Você não participa deste servidor." });
      }
      return getDb().select().from(schema.voicePrioritySettings).where(and(
        eq(schema.voicePrioritySettings.serverId, input.serverId),
        eq(schema.voicePrioritySettings.enabled, true),
      ));
    }),

  setPrioritySpeaker: authedQuery
    .input(z.object({ serverId: z.number(), userId: z.number(), enabled: z.boolean(), attenuation: z.number().int().min(0).max(100) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, input.serverId, "MANAGE_ROLES");
      await requireMemberBelowActor(ctx.user.id, input.userId, input.serverId);
      const targetPerms = await getMemberPermissions(input.userId, input.serverId);
      if (!targetPerms?.has("PRIORITY_SPEAKER")) throw new TRPCError({ code: "BAD_REQUEST", message: "O usuário precisa da permissão Priority Speaker." });
      await getDb().insert(schema.voicePrioritySettings).values({ serverId: input.serverId, userId: input.userId, enabled: input.enabled, attenuation: input.attenuation }).onDuplicateKeyUpdate({ set: { enabled: input.enabled, attenuation: input.attenuation, updatedAt: new Date() } });
      await broadcastToServer(input.serverId, { t: "voice:priority", serverId: input.serverId, userId: input.userId, enabled: input.enabled, attenuation: input.attenuation });
      return { ok: true };
    }),
});
