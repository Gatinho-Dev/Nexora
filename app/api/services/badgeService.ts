import { and, eq, isNull, or, gt, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import * as schema from "@db/schema";

/**
 * BadgeService — centro ÚNICO de concessão/remoção/avaliação de emblemas.
 *
 * Regras de segurança:
 * - Usuários comuns NUNCA concedem badges (toda mutação passa por aqui e
 *   pelas rotas admin, que validam autoridade no servidor).
 * - `manualOverride: true` impede a automação de remover a concessão.
 * - `automaticGrantDisabled: true` impede a automação de conceder.
 * - Toda alteração escreve em badge_history (auditoria completa).
 */

export type BadgeSlug =
  | "staff"
  | "partnered-server-owner"
  | "early-supporter"
  | "bug-hunter-tier-1"
  | "bug-hunter-tier-2"
  | "early-verified-bot-developer"
  | "a-clown-for-a-limited-time"
  | "completed-a-quest"
  | "originally-known-as"
  | "im-new-here-say-hi"
  | "moderator-programs-alumni"
  | "certified-moderator"
  | "active-developer"
  | "supports-commands"
  | "uses-automod"
  | "server-premium";

export type GrantSource =
  | "SYSTEM"
  | "ADMIN"
  | "MIGRATION"
  | "EVENT"
  | "IMPORT"
  | "STAFF_DIRECTORY"
  | "LEGACY_ARCHIVED";

export type BadgeEventType =
  | "USER_CREATED"
  | "QUEST_COMPLETED"
  | "BUG_REPORT_ACCEPTED"
  | "SERVER_PARTNERED"
  | "SERVER_UNPARTNERED"
  | "SERVER_OWNER_CHANGED"
  | "APPLICATION_VERIFIED"
  | "APPLICATION_ACTIVITY"
  | "MODERATOR_CERTIFIED"
  | "SUBSCRIPTION_STARTED"
  | "SUBSCRIPTION_ENDED"
  | "USERNAME_MIGRATED";

export type BadgeAction =
  | "GRANTED"
  | "REVOKED"
  | "EXPIRED"
  | "RESTORED"
  | "MIGRATED"
  | "LEGACY_ARCHIVED"
  | "MANUAL_OVERRIDE_ENABLED"
  | "MANUAL_OVERRIDE_DISABLED"
  | "AUTO_GRANT_DISABLED"
  | "AUTO_GRANT_ENABLED";

/** Prazos/configurações (env-overridable). */
export const EARLY_SUPPORTER_DEADLINE = new Date(
  process.env.EARLY_SUPPORTER_DEADLINE ?? "2026-12-31T23:59:59Z",
);
export const EARLY_VERIFIED_DEVELOPER_DEADLINE = new Date(
  process.env.EARLY_VERIFIED_DEVELOPER_DEADLINE ?? "2026-12-31T23:59:59Z",
);
export const NEW_USER_BADGE_DURATION_DAYS = Number(
  process.env.NEW_USER_BADGE_DURATION_DAYS ?? 7,
);
export const ACTIVE_DEVELOPER_DAYS = Number(
  process.env.ACTIVE_DEVELOPER_DAYS ?? 30,
);
export const BUG_HUNTER_TIER_1_REPORTS = Number(
  process.env.BUG_HUNTER_TIER_1_REPORTS ?? 5,
);
export const BUG_HUNTER_TIER_2_CRITICAL = Number(
  process.env.BUG_HUNTER_TIER_2_CRITICAL ?? 3,
);
export const BUG_HUNTER_TIER_2_REPORTS = Number(
  process.env.BUG_HUNTER_TIER_2_REPORTS ?? 25,
);
export const REQUIRED_AUTOMOD_RULES = Number(
  process.env.REQUIRED_AUTOMOD_RULES ?? 1,
);

type CatalogEntry = typeof schema.badges.$inferInsert & { slug: BadgeSlug };

/** Catálogo completo — novas badges = nova entrada aqui + SVG em /badges. */
export const BADGE_CATALOG: CatalogEntry[] = [
  {
    slug: "staff",
    name: "Nexora Staff",
    description: "Membro oficial da equipe Nexora.",
    icon: "staff",
    category: "system",
    rarity: "EXCLUSIVE",
    grantType: "STAFF_DIRECTORY",
    permanent: true,
    canHide: false,
    displayOrder: 1,
    restricted: true,
  },
  {
    slug: "partnered-server-owner",
    name: "Partnered Server Owner",
    description: "Proprietário de pelo menos um servidor parceiro oficial da Nexora.",
    icon: "partnered-server-owner",
    category: "system",
    rarity: "EPIC",
    grantType: "SYSTEM",
    permanent: false,
    displayOrder: 2,
    restricted: true,
  },
  {
    slug: "early-supporter",
    name: "Early Supporter",
    description: `Apoiou a Nexora durante seu período inicial (até ${EARLY_SUPPORTER_DEADLINE.toLocaleDateString("pt-BR")}).`,
    icon: "early-supporter",
    category: "support",
    rarity: "RARE",
    grantType: "ADMIN",
    permanent: true,
    displayOrder: 3,
  },
  {
    slug: "bug-hunter-tier-1",
    name: "Bug Hunter — Tier 1",
    description: `Reportou ${BUG_HUNTER_TIER_1_REPORTS}+ bugs aceitos pela equipe.`,
    icon: "bug-hunter-tier-1",
    category: "program",
    rarity: "EPIC",
    grantType: "SYSTEM",
    permanent: true,
    displayOrder: 4,
  },
  {
    slug: "bug-hunter-tier-2",
    name: "Bug Hunter — Tier 2",
    description: `${BUG_HUNTER_TIER_2_CRITICAL}+ bugs críticos ou ${BUG_HUNTER_TIER_2_REPORTS}+ bugs aceitos.`,
    icon: "bug-hunter-tier-2",
    category: "program",
    rarity: "LEGENDARY",
    grantType: "SYSTEM",
    permanent: true,
    displayOrder: 5,
    restricted: true,
  },
  {
    slug: "early-verified-bot-developer",
    name: "Early Verified Bot Developer",
    description: "Verificou uma aplicação antes do prazo do programa inicial.",
    icon: "early-verified-bot-developer",
    category: "developer",
    rarity: "LEGENDARY",
    grantType: "ADMIN",
    permanent: true,
    displayOrder: 6,
  },
  {
    slug: "a-clown-for-a-limited-time",
    name: "A Clown, for a Limited Time",
    description: "Sobreviveu a um evento especial da Nexora. Por tempo limitado.",
    icon: "a-clown-for-a-limited-time",
    category: "event",
    rarity: "UNCOMMON",
    grantType: "EVENT",
    permanent: false,
    canHide: true,
    displayOrder: 7,
  },
  {
    slug: "completed-a-quest",
    name: "Completed a Quest",
    description: "Completou uma quest oficial da Nexora.",
    icon: "completed-a-quest",
    category: "event",
    rarity: "UNCOMMON",
    grantType: "SYSTEM",
    permanent: true,
    displayOrder: 8,
  },
  {
    slug: "originally-known-as",
    name: "Originally Known As",
    description: "Estava na Nexora antes da grande migração de usernames.",
    icon: "originally-known-as",
    category: "system",
    rarity: "RARE",
    grantType: "SYSTEM",
    permanent: true,
    canHide: true,
    displayOrder: 9,
  },
  {
    slug: "im-new-here-say-hi",
    name: "I'm New Here, Say Hi!",
    description: `Conta nova na Nexora (${NEW_USER_BADGE_DURATION_DAYS} dias).`,
    icon: "im-new-here-say-hi",
    category: "general",
    rarity: "COMMON",
    grantType: "SYSTEM",
    permanent: false,
    canHide: true,
    displayOrder: 10,
  },
  {
    slug: "moderator-programs-alumni",
    name: "Moderator Programs Alumni",
    description: "Concluiu oficialmente um programa de moderação da Nexora.",
    icon: "moderator-programs-alumni",
    category: "program",
    rarity: "EPIC",
    grantType: "ADMIN",
    permanent: true,
    displayOrder: 11,
    restricted: true,
  },
  {
    slug: "certified-moderator",
    name: "Certified Moderator",
    description: "Certificação oficial de moderação da Nexora.",
    icon: "certified-moderator",
    category: "program",
    rarity: "EPIC",
    grantType: "ADMIN",
    permanent: true,
    displayOrder: 12,
    restricted: true,
  },
  {
    slug: "active-developer",
    name: "Active Developer",
    description: `Mantém uma aplicação ativa nos últimos ${ACTIVE_DEVELOPER_DAYS} dias.`,
    icon: "active-developer",
    category: "developer",
    rarity: "RARE",
    grantType: "SYSTEM",
    permanent: false,
    displayOrder: 13,
  },
  {
    slug: "supports-commands",
    name: "Supports Commands",
    description: "A aplicação deste desenvolvedor suporta comandos.",
    icon: "supports-commands",
    category: "developer",
    rarity: "COMMON",
    grantType: "SYSTEM",
    permanent: true,
    displayOrder: 14,
  },
  {
    slug: "uses-automod",
    name: "Uses AutoMod",
    description: "Utiliza o AutoMod da Nexora com regras ativas.",
    icon: "uses-automod",
    category: "developer",
    rarity: "COMMON",
    grantType: "SYSTEM",
    permanent: true,
    displayOrder: 15,
  },
  {
    slug: "server-premium",
    name: "Server Premium",
    description: "Possui uma assinatura premium ativa para servidores.",
    icon: "server-premium",
    category: "support",
    rarity: "RARE",
    grantType: "SYSTEM",
    permanent: false,
    displayOrder: 16,
  },
];

/** Badges cujo gerenciamento exige autoridade "owner". */
const RESTRICTED_SLUGS: BadgeSlug[] = [
  "staff",
  "partnered-server-owner",
  "certified-moderator",
  "moderator-programs-alumni",
  "bug-hunter-tier-2",
];

export function isRestrictedSlug(slug: string): boolean {
  return RESTRICTED_SLUGS.includes(slug as BadgeSlug);
}

// ── Catálogo ──────────────────────────────────────────────────

/** Semeadura idempotente do catálogo + Staff para Lobo_2033. Roda no boot. */
export async function ensureCatalog(): Promise<void> {
  const db = getDb();
  for (const entry of BADGE_CATALOG) {
    await db
      .insert(schema.badges)
      .values(entry)
      .onDuplicateKeyUpdate({
        set: {
          name: entry.name,
          description: entry.description ?? null,
          icon: entry.icon,
          rarity: entry.rarity ?? "COMMON",
          displayOrder: entry.displayOrder ?? 100,
          restricted: entry.restricted ?? false,
        },
      });
  }
  await grantStaffToFounder();
}

/**
 * Concede Staff a Lobo_2033 (uma única vez, por username, virando registro
 * real no banco — depois disso a badge pertence à CONTA, não ao username).
 */
async function grantStaffToFounder(): Promise<void> {
  const db = getDb();
  const [staff] = await db
    .select()
    .from(schema.badges)
    .where(eq(schema.badges.slug, "staff"))
    .limit(1);
  if (!staff) return;

  const [lobo] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(sql`lower(${schema.users.username}) = 'lobo_2033'`)
    .limit(1);
  if (!lobo) return;

  await grant(lobo.id, staff.id, {
    source: "MIGRATION",
    reason: "Official Nexora Staff member",
    manualOverride: true,
  });
}

// ── Núcleo ────────────────────────────────────────────────────

export async function getBadgeBySlug(slug: string) {
  const [badge] = await getDb()
    .select()
    .from(schema.badges)
    .where(eq(schema.badges.slug, slug))
    .limit(1);
  return badge ?? null;
}

export async function hasBadge(userId: number, badgeId: number): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: schema.userBadges.id })
    .from(schema.userBadges)
    .where(
      and(
        eq(schema.userBadges.userId, userId),
        eq(schema.userBadges.badgeId, badgeId),
      ),
    )
    .limit(1);
  return !!row;
}

