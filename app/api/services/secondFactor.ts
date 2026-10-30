import { and, eq, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../queries/connection";
import * as schema from "@db/schema";
import { decryptSecret } from "../lib/crypto";
import { verifyBackupCode, verifyTotp } from "./mfa";

/**
 * Valida o segundo fator de uma conta. Se não houver 2FA configurado, a
 * operação passa sem exigir código. O código de backup é consumido de forma
 * condicional para impedir reutilização sob concorrência.
 */
export async function assertTotpOrBackup(
  userId: number,
  code: string,
): Promise<void> {
  const settings = await getDb().query.totpSettings.findFirst({
    where: and(
      eq(schema.totpSettings.userId, userId),
      eq(schema.totpSettings.enabled, true),
    ),
  });
  if (!settings) return;

  const secret = decryptSecret(settings.encryptedSecret);
  if (secret) {
    const result = verifyTotp(secret, code, {
      minStepExclusive:
        settings.lastUsedStep == null ? undefined : Number(settings.lastUsedStep),
    });
    if (result.valid && result.step != null) {
      await getDb()
        .update(schema.totpSettings)
        .set({ lastUsedStep: result.step })
        .where(eq(schema.totpSettings.userId, userId));
      return;
    }
  }

  const codes = await getDb()
    .select()
    .from(schema.backupCodes)
    .where(
      and(
        eq(schema.backupCodes.userId, userId),
        isNull(schema.backupCodes.usedAt),
      ),
    );
  const match = codes.find(row => verifyBackupCode(code, row.codeHash));
  if (match) {
    const result = await getDb()
      .update(schema.backupCodes)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(schema.backupCodes.id, match.id),
          isNull(schema.backupCodes.usedAt),
        ),
      );
    const affected =
      (result as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 0;
    if (affected === 1) return;
  }

  throw new TRPCError({
    code: "UNAUTHORIZED",
    message: "Código de autenticação inválido ou já utilizado.",
  });
}

export function isEmailLike(value: string): boolean {
  return value.includes("@") && value.length <= 320;
}

export function maskEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const [local, domain] = value.split("@");
  if (!local || !domain) return null;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"•".repeat(Math.max(2, local.length - visible.length))}@${domain}`;
}
