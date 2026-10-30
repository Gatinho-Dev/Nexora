import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import { requirePermission, getMemberPermissions } from "./utils/permissions";
import { broadcastToServer } from "./realtime";
import { logServerAudit } from "./services/serverAudit";

function buildTriggerConfig(type: string): z.ZodObject<any> {
  const base = z.object({});
  switch (type) {
    case "message_create":
    case "message_update":
    case "message_delete":
      return base.extend({
        channelIds: z.array(z.number()).optional(),
        keywords: z.array(z.string()).optional(),
        authorRoleIds: z.array(z.number()).optional(),
        ignoreBots: z.boolean().default(true),
      });
    case "member_join":
    case "member_leave":
    case "member_ban":
    case "member_timeout":
      return z.object({});
    case "role_create":
    case "role_update":
    case "role_delete":
      return z.object({});
    case "channel_create":
    case "channel_update":
    case "channel_delete":
      return z.object({});
    case "reaction_add":
    case "reaction_remove":
      return base.extend({
        emoji: z.string().optional(),
        channelIds: z.array(z.number()).optional(),
      });
    case "voice_join":
    case "voice_leave":
    case "voice_switch":
      return base.extend({ channelIds: z.array(z.number()).optional() });
    case "scheduled":
      return base.extend({
        cron: z.string(),
        timezone: z.string().default("UTC"),
      });
    case "webhook":
      return base.extend({ secret: z.string().optional() });
    case "command":
      return base.extend({
        name: z.string().min(1).max(32),
        description: z.string().max(100).optional(),
        options: z
          .array(
            z.object({
              name: z.string().min(1).max(32),
              type: z.enum(["string", "number", "boolean", "user", "channel", "role"]),
              description: z.string().max(100),
              required: z.boolean().default(false),
            })
          )
          .optional(),
      });
    default:
      return z.object({});
  }
}

function buildActionConfig(type: string): z.ZodObject<any> {
  switch (type) {
    case "send_message":
    case "reply":
      return z.object({
        channelId: z.number().optional(),
        content: z.string().min(1).max(4000),
        replyToId: z.number().optional(),
      });
    case "send_embed":
      return z.object({
        channelId: z.number(),
        title: z.string().max(256).optional(),
        description: z.string().max(4096).optional(),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
        fields: z
          .array(
            z.object({
              name: z.string().max(256),
              value: z.string().max(1024),
              inline: z.boolean().default(false),
            })
          )
          .max(25)
          .optional(),
        footer: z.string().max(2048).optional(),
        imageUrl: z.string().url().optional(),
        thumbnailUrl: z.string().url().optional(),
      });
    case "edit_message":
      return z.object({ messageId: z.number(), content: z.string().min(1).max(4000) });
    case "delete_message":
      return z.object({ messageId: z.number() });
    case "add_role":
    case "remove_role":
      return z.object({ userId: z.number(), roleId: z.number() });
    case "timeout_member":
      return z.object({
        userId: z.number(),
        durationMinutes: z.number().int().min(1).max(28 * 24 * 60),
        reason: z.string().max(500).optional(),
      });
    case "kick_member":
      return z.object({ userId: z.number(), reason: z.string().max(500).optional() });
    case "ban_member":
      return z.object({ userId: z.number(), reason: z.string().max(500).optional() });
    case "create_channel":
      return z.object({
        name: z.string().min(1).max(64),
        type: z.enum(["TEXT", "VOICE", "FORUM", "STAGE"]),
        categoryId: z.number().optional(),
      });
    case "delete_channel":
      return z.object({ channelId: z.number() });
    case "send_dm":
      return z.object({ userId: z.number(), content: z.string().min(1).max(4000) });
    case "webhook_call":
      return z.object({
        url: z.string().url(),
        method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("POST"),
        headers: z.record(z.string(), z.string()).optional(),
        body: z.record(z.string(), z.unknown()).optional(),
      });
    case "run_code":
      return z.object({ code: z.string().max(5000) });
    case "delay":
      return z.object({ milliseconds: z.number().int().min(100).max(300000) });
    case "conditional_branch":
      return z.object({
        condition: z.string().max(500),
        trueActionId: z.number().optional(),
        falseActionId: z.number().optional(),
      });
    case "log_audit":
      return z.object({ action: z.string().max(64), metadata: z.record(z.string(), z.unknown()).optional() });
    default:
      return z.object({});
  }
}