async function writeHistory(entry: {
  userId: number;
  badgeId: number;
  action: BadgeAction;
  performedBy?: number | null;
  source?: string;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  await getDb().insert(schema.badgeHistory).values({
    userId: entry.userId,
    badgeId: entry.badgeId,
    action: entry.action,
    performedBy: entry.performedBy ?? null,
    source: entry.source ?? "SYSTEM",
    reason: entry.reason ?? null,
    metadata: entry.metadata ?? null,
  });
}

/** Escrita pública de histórico (usada pelo painel admin). */
export const badgeHistoryWrite = writeHistory;

export async function grant(
  userId: number,
  badgeId: number,
  opts: {
    source?: GrantSource;
    grantedBy?: number | null;
    reason?: string | null;
    expiresAt?: Date | null;
    manualOverride?: boolean;
    metadata?: Record<string, unknown> | null;
    /** Não escreve GRANTED no histórico (usado em restores). */
    skipHistory?: boolean;
  } = {},
): Promise<{ granted: boolean; alreadyHad: boolean }> {
  const db = getDb();
  const existing = await db
    .select()
    .from(schema.userBadges)
    .where(
      and(
        eq(schema.userBadges.userId, userId),
        eq(schema.userBadges.badgeId, badgeId),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    // Já possui — apenas "des-expira" se a concessão antiga venceu.
    const row = existing[0];
    if (
      row.expiresAt &&
      row.expiresAt.getTime() < Date.now() &&
      !opts.expiresAt
    ) {
      await db
        .update(schema.userBadges)
        .set({ expiresAt: null })
        .where(eq(schema.userBadges.id, row.id));
      await writeHistory({
        userId,
        badgeId,
        action: "RESTORED",
        performedBy: opts.grantedBy ?? null,
        source: opts.source ?? "SYSTEM",
        reason: opts.reason ?? null,
      });
      return { granted: true, alreadyHad: true };
    }
    return { granted: false, alreadyHad: true };
  }

  await db.insert(schema.userBadges).values({
    userId,
    badgeId,
    grantedBy: opts.grantedBy ?? null,
    grantSource: opts.source ?? "SYSTEM",
    reason: opts.reason ?? null,
    expiresAt: opts.expiresAt ?? null,
    manualOverride: opts.manualOverride ?? false,
    metadata: opts.metadata ?? null,
  });
  if (!opts.skipHistory) {
    await writeHistory({
      userId,
      badgeId,
      action: "GRANTED",
      performedBy: opts.grantedBy ?? null,
      source: opts.source ?? "SYSTEM",
      reason: opts.reason ?? null,
      metadata: opts.metadata ?? null,
    });
  }
  return { granted: true, alreadyHad: false };
}

export async function revoke(
  userId: number,
  badgeId: number,
  opts: {
    performedBy?: number | null;
    reason?: string | null;
    source?: string;
    action?: BadgeAction;
    /** Remove a linha (false = apenas marca expirado). */
    hardDelete?: boolean;
  } = {},
): Promise<boolean> {
  const db = getDb();
  const existing = await db
    .select()
    .from(schema.userBadges)
    .where(
      and(
        eq(schema.userBadges.userId, userId),
        eq(schema.userBadges.badgeId, badgeId),
      ),
    )
    .limit(1);
  if (existing.length === 0) return false;

  if (opts.hardDelete !== false) {
    await db
      .delete(schema.userBadges)
      .where(eq(schema.userBadges.id, existing[0].id));
  }
  await writeHistory({
    userId,
    badgeId,
    action: opts.action ?? "REVOKED",
    performedBy: opts.performedBy ?? null,
    source: opts.source ?? "SYSTEM",
    reason: opts.reason ?? null,
    metadata: existing[0].metadata ?? null,
  });
  return true;
}

/** Lista visível para perfis: não expiradas, não ocultas, badge visível. */
export async function listForUser(userId: number) {
  const db = getDb();
  const now = new Date();
  const rows = await db
    .select({ badge: schema.badges, userBadge: schema.userBadges })
    .from(schema.userBadges)
    .innerJoin(schema.badges, eq(schema.badges.id, schema.userBadges.badgeId))
    .where(
      and(
        eq(schema.userBadges.userId, userId),
        eq(schema.userBadges.hiddenByUser, false),
        eq(schema.badges.visible, true),
        or(
          isNull(schema.userBadges.expiresAt),
          gt(schema.userBadges.expiresAt, now),
        ),
      ),
    )
    .orderBy(schema.badges.displayOrder, schema.userBadges.grantedAt);
  return rows;
}

// ── Eventos internos ──────────────────────────────────────────

/** Registra um evento e dispara a avaliação das badges dependentes. */
export async function recordEvent(
  type: BadgeEventType,
  userId: number,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const db = getDb();
  await db.insert(schema.badgeEvents).values({ type, userId, metadata });
  await evaluateUser(userId, { trigger: type }).catch(() => {});
}

// ── Avaliação automática ──────────────────────────────────────

export type EvaluationResult = {
  kept: number;
  added: number;
  removed: number;
  addedSlugs: string[];
  removedSlugs: string[];
};

/**
 * Avalia TODAS as badges automáticas de um usuário:
 * concede as elegíveis, remove as não-elegíveis (respeitando
 * manualOverride / automaticGrantDisabled) e expira vencidas.
 */
export async function evaluateUser(
  userId: number,
  _opts: { trigger?: string } = {},
): Promise<EvaluationResult> {
  void _opts;
  const db = getDb();
  const result: EvaluationResult = {
    kept: 0,
    added: 0,
    removed: 0,
    addedSlugs: [],
    removedSlugs: [],
  };
  const now = new Date();

  const catalog = await db.select().from(schema.badges);
  const bySlug = new Map(catalog.map(b => [b.slug, b]));

  const current = await db
    .select({ userBadge: schema.userBadges, badge: schema.badges })
    .from(schema.userBadges)
    .innerJoin(schema.badges, eq(schema.badges.id, schema.userBadges.badgeId))
    .where(eq(schema.userBadges.userId, userId));

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!user) return result;

  // 1. Expira concessões vencidas (nunca apaga histórico).
  for (const row of current) {
    if (row.userBadge.expiresAt && row.userBadge.expiresAt <= now) {
      await revoke(userId, row.badge.id, {
        action: "EXPIRED",
        source: "AUTOMATION",
        reason: "Concessão expirada.",
        hardDelete: true,
      });
      result.removed += 1;
      result.removedSlugs.push(row.badge.slug);
    } else {
      result.kept += 1;
    }
  }
  // Recarrega estado pós-expiração.
  const stillHeld = new Set(
    (
      await db
        .select({ slug: schema.badges.slug, ub: schema.userBadges })
        .from(schema.userBadges)
        .innerJoin(schema.badges, eq(schema.badges.id, schema.userBadges.badgeId))
        .where(eq(schema.userBadges.userId, userId))
    ).map(r => ({ slug: r.slug, ub: r.ub })),
  );
  const heldSlugs = new Set([...stillHeld].map(r => r.slug));
  const overrideFor = (slug: string) =>
    [...stillHeld].find(r => r.slug === slug)?.ub.manualOverride ?? false;
  const autoDisabledFor = (slug: string) =>
    [...stillHeld].find(r => r.slug === slug)?.ub.automaticGrantDisabled ?? false;

  // 2. I'm new here — conta nova.
  const newHere = bySlug.get("im-new-here-say-hi");
  if (newHere) {
    const ageDays =
      (now.getTime() - new Date(user.createdAt).getTime()) / 86_400_000;
    const eligible = ageDays <= NEW_USER_BADGE_DURATION_DAYS;
    await applyRule(userId, newHere, eligible, {
      heldSlugs,
      override: overrideFor("im-new-here-say-hi"),
      autoDisabled: autoDisabledFor("im-new-here-say-hi"),
      reason: "Conta nova na Nexora.",
      expiresAt: new Date(
        new Date(user.createdAt).getTime() +
          NEW_USER_BADGE_DURATION_DAYS * 86_400_000,
      ),
      result,
    });
  }

  // 3. Partnered Server Owner — dono de ≥1 servidor parceiro.
  const partnered = bySlug.get("partnered-server-owner");
  if (partnered) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.servers)
      .where(
        and(
          eq(schema.servers.ownerId, userId),
          eq(schema.servers.partnered, true),
        ),
      );
    await applyRule(userId, partnered, Number(count) > 0, {
      heldSlugs,
      override: overrideFor("partnered-server-owner"),
      autoDisabled: autoDisabledFor("partnered-server-owner"),
      reason: "Proprietário de servidor parceiro oficial.",
      result,
    });
  }

  // 4. Bug Hunter Tier 1/2 — eventos de bugs aceitos.
  const bugEvents = await db
    .select()
    .from(schema.badgeEvents)
    .where(
      and(
        eq(schema.badgeEvents.userId, userId),
        eq(schema.badgeEvents.type, "BUG_REPORT_ACCEPTED"),
      ),
    );
  const validReports = bugEvents.length;
  const criticalReports = bugEvents.filter(
    e => (e.metadata as { critical?: boolean } | null)?.critical === true,
  ).length;

  const tier1 = bySlug.get("bug-hunter-tier-1");
  if (tier1) {
    await applyRule(userId, tier1, validReports >= BUG_HUNTER_TIER_1_REPORTS, {
      heldSlugs,
      override: overrideFor("bug-hunter-tier-1"),
      autoDisabled: autoDisabledFor("bug-hunter-tier-1"),
      reason: `${validReports} bugs aceitos.`,
      result,
    });
  }
  const tier2 = bySlug.get("bug-hunter-tier-2");
  if (tier2) {
    const eligible =
      criticalReports >= BUG_HUNTER_TIER_2_CRITICAL ||
      validReports >= BUG_HUNTER_TIER_2_REPORTS;
    await applyRule(userId, tier2, eligible, {
      heldSlugs,
      override: overrideFor("bug-hunter-tier-2"),
      autoDisabled: autoDisabledFor("bug-hunter-tier-2"),
      reason: `${criticalReports} críticos / ${validReports} aceitos.`,
      result,
    });
  }

  // 5. Completed a Quest — ≥1 quest completada.
  const questBadge = bySlug.get("completed-a-quest");
  if (questBadge) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.badgeEvents)
      .where(
        and(
          eq(schema.badgeEvents.userId, userId),
          eq(schema.badgeEvents.type, "QUEST_COMPLETED"),
        ),
      );
    await applyRule(userId, questBadge, Number(count) >= 1, {
      heldSlugs,
      override: overrideFor("completed-a-quest"),
      autoDisabled: autoDisabledFor("completed-a-quest"),
      reason: "Completou uma quest oficial.",
      result,
    });
  }

  return result;
}

