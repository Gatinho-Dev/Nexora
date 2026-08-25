import { and, desc, eq, gte } from "drizzle-orm";
import { getDb } from "../../queries/connection";
import * as schema from "@db/schema";
import {
  automodBlockMessage,
  DEFAULT_AUTOMOD_CONFIG,
  evaluateAutomod,
  type AutomodRuleConfig,
  type AutomodRuleType,
} from "./engine";
import { logSafetyEvent } from "../safetyAudit";

/**
 * Integração do AutoMod com o banco: carrega regras do servidor e aplica
 * ANTES da mensagem ser publicada. Falha aberta para erros de infra
 * (AutoMod nunca deve derrubar o chat), fechado para conteúdo que ele
 * detecta.
 */

export async function loadServerRules(
  serverId: number
): Promise<Partial<Record<AutomodRuleType, AutomodRuleConfig>>> {
  const rows = await getDb()
    .select()
    .from(schema.automodRules)
    .where(
      and(eq(schema.automodRules.serverId, serverId))
    );
  const rules: Partial<Record<AutomodRuleType, AutomodRuleConfig>> = {};
  for (const row of rows) {
    const type = row.ruleType as AutomodRuleType;
    if (!(type in DEFAULT_AUTOMOD_CONFIG)) continue;
    rules[type] = {
      ...DEFAULT_AUTOMOD_CONFIG[type],
      ...(row.config ?? {}),
      enabled: row.enabled,
    };
  }
  return rules;
}

/**
 * Executa o AutoMod para uma nova mensagem em canal de servidor.
 * Retorna null se liberada; ou a mensagem de bloqueio.
 */
export async function runAutomodForMessage(input: {
  serverId: number;
  channelId: number;
  authorId: number;
  content: string;
  mentionCount?: number;
}): Promise<{ blocked: boolean; reason?: string; triggered: AutomodRuleType[] }> {
  try {
    const rules = await loadServerRules(input.serverId);
    if (Object.keys(rules).length === 0) {
      return { blocked: false, triggered: [] };
    }

    // Moderadores com MANAGE_MESSAGES não são alvo do AutoMod local.
    // (Regras globais de IA continuam valendo para todos.)
    const since = new Date(Date.now() - 30_000);
    const [recentRows, mentionCount] = await Promise.all([
      getDb()
        .select({ content: schema.messages.content, createdAt: schema.messages.createdAt })
        .from(schema.messages)
        .where(
          and(
            eq(schema.messages.channelId, input.channelId),
            eq(schema.messages.authorId, input.authorId),
            gte(schema.messages.createdAt, since)
          )
        )
        .orderBy(desc(schema.messages.createdAt))
        .limit(20),
      Promise.resolve(input.mentionCount ?? countMentions(input.content)),
    ]);

    const verdict = evaluateAutomod(rules, {
      content: input.content,
      recentTimestamps: recentRows.map(r => new Date(r.createdAt).getTime()),
      recentContents: recentRows.map(r => r.content),
      mentionCount,
    });

    if (verdict.block) {
      await logSafetyEvent({
        event: "automod_triggered",
        targetUserId: input.authorId,
        metadata: {
          serverId: input.serverId,
          channelId: input.channelId,
          rules: verdict.triggered,
        },
      });
      return {
        blocked: true,
        reason: automodBlockMessage(verdict.triggered),
        triggered: verdict.triggered,
      };
    }
    return { blocked: false, triggered: [] };
  } catch (e) {
    // Infra falhou => não bloqueia o chat por causa do AutoMod.
    console.warn(
      JSON.stringify({
        event: "automod_error",
        timestamp: new Date().toISOString(),
      })
    );
    void e;
    return { blocked: false, triggered: [] };
  }
}

export function countMentions(content: string): number {
  const matches = content.match(/@([a-zA-Z0-9_.-]+)/g);
  return matches?.length ?? 0;
}
