import "server-only";
import { and, eq } from "drizzle-orm";
import {
  type AiPlatformPolicy,
  aiPlatformFrom,
  type NoteReviewMode,
} from "@/core/qualificacao/revisao-base.ts";
import type { Database } from "@/db/index.ts";
import { tenantContent } from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";
import { PLATFORM_AI_KEY } from "./office-config.ts";

/**
 * The Átrios account's hold over an office's AI (decision of 16/11/2026):
 * the office never sees this switch nor who turned it, only that the
 * Assistente Virtual is unavailable.
 */
export async function getAiPlatformWith(
  database: Database,
  tenantSlug: string,
): Promise<AiPlatformPolicy> {
  const [row] = await database
    .select({ published: tenantContent.published })
    .from(tenantContent)
    .where(
      and(
        eq(tenantContent.tenantSlug, tenantSlug),
        eq(tenantContent.key, PLATFORM_AI_KEY),
      ),
    )
    .limit(1);
  return aiPlatformFrom(row?.published);
}

export async function setAiPlatformWith(
  database: Database,
  tenantSlug: string,
  input: { aiAllowed: boolean; noteReview: NoteReviewMode; reason: string },
  actorId: string,
  now = new Date(),
): Promise<void> {
  const reason = input.reason.trim().slice(0, 300);
  const published: AiPlatformPolicy = {
    aiAllowed: input.aiAllowed,
    noteReview: input.noteReview,
    changedAt: now.toISOString(),
    changedBy: actorId,
    ...(reason ? { reason } : {}),
  };
  await database
    .insert(tenantContent)
    .values({
      tenantSlug,
      key: PLATFORM_AI_KEY,
      published,
      publishedAt: now,
      updatedBy: actorId,
    })
    .onConflictDoUpdate({
      target: [tenantContent.tenantSlug, tenantContent.key],
      set: { published, publishedAt: now, updatedAt: now, updatedBy: actorId },
    });
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "ai.platform",
    targetType: "tenant",
    targetId: `${tenantSlug} · IA ${input.aiAllowed ? "liberada" : "suspensa"} · análise das notas: ${input.noteReview}`,
    ...(reason ? { reason } : {}),
  });
}