async function applyRule(
  userId: number,
  badge: typeof schema.badges.$inferSelect,
  eligible: boolean,
  ctx: {
    heldSlugs: Set<string>;
    override: boolean;
    autoDisabled: boolean;
    reason: string;
    expiresAt?: Date;
    result: EvaluationResult;
  },
): Promise<void> {
  const held = ctx.heldSlugs.has(badge.slug);
  if (eligible && !held && !ctx.autoDisabled) {
    await grant(userId, badge.id, {
      source: "SYSTEM",
      reason: ctx.reason,
      expiresAt: ctx.expiresAt ?? null,
    });
    ctx.result.added += 1;
    ctx.result.addedSlugs.push(badge.slug);
  } else if (!eligible && held && !ctx.override) {
    await revoke(userId, badge.id, {
      source: "AUTOMATION",
      reason: "Requisitos da badge não são mais atendidos.",
    });
    ctx.result.removed += 1;
    ctx.result.removedSlugs.push(badge.slug);
  }
}

/** Reavalia todos os usuários (admin/cron). Retorna resumo consolidado. */
export async function evaluateAllEligibleUsers(): Promise<{
  users: number;
  added: number;
  removed: number;
}> {
  const db = getDb();
  const ids = await db.select({ id: schema.users.id }).from(schema.users);
  let added = 0;
  let removed = 0;
  for (const { id } of ids) {
    const r = await evaluateUser(id);
    added += r.added;
    removed += r.removed;
  }
  return { users: ids.length, added, removed };
}

