import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import type { Act } from "@/core/ri/acts.ts";
import { situationOf } from "@/core/ri/acts.ts";
import type { Database } from "@/db/index.ts";
import { riPendencyMarks } from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";
import type { Actor } from "./ri.ts";

/**
 * The owners a matrícula shows: the situação in force, or, when the atos
 * came in without the effect set (read from old fichas), anyone lançado as
 * proprietário or adquirente in any ato.
 */
export function ownerCountOf(acts: readonly Act[]): number {
  const owners = situationOf(acts).owners.length;
  if (owners > 0) return owners;
  return acts.flatMap((a) =>
    a.parties.filter((p) => p.role === "titular" || p.role === "adquirente"),
  ).length;
}

export const pendencyKey = (kind: string, ids: readonly string[]) =>
  `${kind}:${[...ids].sort().join(",")}`;

/** The pendências marked done (and not undone). */
export async function markedPendenciesWith(
  database: Database,
  tenantSlug: string,
): Promise<Map<string, { at: Date; note: string }>> {
  const rows = await database
    .select()
    .from(riPendencyMarks)
    .where(
      and(
        eq(riPendencyMarks.tenantSlug, tenantSlug),
        isNull(riPendencyMarks.undoneAt),
      ),
    );
  return new Map(rows.map((r) => [r.key, { at: r.markedAt, note: r.note }]));
}

export async function markPendencyWith(
  database: Database,
  tenantSlug: string,
  key: string,
  note: string,
  undo: boolean,
  actor: Actor,
): Promise<void> {
  if (undo) {
    await database
      .update(riPendencyMarks)
      .set({ undoneAt: new Date(), undoneBy: actor.id })
      .where(
        and(
          eq(riPendencyMarks.tenantSlug, tenantSlug),
          eq(riPendencyMarks.key, key),
          isNull(riPendencyMarks.undoneAt),
        ),
      );
  } else {
    await database.insert(riPendencyMarks).values({
      tenantSlug,
      key: key.slice(0, 2000),
      note: note.trim().slice(0, 2000),
      markedBy: actor.id,
    });
  }
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: undo ? "ri.pendency-reopen" : "ri.pendency-done",
    targetType: "ri-pendency",
    targetId: null,
    reason: note.trim().slice(0, 2000) || key.split(":")[0],
  });
}
