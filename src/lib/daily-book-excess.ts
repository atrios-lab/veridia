import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { summarize } from "@/core/daily-book/book.ts";
import {
  buildExcessDocument,
  type ExcessCalc,
  type ExcessInput,
} from "@/core/daily-book/excess.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import type { Database } from "@/db/index.ts";
import { tenantContent } from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";
import { DailyBookError, entryOf, listEntriesWith } from "./daily-book.ts";
import { brandFor } from "./document-brand.ts";
import { OFFICE_INTERIM_EXCESS_KEY } from "./office-config.ts";
import { renderDocument } from "./pdf.ts";

/**
 * The interim's excess calculations (decision of 12/11/2026), kept so each
 * one can be printed and signed, edited, or removed with a reason. Removed
 * ones stay, marked; nothing is deleted.
 */

async function readAll(
  database: Database,
  tenantSlug: string,
): Promise<ExcessCalc[]> {
  const [row] = await database
    .select({ published: tenantContent.published })
    .from(tenantContent)
    .where(
      and(
        eq(tenantContent.tenantSlug, tenantSlug),
        eq(tenantContent.key, OFFICE_INTERIM_EXCESS_KEY),
      ),
    )
    .limit(1);
  return Array.isArray(row?.published) ? (row.published as ExcessCalc[]) : [];
}

async function writeAll(
  database: Database,
  tenantSlug: string,
  calcs: ExcessCalc[],
  actorId: string,
): Promise<void> {
  const now = new Date();
  await database
    .insert(tenantContent)
    .values({
      tenantSlug,
      key: OFFICE_INTERIM_EXCESS_KEY,
      published: calcs,
      publishedAt: now,
      updatedBy: actorId,
    })
    .onConflictDoUpdate({
      target: [tenantContent.tenantSlug, tenantContent.key],
      set: {
        published: calcs,
        publishedAt: now,
        updatedAt: now,
        updatedBy: actorId,
      },
    });
}

function check(input: ExcessInput): void {
  const date = /^\d{4}-\d{2}-\d{2}$/;
  if (!date.test(input.start) || !date.test(input.end)) {
    throw new DailyBookError("Confira o período.");
  }
  if (input.end < input.start) throw new DailyBookError("Confira o período.");
  for (const v of [
    input.subsidyCents,
    input.revenueCents,
    input.expensesCents,
  ]) {
    if (!Number.isInteger(v) || v < 0)
      throw new DailyBookError("Confira os valores.");
  }
  if (input.subsidyCents === 0) {
    throw new DailyBookError("Informe o subsídio mensal de ministro do STF.");
  }
}

export async function listExcessWith(
  database: Database,
  tenantSlug: string,
  options: { withRemoved?: boolean } = {},
): Promise<ExcessCalc[]> {
  const all = await readAll(database, tenantSlug).catch(() => []);
  return all
    .filter((c) => options.withRemoved || !c.removedAt)
    .sort(
      (a, b) =>
        b.start.localeCompare(a.start) ||
        b.createdAt.localeCompare(a.createdAt),
    );
}

export async function findExcessWith(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<ExcessCalc | undefined> {
  return (await readAll(database, tenantSlug)).find((c) => c.id === id);
}

export async function saveExcessWith(
  database: Database,
  tenantSlug: string,
  input: ExcessInput & { notes: string },
  actorId: string,
  id?: string,
): Promise<ExcessCalc> {
  check(input);
  const all = await readAll(database, tenantSlug);
  const now = new Date().toISOString();
  let saved: ExcessCalc;
  if (id) {
    const old = all.find((c) => c.id === id && !c.removedAt);
    if (!old) throw new DailyBookError("Cálculo não encontrado.");
    saved = { ...old, ...input, notes: input.notes.trim(), updatedAt: now };
    await writeAll(
      database,
      tenantSlug,
      all.map((c) => (c.id === id ? saved : c)),
      actorId,
    );
  } else {
    saved = {
      ...input,
      notes: input.notes.trim(),
      id: randomUUID(),
      createdAt: now,
      createdBy: actorId,
    };
    await writeAll(database, tenantSlug, [...all, saved], actorId);
  }
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: id ? "daily-book.excess-edit" : "daily-book.excess-save",
    targetType: "daily-book",
    targetId: saved.id,
  });
  return saved;
}

/** Marked removed, with the reason; it stays stored. */
export async function removeExcessWith(
  database: Database,
  tenantSlug: string,
  id: string,
  reason: string,
  actorId: string,
): Promise<void> {
  const all = await readAll(database, tenantSlug);
  if (!all.some((c) => c.id === id && !c.removedAt)) {
    throw new DailyBookError("Cálculo não encontrado.");
  }
  const now = new Date().toISOString();
  await writeAll(
    database,
    tenantSlug,
    all.map((c) =>
      c.id === id
        ? { ...c, removedAt: now, removedBy: actorId, removeReason: reason }
        : c,
    ),
    actorId,
  );
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "daily-book.excess-remove",
    targetType: "daily-book",
    targetId: id,
    reason,
  });
}

/**
 * The period's receipts and expenses as the book has them, the interim's
 * own pay (CGJ/RN art. 26) left out of the expenses.
 */
export async function bookFiguresWith(
  database: Database,
  tenantSlug: string,
  period: { start: string; end: string },
): Promise<{ revenueCents: number; expensesCents: number }> {
  const entries = (await listEntriesWith(database, tenantSlug, period))
    .map(entryOf)
    .filter((e) => !(e.kind === "despesa" && e.category === "interino"));
  const sum = summarize(entries);
  return { revenueCents: sum.revenueCents, expensesCents: sum.expensesCents };
}

export async function renderExcessPdf(
  tenant: Tenant,
  calc: ExcessCalc,
  issuedOn: string,
): Promise<Buffer> {
  return renderDocument(
    buildExcessDocument(tenant, calc, issuedOn),
    await brandFor(tenant),
  );
}
