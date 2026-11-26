import "server-only";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { cueOf, type LearnedAct } from "@/core/ri/act-learning.ts";
import type { ActEffect } from "@/core/ri/acts.ts";
import type { Database } from "@/db/index.ts";
import { riLearnedActs } from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";
import type { Actor } from "./ri.ts";

/**
 * The atos the office taught (core/ri/act-learning): each ato saved or
 * corrected teaches its natureza's words, R or AV and its effect. The
 * latest correction wins. "Esquecer" marks the row; it stays in the bank.
 */

export async function learnActWith(
  database: Database,
  tenantSlug: string,
  input: { nature: string; kind: "R" | "AV"; effect: ActEffect },
  actor: Actor,
): Promise<void> {
  const cue = cueOf(input.nature);
  if (!cue) return;
  const [row] = await database
    .select()
    .from(riLearnedActs)
    .where(
      and(eq(riLearnedActs.tenantSlug, tenantSlug), eq(riLearnedActs.cue, cue)),
    )
    .limit(1);
  if (row?.removedAt) return; // forgotten on purpose: not learned again
  if (row) {
    await database
      .update(riLearnedActs)
      .set({
        kind: input.kind,
        effect: input.effect,
        uses: sql`${riLearnedActs.uses} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(riLearnedActs.id, row.id));
    return;
  }
  await database.insert(riLearnedActs).values({
    tenantSlug,
    cue,
    kind: input.kind,
    effect: input.effect,
    createdBy: actor.id,
  });
}

export async function listLearnedActsWith(
  database: Database,
  tenantSlug: string,
): Promise<(LearnedAct & { id: string })[]> {
  const rows = await database
    .select()
    .from(riLearnedActs)
    .where(
      and(
        eq(riLearnedActs.tenantSlug, tenantSlug),
        isNull(riLearnedActs.removedAt),
      ),
    )
    .orderBy(asc(riLearnedActs.cue));
  return rows.map((r) => ({
    id: r.id,
    cue: r.cue,
    kind: r.kind === "AV" ? "AV" : "R",
    effect: r.effect as ActEffect,
    uses: r.uses,
  }));
}

/** "Esquecer": the suggestion stops; the row and the audit stay. */
export async function forgetLearnedActWith(
  database: Database,
  tenantSlug: string,
  id: string,
  reason: string,
  actor: Actor,
): Promise<void> {
  await database
    .update(riLearnedActs)
    .set({ removedAt: new Date(), removedBy: actor.id })
    .where(
      and(eq(riLearnedActs.tenantSlug, tenantSlug), eq(riLearnedActs.id, id)),
    );
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "ri.learned-act-forget",
    targetType: "ri-learned-act",
    targetId: id,
    reason: reason.slice(0, 2000) || undefined,
  });
}