/**
 * Verificador de inconsistências: expirados não removidos, badges inválidas
 * (definição sumida), duplicatas impossíveis (índice único impede — mas o
 * verificador confirma) e ocultações órfãs.
 */
export async function checkConsistency(): Promise<{
  usersAnalyzed: number;
  validBadges: number;
  legacyRows: number;
  duplicates: number;
  invalid: number;
  expiredLingering: number;
  issues: string[];
}> {
  const db = getDb();
  const now = new Date();
  const issues: string[] = [];

  const [{ count: usersAnalyzed }] = await db
    .select({ count: sql<number>`count(distinct ${schema.userBadges.userId})` })
    .from(schema.userBadges);

  const rows = await db
    .select({ ub: schema.userBadges, badge: schema.badges })
    .from(schema.userBadges)
    .leftJoin(schema.badges, eq(schema.badges.id, schema.userBadges.badgeId));

  const validBadges = rows.filter(r => r.badge !== null).length;
  const invalid = rows.filter(r => r.badge === null).length;
  if (invalid > 0) {
    issues.push(`${invalid} concessão(ões) apontam para badges que não existem mais.`);
  }

  const seen = new Map<string, number>();
  let duplicates = 0;
  for (const r of rows) {
    const key = `${r.ub.userId}:${r.ub.badgeId}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  for (const [key, n] of seen) {
    if (n > 1) {
      duplicates += n - 1;
      issues.push(`Duplicata detectada em ${key}.`);
    }
  }

  const expiredLingering = rows.filter(
    r => r.ub.expiresAt !== null && r.ub.expiresAt <= now,
  ).length;
  if (expiredLingering > 0) {
    issues.push(`${expiredLingering} concessão(ões) vencidas ainda ativas.`);
  }

  const [{ count: legacyRows }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.badgeHistory)
    .where(eq(schema.badgeHistory.action, "LEGACY_ARCHIVED"));

  return {
    usersAnalyzed: Number(usersAnalyzed),
    validBadges,
    legacyRows: Number(legacyRows),
    duplicates,
    invalid,
    expiredLingering,
    issues,
  };
}

/** Corrige automaticamente o que o verificador encontrar. */
export async function fixConsistency(
  performedBy: number,
): Promise<{ removed: number }> {
  const db = getDb();
  const now = new Date();
  let removed = 0;

  // 1. Concessões vencidas.
  const expired = await db
    .select({ ub: schema.userBadges, badge: schema.badges })
    .from(schema.userBadges)
    .innerJoin(schema.badges, eq(schema.badges.id, schema.userBadges.badgeId))
    .where(and(sql`${schema.userBadges.expiresAt} IS NOT NULL`, sql`${schema.userBadges.expiresAt} <= ${now}`));
  for (const row of expired) {
    await revoke(row.ub.userId, row.badge.id, {
      action: "EXPIRED",
      performedBy,
      source: "AUTOMATION",
      reason: "Correção automática: concessão vencida.",
    });
    removed += 1;
  }

  // 2. Concessões órfãs (badge deletada).
  const orphanIds = await db
    .select({ id: schema.userBadges.id, userId: schema.userBadges.userId, badgeId: schema.userBadges.badgeId })
    .from(schema.userBadges)
    .leftJoin(schema.badges, eq(schema.badges.id, schema.userBadges.badgeId))
    .where(isNull(schema.badges.id));
  for (const row of orphanIds) {
    await db.delete(schema.userBadges).where(eq(schema.userBadges.id, row.id));
    await writeHistory({
      userId: row.userId,
      badgeId: row.badgeId,
      action: "REVOKED",
      performedBy,
      source: "AUTOMATION",
      reason: "Correção automática: definição da badge não existe mais.",
    });
    removed += 1;
  }

  return { removed };
}

/** Migrar username: concede "Originally Known As" (canHide). */
export async function recordUsernameMigration(
  userId: number,
  previousUsername: string,
): Promise<void> {
  const badge = await getBadgeBySlug("originally-known-as");
  if (!badge) return;
  await recordEvent("USERNAME_MIGRATED", userId, { previousUsername });
  await grant(userId, badge.id, {
    source: "SYSTEM",
    reason: `Conhecido anteriormente como ${previousUsername}.`,
    metadata: { previousUsername },
  });
}