async function getBotOr404(botId: number) {
  const bot = await getDb().query.bots.findFirst({
    where: eq(schema.bots.id, botId),
  });
  if (!bot) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Bot não encontrado." });
  }
  return bot;
}

async function requireBotPermission(userId: number, serverId: number) {
  await requirePermission(userId, serverId, "MANAGE_SERVER");
}

async function requireBotOwnerOrManage(userId: number, botId: number) {
  const bot = await getBotOr404(botId);
  const perms = await getMemberPermissions(userId, bot.serverId);
  if (!perms) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Você não é membro deste servidor." });
  }
  const isOwner = bot.createdByUserId === userId;
  const canManage = perms.has("MANAGE_SERVER") || perms.has("ADMINISTRATOR");
  if (!isOwner && !canManage) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Você não tem permissão para gerenciar este bot.",
    });
  }
  return bot;
}


export const botRouter = createRouter({
  list: authedQuery
    .input(z.object({ serverId: z.number() }))
    .query(async ({ ctx, input }) => {
      const perms = await getMemberPermissions(ctx.user.id, input.serverId);
      if (!perms) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Você não é membro deste servidor." });
      }
      const db = getDb();
      const bots = await db
        .select()
        .from(schema.bots)
        .where(eq(schema.bots.serverId, input.serverId))
        .orderBy(desc(schema.bots.createdAt));
      return bots;
    }),

  get: authedQuery
    .input(z.object({ botId: z.number() }))
    .query(async ({ ctx, input }) => {
      const bot = await requireBotOwnerOrManage(ctx.user.id, input.botId);
      const db = getDb();
      const [triggers, actions, nodes, edges] = await Promise.all([
        db
          .select()
          .from(schema.botTriggers)
          .where(eq(schema.botTriggers.botId, bot.id))
          .orderBy(schema.botTriggers.position),
        db
          .select()
          .from(schema.botActions)
          .where(eq(schema.botActions.botId, bot.id))
          .orderBy(schema.botActions.position),
        db.select().from(schema.botNodes).where(eq(schema.botNodes.botId, bot.id)),
        db.select().from(schema.botEdges).where(eq(schema.botEdges.botId, bot.id)),
      ]);
      return { bot, triggers, actions, nodes, edges };
    }),

  create: authedQuery
    .input(
      z.object({
        serverId: z.number(),
        name: z.string().min(1, "Dê um nome ao bot.").max(80),
        description: z.string().max(500).optional(),
        avatarUrl: z.string().max(500).optional(),
        mode: z.enum(["simple", "advanced"]).default("simple"),
        code: z.string().max(10000).optional(),
        nodesConfig: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireBotPermission(ctx.user.id, input.serverId);
      const db = getDb();
      const [{ id }] = await db
        .insert(schema.bots)
        .values({
          serverId: input.serverId,
          name: input.name,
          description: input.description ?? null,
          avatarUrl: input.avatarUrl ?? null,
          mode: input.mode,
          code: input.code ?? null,
          nodesConfig: input.nodesConfig ?? null,
          createdByUserId: ctx.user.id,
        })
        .$returningId();
      await logServerAudit({
        serverId: input.serverId,
        actorUserId: ctx.user.id,
        action: "BOT_CREATE",
        targetType: "bot",
        targetId: id,
        metadata: { name: input.name, mode: input.mode },
      });
      await broadcastToServer(input.serverId, { t: "server:refresh", serverId: input.serverId });
      return { id };
    }),

  update: authedQuery
    .input(
      z.object({
        botId: z.number(),
        name: z.string().min(1).max(80).optional(),
        description: z.string().max(500).nullable().optional(),
        avatarUrl: z.string().max(500).nullable().optional(),
        mode: z.enum(["simple", "advanced"]).optional(),
        enabled: z.boolean().optional(),
        code: z.string().max(10000).nullable().optional(),
        nodesConfig: z.record(z.string(), z.unknown()).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const bot = await requireBotOwnerOrManage(ctx.user.id, input.botId);
      const { botId, ...patch } = input;
      const db = getDb();
      await db.update(schema.bots).set(patch).where(eq(schema.bots.id, botId));
      await logServerAudit({
        serverId: bot.serverId,
        actorUserId: ctx.user.id,
        action: "BOT_UPDATE",
        targetType: "bot",
        targetId: botId,
        metadata: { fields: Object.keys(patch) },
      });
      await broadcastToServer(bot.serverId, { t: "server:refresh", serverId: bot.serverId });
      return { ok: true };
    }),

  delete: authedQuery
    .input(z.object({ botId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const bot = await requireBotOwnerOrManage(ctx.user.id, input.botId);
      const db = getDb();
      await db.transaction(async (tx) => {
        await tx.delete(schema.botExecutions).where(eq(schema.botExecutions.botId, input.botId));
        await tx.delete(schema.botEdges).where(eq(schema.botEdges.botId, input.botId));
        await tx.delete(schema.botNodes).where(eq(schema.botNodes.botId, input.botId));
        await tx.delete(schema.botActions).where(eq(schema.botActions.botId, input.botId));
        await tx.delete(schema.botTriggers).where(eq(schema.botTriggers.botId, input.botId));
        await tx.delete(schema.bots).where(eq(schema.bots.id, input.botId));
      });
      await logServerAudit({
        serverId: bot.serverId,
        actorUserId: ctx.user.id,
        action: "BOT_DELETE",
        targetType: "bot",
        targetId: input.botId,
        metadata: { name: bot.name },
      });
      await broadcastToServer(bot.serverId, { t: "server:refresh", serverId: bot.serverId });
      return { ok: true };
    }),

  toggle: authedQuery
    .input(z.object({ botId: z.number(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const bot = await requireBotOwnerOrManage(ctx.user.id, input.botId);
      const db = getDb();
      await db.update(schema.bots).set({ enabled: input.enabled }).where(eq(schema.bots.id, input.botId));
      await logServerAudit({
        serverId: bot.serverId,
        actorUserId: ctx.user.id,
        action: input.enabled ? "BOT_ENABLE" : "BOT_DISABLE",
        targetType: "bot",
        targetId: input.botId,
      });
      await broadcastToServer(bot.serverId, { t: "server:refresh", serverId: bot.serverId });
      return { ok: true };
    }),

  createTrigger: authedQuery
    .input(
      z.object({
        botId: z.number(),
        type: z.enum([
          "message_create",
          "message_update",
          "message_delete",
          "member_join",
          "member_leave",
          "member_ban",
          "member_timeout",
          "role_create",
          "role_update",
          "role_delete",
          "channel_create",
          "channel_update",
          "channel_delete",
          "reaction_add",
          "reaction_remove",
          "voice_join",
          "voice_leave",
          "voice_switch",
          "scheduled",
          "webhook",
          "command",
        ]),
        config: z.record(z.string(), z.unknown()).optional(),
        condition: z.string().max(500).optional(),
        position: z.number().int().min(0).default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const bot = await requireBotOwnerOrManage(ctx.user.id, input.botId);
      const db = getDb();
      const validatedConfig = buildTriggerConfig(input.type).parse(input.config ?? {});
      const [{ id }] = await db
        .insert(schema.botTriggers)
        .values({
          botId: input.botId,
          type: input.type,
          config: validatedConfig,
          condition: input.condition ?? null,
          position: input.position,
        })
        .$returningId();
      await broadcastToServer(bot.serverId, { t: "server:refresh", serverId: bot.serverId });
      return { id };
    }),

  updateTrigger: authedQuery
    .input(
      z.object({
        triggerId: z.number(),
        type: z
          .enum([
            "message_create",
            "message_update",
            "message_delete",
            "member_join",
            "member_leave",
            "member_ban",
            "member_timeout",
            "role_create",
            "role_update",
            "role_delete",
            "channel_create",
            "channel_update",
            "channel_delete",
            "reaction_add",
            "reaction_remove",
            "voice_join",
            "voice_leave",
            "voice_switch",
            "scheduled",
            "webhook",
            "command",
          ])
          .optional(),
        config: z.record(z.string(), z.unknown()).optional(),
        condition: z.string().max(500).nullable().optional(),
        position: z.number().int().min(0).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { triggerId, ...patch } = input;
      const db = getDb();
      const [trigger] = await db
        .select()
        .from(schema.botTriggers)
        .where(eq(schema.botTriggers.id, triggerId));
      if (!trigger) throw new TRPCError({ code: "NOT_FOUND", message: "Trigger não encontrado." });
      const bot = await requireBotOwnerOrManage(ctx.user.id, trigger.botId);
      if (patch.type && patch.config) {
        patch.config = buildTriggerConfig(patch.type).parse(patch.config);
      }
      await db.update(schema.botTriggers).set(patch).where(eq(schema.botTriggers.id, triggerId));
      await broadcastToServer(bot.serverId, { t: "server:refresh", serverId: bot.serverId });
      return { ok: true };
    }),

  deleteTrigger: authedQuery
    .input(z.object({ triggerId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [trigger] = await db
        .select()
        .from(schema.botTriggers)
        .where(eq(schema.botTriggers.id, input.triggerId));
      if (!trigger) throw new TRPCError({ code: "NOT_FOUND", message: "Trigger não encontrado." });
      const bot = await requireBotOwnerOrManage(ctx.user.id, trigger.botId);
      await db.delete(schema.botTriggers).where(eq(schema.botTriggers.id, input.triggerId));
      await db.delete(schema.botActions).where(eq(schema.botActions.triggerId, input.triggerId));
      await broadcastToServer(bot.serverId, { t: "server:refresh", serverId: bot.serverId });
      return { ok: true };
    }),

  createAction: authedQuery
    .input(
      z.object({
        botId: z.number(),
        triggerId: z.number().nullable().optional(),
        type: z.enum([
          "send_message",
          "send_embed",
          "reply",
          "edit_message",
          "delete_message",
          "add_role",
          "remove_role",
          "timeout_member",
          "kick_member",
          "ban_member",
          "create_channel",
          "delete_channel",
          "send_dm",
          "webhook_call",
          "run_code",
          "delay",
          "conditional_branch",
          "log_audit",
        ]),
        config: z.record(z.string(), z.unknown()).optional(),
        code: z.string().max(5000).optional(),
        position: z.number().int().min(0).default(0),
        nextActionId: z.number().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const bot = await requireBotOwnerOrManage(ctx.user.id, input.botId);
      const db = getDb();
      if (input.triggerId) {
        const [trigger] = await db
          .select()
          .from(schema.botTriggers)
          .where(and(eq(schema.botTriggers.id, input.triggerId), eq(schema.botTriggers.botId, input.botId)));
        if (!trigger) throw new TRPCError({ code: "NOT_FOUND", message: "Trigger não encontrado." });
      }
      const validatedConfig = buildActionConfig(input.type).parse(input.config ?? {});
      const [{ id }] = await db
        .insert(schema.botActions)
        .values({
          botId: input.botId,
          triggerId: input.triggerId ?? null,
          type: input.type,
          config: validatedConfig,
          code: input.code ?? null,
          position: input.position,
          nextActionId: input.nextActionId ?? null,
        })
        .$returningId();
      await broadcastToServer(bot.serverId, { t: "server:refresh", serverId: bot.serverId });
      return { id };
    }),

  updateAction: authedQuery
    .input(
      z.object({
        actionId: z.number(),
        type: z
          .enum([
            "send_message",
            "send_embed",
            "reply",
            "edit_message",
            "delete_message",
            "add_role",
            "remove_role",
            "timeout_member",
            "kick_member",
            "ban_member",
            "create_channel",
            "delete_channel",
            "send_dm",
            "webhook_call",
            "run_code",
            "delay",
            "conditional_branch",
            "log_audit",
          ])
          .optional(),
        config: z.record(z.string(), z.unknown()).optional(),
        code: z.string().max(5000).nullable().optional(),
        position: z.number().int().min(0).optional(),
        nextActionId: z.number().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { actionId, ...patch } = input;
      const db = getDb();
      const [action] = await db.select().from(schema.botActions).where(eq(schema.botActions.id, actionId));
      if (!action) throw new TRPCError({ code: "NOT_FOUND", message: "Action não encontrada." });
      const bot = await requireBotOwnerOrManage(ctx.user.id, action.botId);
      if (patch.type && patch.config) {
        patch.config = buildActionConfig(patch.type).parse(patch.config);
      }
      await db.update(schema.botActions).set(patch).where(eq(schema.botActions.id, actionId));
      await broadcastToServer(bot.serverId, { t: "server:refresh", serverId: bot.serverId });
      return { ok: true };
    }),

  deleteAction: authedQuery
    .input(z.object({ actionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [action] = await db.select().from(schema.botActions).where(eq(schema.botActions.id, input.actionId));
      if (!action) throw new TRPCError({ code: "NOT_FOUND", message: "Action não encontrada." });
      const bot = await requireBotOwnerOrManage(ctx.user.id, action.botId);
      await db.delete(schema.botActions).where(eq(schema.botActions.id, input.actionId));
      await broadcastToServer(bot.serverId, { t: "server:refresh", serverId: bot.serverId });
      return { ok: true };
    }),

  createNode: authedQuery
    .input(
      z.object({
        botId: z.number(),
        nodeType: z.enum(["trigger", "action", "condition", "delay", "code", "output"]),
        refType: z.string().max(48).optional(),
        positionX: z.number().int().default(0),
        positionY: z.number().int().default(0),
        data: z.record(z.string(), z.unknown()).optional(),
        parentId: z.number().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const _bot = await requireBotOwnerOrManage(ctx.user.id, input.botId); void _bot;(ctx.user.id, input.botId);
      const db = getDb();
      const [{ id }] = await db
        .insert(schema.botNodes)
        .values({
          botId: input.botId,
          nodeType: input.nodeType,
          refType: input.refType ?? null,
          positionX: input.positionX,
          positionY: input.positionY,
          data: input.data ?? null,
          parentId: input.parentId ?? null,
        })
        .$returningId();
      return { id };
    }),

  updateNode: authedQuery
    .input(
      z.object({
        nodeId: z.number(),
        nodeType: z.enum(["trigger", "action", "condition", "delay", "code", "output"]).optional(),
        refType: z.string().max(48).nullable().optional(),
        positionX: z.number().int().optional(),
        positionY: z.number().int().optional(),
        data: z.record(z.string(), z.unknown()).optional(),
        parentId: z.number().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { nodeId, ...patch } = input;
      const db = getDb();
      const [node] = await db.select().from(schema.botNodes).where(eq(schema.botNodes.id, nodeId));
      if (!node) throw new TRPCError({ code: "NOT_FOUND", message: "Nó não encontrado." });
      await requireBotOwnerOrManage(ctx.user.id, node.botId);
      await db.update(schema.botNodes).set(patch).where(eq(schema.botNodes.id, nodeId));
      return { ok: true };
    }),

  deleteNode: authedQuery
    .input(z.object({ nodeId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [node] = await db.select().from(schema.botNodes).where(eq(schema.botNodes.id, input.nodeId));
      if (!node) throw new TRPCError({ code: "NOT_FOUND", message: "Nó não encontrado." });
      await requireBotOwnerOrManage(ctx.user.id, node.botId);
      await db.delete(schema.botNodes).where(eq(schema.botNodes.id, input.nodeId));
      await db.delete(schema.botEdges).where(
        sql`${schema.botEdges.sourceNodeId} = ${input.nodeId} OR ${schema.botEdges.targetNodeId} = ${input.nodeId}`
      );
      return { ok: true };
    }),

  createEdge: authedQuery
    .input(
      z.object({
        botId: z.number(),
        sourceNodeId: z.number(),
        targetNodeId: z.number(),
        sourceHandle: z.string().max(32).optional(),
        targetHandle: z.string().max(32).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const _bot = await requireBotOwnerOrManage(ctx.user.id, input.botId); void _bot;(ctx.user.id, input.botId);
      const db = getDb();
      const [{ id }] = await db
        .insert(schema.botEdges)
        .values({
          botId: input.botId,
          sourceNodeId: input.sourceNodeId,
          targetNodeId: input.targetNodeId,
          sourceHandle: input.sourceHandle ?? null,
          targetHandle: input.targetHandle ?? null,
        })
        .$returningId();
      return { id };
    }),

  deleteEdge: authedQuery
    .input(z.object({ edgeId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [edge] = await db.select().from(schema.botEdges).where(eq(schema.botEdges.id, input.edgeId));
      if (!edge) throw new TRPCError({ code: "NOT_FOUND", message: "Conexão não encontrada." });
      await requireBotOwnerOrManage(ctx.user.id, edge.botId);
      await db.delete(schema.botEdges).where(eq(schema.botEdges.id, input.edgeId));
      return { ok: true };
    }),

  saveFlow: authedQuery
    .input(
      z.object({
        botId: z.number(),
        nodes: z.array(
          z.object({
            id: z.number(),
            nodeType: z.enum(["trigger", "action", "condition", "delay", "code", "output"]),
            refType: z.string().max(48).nullable().optional(),
            positionX: z.number().int(),
            positionY: z.number().int(),
            data: z.record(z.string(), z.unknown()).nullable().optional(),
            parentId: z.number().nullable().optional(),
          })
        ),
        edges: z.array(
          z.object({
            id: z.number().optional(),
            sourceNodeId: z.number(),
            targetNodeId: z.number(),
            sourceHandle: z.string().max(32).nullable().optional(),
            targetHandle: z.string().max(32).nullable().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const _bot = await requireBotOwnerOrManage(ctx.user.id, input.botId); void _bot;(ctx.user.id, input.botId);
      const db = getDb();
      await db.transaction(async (tx) => {
        for (const node of input.nodes) {
          if (node.id > 0) {
            await tx
              .update(schema.botNodes)
              .set({
                nodeType: node.nodeType,
                refType: node.refType ?? null,
                positionX: node.positionX,
                positionY: node.positionY,
                data: node.data ?? null,
                parentId: node.parentId ?? null,
              })
              .where(eq(schema.botNodes.id, node.id));
          } else {
            await tx.insert(schema.botNodes).values({
              botId: input.botId,
              nodeType: node.nodeType,
              refType: node.refType ?? null,
              positionX: node.positionX,
              positionY: node.positionY,
              data: node.data ?? null,
              parentId: node.parentId ?? null,
            });
          }
        }
        for (const edge of input.edges) {
          if (edge.id && edge.id > 0) {
            await tx
              .update(schema.botEdges)
              .set({
                sourceNodeId: edge.sourceNodeId,
                targetNodeId: edge.targetNodeId,
                sourceHandle: edge.sourceHandle ?? null,
                targetHandle: edge.targetHandle ?? null,
              })
              .where(eq(schema.botEdges.id, edge.id));
          } else {
            await tx.insert(schema.botEdges).values({
              botId: input.botId,
              sourceNodeId: edge.sourceNodeId,
              targetNodeId: edge.targetNodeId,
              sourceHandle: edge.sourceHandle ?? null,
              targetHandle: edge.targetHandle ?? null,
            });
          }
        }
      });
      return { ok: true };
    }),

  listExecutions: authedQuery
    .input(z.object({ botId: z.number(), limit: z.number().int().min(1).max(100).default(50), cursor: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const _bot = await requireBotOwnerOrManage(ctx.user.id, input.botId); void _bot;(ctx.user.id, input.botId);
      const db = getDb();
      const baseFilter = eq(schema.botExecutions.botId, input.botId);
      const whereClause = input.cursor
        ? and(baseFilter, sql`${schema.botExecutions.id} < ${input.cursor}`)
        : baseFilter;
      const rows = await db
        .select()
        .from(schema.botExecutions)
        .where(whereClause)
        .orderBy(desc(schema.botExecutions.startedAt))
        .limit(input.limit + 1);
      const hasMore = rows.length > input.limit;
      return { items: rows.slice(0, input.limit), hasMore };
    }),

  testRun: authedQuery
    .input(
      z.object({
        botId: z.number(),
        triggerType: z.enum([
          "message_create",
          "message_update",
          "message_delete",
          "member_join",
          "member_leave",
          "member_ban",
          "member_timeout",
          "role_create",
          "role_update",
          "role_delete",
          "channel_create",
          "channel_update",
          "channel_delete",
          "reaction_add",
          "reaction_remove",
          "voice_join",
          "voice_leave",
          "voice_switch",
          "scheduled",
          "webhook",
          "command",
        ]),
        mockContext: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const bot = await requireBotOwnerOrManage(ctx.user.id, input.botId);
      if (!bot.enabled) throw new TRPCError({ code: "BAD_REQUEST", message: "Bot está desativado." });
      return {
        executionId: nanoid(),
        status: "success" as const,
        result: { message: "Test run completed (mock)", actionsRun: 0 },
      };
    }),
});
