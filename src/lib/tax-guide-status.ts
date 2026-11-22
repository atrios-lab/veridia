import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import {
  EMPTY_GUIDE_STATUS,
  type GuideStatusInput,
  type GuideStatusRecord,
  guideStatusInputSchema,
  guideStatusRecordSchema,
  guideStatusSummary,
} from "@/core/guides/status.ts";
import { type Database, db } from "@/db/index.ts";
import { tenantContent } from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";
import { findGuideWith } from "./tax-guides.ts";
import type { StoredAttachment } from "./uploads.ts";

/**
 * Each guia's step (aguardando pagamento, paga, concluída) and its
 * comprovante, one `tenant_content` row per guia, keyed by its id. Nothing
 * here deletes: a correction keeps the previous version in the history,
 * "voltar para aguardando" keeps the step it leaves, and taking the
 * comprovante off keeps the file and its record; each one is in the audit.
 */

const KEY_PREFIX = "tax-guide-status:";
const keyOf = (guideId: string) => `${KEY_PREFIX}${guideId}`;

function parse(value: unknown): GuideStatusRecord {
  const parsed = guideStatusRecordSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : EMPTY_GUIDE_STATUS;
}

export function parseGuideStatusInput(input: unknown): GuideStatusInput {
  return guideStatusInputSchema.parse(input);
}

export async function getGuideStatusWith(
  database: Database,
  tenantSlug: string,
  guideId: string,
): Promise<GuideStatusRecord> {
  const [row] = await database
    .select({ published: tenantContent.published })
    .from(tenantContent)
    .where(
      and(
        eq(tenantContent.tenantSlug, tenantSlug),
        eq(tenantContent.key, keyOf(guideId)),
      ),
    )
    .limit(1);
  return parse(row?.published);
}

export function getGuideStatus(
  tenantSlug: string,
  guideId: string,
): Promise<GuideStatusRecord> {
  return getGuideStatusWith(db, tenantSlug, guideId);
}

/** The steps of several guias at once, for the lists. */
export async function listGuideStatusesWith(
  database: Database,
  tenantSlug: string,
  guideIds: readonly string[],
): Promise<Map<string, GuideStatusRecord>> {
  const result = new Map<string, GuideStatusRecord>();
  if (guideIds.length === 0) return result;
  const rows = await database
    .select({ key: tenantContent.key, published: tenantContent.published })
    .from(tenantContent)
    .where(
      and(
        eq(tenantContent.tenantSlug, tenantSlug),
        inArray(tenantContent.key, guideIds.map(keyOf)),
      ),
    );
  for (const row of rows) {
    result.set(row.key.slice(KEY_PREFIX.length), parse(row.published));
  }
  return result;
}

export function listGuideStatuses(
  tenantSlug: string,
  guideIds: readonly string[],
): Promise<Map<string, GuideStatusRecord>> {
  return listGuideStatusesWith(db, tenantSlug, guideIds);
}

async function write(
  database: Database,
  tenantSlug: string,
  guideId: string,
  value: GuideStatusRecord,
  actorId: string,
): Promise<void> {
  await database
    .insert(tenantContent)
    .values({
      tenantSlug,
      key: keyOf(guideId),
      published: value,
      updatedBy: actorId,
    })
    .onConflictDoUpdate({
      target: [tenantContent.tenantSlug, tenantContent.key],
      set: { published: value, updatedAt: new Date(), updatedBy: actorId },
    });
}

export class GuideStatusError extends Error {}

/**
 * Sets (or corrects) the guia's step. A new comprovante replaces the one
 * shown; the earlier one stays in the history. Without a new one, the
 * comprovante already attached is kept.
 */
export async function setGuideStatusWith(
  database: Database,
  tenantSlug: string,
  guideId: string,
  input: GuideStatusInput,
  actorId: string,
  receipt?: StoredAttachment,
): Promise<GuideStatusRecord> {
  const guide = await findGuideWith(database, tenantSlug, guideId);
  if (!guide) throw new GuideStatusError("Guia não encontrada.");
  const stored = await getGuideStatusWith(database, tenantSlug, guideId);
  const now = new Date().toISOString();
  const previous = stored.current;
  const next: GuideStatusRecord = {
    current: {
      ...input,
      receipt: receipt
        ? { ...receipt, at: now, by: actorId }
        : (previous?.receipt ?? null),
      at: now,
      by: actorId,
    },
    history: previous
      ? [...stored.history, { ...previous, change: "edited" as const }].slice(
          -200,
        )
      : stored.history,
  };
  await write(database, tenantSlug, guideId, next, actorId);
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "tax-guide.status",
    targetType: "tax-guide",
    targetId: guideId,
    reason: `${guideStatusSummary(next)}${previous ? `; antes: ${guideStatusSummary(stored)}` : ""}`,
  });
  if (receipt) {
    await recordAuditWith(database, {
      tenantSlug,
      actorId,
      action: "tax-guide.receipt-attach",
      targetType: "tax-guide",
      targetId: guideId,
      reason: receipt.displayName,
    });
  }
  return next;
}

/** Back to "aguardando pagamento": the step it leaves stays in the history. */
export async function withdrawGuideStatusWith(
  database: Database,
  tenantSlug: string,
  guideId: string,
  actorId: string,
): Promise<void> {
  const stored = await getGuideStatusWith(database, tenantSlug, guideId);
  if (!stored.current) return;
  await write(
    database,
    tenantSlug,
    guideId,
    {
      current: null,
      history: [
        ...stored.history,
        { ...stored.current, change: "withdrawn" as const },
      ].slice(-200),
    },
    actorId,
  );
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "tax-guide.status-withdrawn",
    targetType: "tax-guide",
    targetId: guideId,
    reason: `antes: ${guideStatusSummary(stored)}`,
  });
}

/**
 * Takes the comprovante off the guia (a wrong file, another guia's): the
 * file and its record stay in the history, where the audit points.
 */
export async function withdrawGuideReceiptWith(
  database: Database,
  tenantSlug: string,
  guideId: string,
  actorId: string,
): Promise<void> {
  const stored = await getGuideStatusWith(database, tenantSlug, guideId);
  const current = stored.current;
  if (!current?.receipt) return;
  await write(
    database,
    tenantSlug,
    guideId,
    {
      current: { ...current, receipt: null },
      history: [
        ...stored.history,
        { ...current, change: "receipt-removed" as const },
      ].slice(-200),
    },
    actorId,
  );
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "tax-guide.receipt-withdrawn",
    targetType: "tax-guide",
    targetId: guideId,
    reason: current.receipt.displayName,
  });
}

/** The comprovante a guia shows now, or one of its history (by its stored
 * name), for the file route. */
export function receiptOf(
  record: GuideStatusRecord,
  storedName: string | null,
) {
  const all = [
    record.current?.receipt,
    ...record.history.map((h) => h.receipt),
  ].filter((r): r is NonNullable<typeof r> => Boolean(r));
  return storedName ? all.find((r) => r.storedName === storedName) : all[0];
}
