import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { formatGuideNumber } from "@/core/guides/schema.ts";
import {
  buildReportDocuments,
  buildSnapshot,
  defaultSecurityPaperSettings,
  type ReportKind,
  type ReportSnapshot,
  type SecurityPaperSettings,
  SecurityPaperSettingsSchema,
} from "@/core/security-paper/documents.ts";
import {
  checkLot,
  checkRange,
  type MovementType,
  type PaperKind,
  type PaperLot,
  type PaperMovement,
  type Period,
  pendingDuties,
  type Quarter,
  rangeForQuantity,
} from "@/core/security-paper/stock.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { officeYear } from "@/core/time/office-time.ts";
import { isPostgresError, UNIQUE_VIOLATION } from "@/db/errors.ts";
import { type Database, db } from "@/db/index.ts";
import {
  securityPaperLots,
  securityPaperMovements,
  securityPaperReports,
  tenantContent,
} from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";
import { brandFor } from "./document-brand.ts";
import { nextNumberWith } from "./document-numbering.ts";
import { OFFICE_SECURITY_PAPER_KEY } from "./office-config.ts";
import { renderDocuments } from "./pdf.ts";

/** A refusal in the office's words, shown as it is. */
export class SecurityPaperError extends Error {}

/* --------------------------------------------------------------- settings */

export async function getSecurityPaperSettingsWith(
  database: Database,
  tenant: Tenant,
): Promise<SecurityPaperSettings> {
  try {
    const [row] = await database
      .select({ published: tenantContent.published })
      .from(tenantContent)
      .where(
        and(
          eq(tenantContent.tenantSlug, tenant.slug),
          eq(tenantContent.key, OFFICE_SECURITY_PAPER_KEY),
        ),
      )
      .limit(1);
    const parsed = SecurityPaperSettingsSchema.safeParse(row?.published);
    if (parsed.success) return parsed.data;
  } catch {
    // The database being down shows the defaults, never a broken screen.
  }
  return defaultSecurityPaperSettings(tenant);
}

export const getSecurityPaperSettings = (tenant: Tenant) =>
  getSecurityPaperSettingsWith(db, tenant);

export async function saveSecurityPaperSettingsWith(
  database: Database,
  tenantSlug: string,
  settings: SecurityPaperSettings,
  actorId: string,
): Promise<void> {
  const now = new Date();
  await database
    .insert(tenantContent)
    .values({
      tenantSlug,
      key: OFFICE_SECURITY_PAPER_KEY,
      published: settings,
      publishedAt: now,
      updatedBy: actorId,
    })
    .onConflictDoUpdate({
      target: [tenantContent.tenantSlug, tenantContent.key],
      set: {
        published: settings,
        publishedAt: now,
        updatedAt: now,
        updatedBy: actorId,
      },
    });
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "office-settings.save",
    targetType: "tenant-content",
    targetId: OFFICE_SECURITY_PAPER_KEY,
  });
}

/* ------------------------------------------------------------------ rows */

export type StoredLot = typeof securityPaperLots.$inferSelect;
export type StoredMovement = typeof securityPaperMovements.$inferSelect;
export type StoredReport = typeof securityPaperReports.$inferSelect;

export function lotOf(row: StoredLot): PaperLot {
  return {
    id: row.id,
    kind: row.kind as PaperKind,
    kindLabel: row.kindLabel,
    prefix: row.prefix,
    first: row.firstNumber,
    last: row.lastNumber,
    digits: row.digits,
    receivedOn: row.receivedOn,
    opening: row.opening,
    supplier: row.supplier,
    invoice: row.invoice,
    requisition: row.requisition,
    notes: row.notes,
    voided: row.voidedAt !== null,
  };
}

export function movementOf(row: StoredMovement): PaperMovement {
  return {
    id: row.id,
    lotId: row.lotId,
    type: row.type as MovementType,
    first: row.firstNumber,
    last: row.lastNumber,
    occurredOn: row.occurredOn,
    reference: row.reference,
    notes: row.notes,
    voided: row.voidedAt !== null,
  };
}

export async function listLotsWith(database: Database, tenantSlug: string) {
  return database
    .select()
    .from(securityPaperLots)
    .where(eq(securityPaperLots.tenantSlug, tenantSlug))
    .orderBy(
      desc(securityPaperLots.receivedOn),
      desc(securityPaperLots.createdAt),
    );
}

export async function listMovementsWith(
  database: Database,
  tenantSlug: string,
) {
  return database
    .select()
    .from(securityPaperMovements)
    .where(eq(securityPaperMovements.tenantSlug, tenantSlug))
    .orderBy(
      desc(securityPaperMovements.occurredOn),
      desc(securityPaperMovements.createdAt),
    );
}

export async function listReportsWith(database: Database, tenantSlug: string) {
  return database
    .select()
    .from(securityPaperReports)
    .where(eq(securityPaperReports.tenantSlug, tenantSlug))
    .orderBy(desc(securityPaperReports.createdAt));
}

export async function findReportWith(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<StoredReport | undefined> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  const [row] = await database
    .select()
    .from(securityPaperReports)
    .where(
      and(
        eq(securityPaperReports.tenantSlug, tenantSlug),
        eq(securityPaperReports.id, id),
      ),
    )
    .limit(1);
  return row;
}

export async function findLotWith(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<StoredLot | undefined> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  const [row] = await database
    .select()
    .from(securityPaperLots)
    .where(
      and(
        eq(securityPaperLots.tenantSlug, tenantSlug),
        eq(securityPaperLots.id, id),
      ),
    )
    .limit(1);
  return row;
}

/** Everything the classificador holds, as the core reads it. */
export async function classifierWith(database: Database, tenantSlug: string) {
  const [lots, movements] = await Promise.all([
    listLotsWith(database, tenantSlug),
    listMovementsWith(database, tenantSlug),
  ]);
  return {
    lotRows: lots,
    movementRows: movements,
    lots: lots.map(lotOf),
    movements: movements.map(movementOf),
  };
}

/* ------------------------------------------------------------------ lots */

export interface LotInput {
  kind: PaperKind;
  kindLabel: string;
  prefix: string;
  first: number;
  last: number;
  digits: number;
  receivedOn: string;
  opening: boolean;
  supplier: string;
  invoice: string;
  requisition: string;
  notes: string;
  invoiceFile?: { path: string; name: string } | null;
}

export async function addLotWith(
  database: Database,
  tenantSlug: string,
  input: LotInput,
  actorId: string,
): Promise<StoredLot> {
  const existing = (await listLotsWith(database, tenantSlug)).map(lotOf);
  const problem = checkLot(input, existing);
  if (problem) throw new SecurityPaperError(problem);
  const [row] = await database
    .insert(securityPaperLots)
    .values({
      tenantSlug,
      kind: input.kind,
      kindLabel: input.kind === "outro" ? input.kindLabel : "",
      prefix: input.prefix,
      firstNumber: input.first,
      lastNumber: input.last,
      digits: input.digits,
      receivedOn: input.receivedOn,
      opening: input.opening,
      supplier: input.supplier,
      invoice: input.invoice,
      requisition: input.requisition,
      notes: input.notes,
      invoicePath: input.invoiceFile?.path ?? null,
      invoiceName: input.invoiceFile?.name ?? null,
      createdBy: actorId,
    })
    .returning();
  if (!row) throw new Error("lote não gravado");
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "security-paper.lot-add",
    targetType: "security-paper",
    targetId: row.id,
  });
  return row;
}

/**
 * The lot's details that do not change the stock: the nota, the printer,
 * the requisition, the notes, the scanned nota. The numbering never changes
 * here: a lot typed wrong is voided and registered again.
 */
export async function updateLotDetailsWith(
  database: Database,
  tenantSlug: string,
  id: string,
  details: Pick<LotInput, "supplier" | "invoice" | "requisition" | "notes"> & {
    invoiceFile?: { path: string; name: string } | null;
  },
  actorId: string,
): Promise<void> {
  const lot = await findLotWith(database, tenantSlug, id);
  if (!lot) throw new SecurityPaperError("Lote não encontrado.");
  await database
    .update(securityPaperLots)
    .set({
      supplier: details.supplier,
      invoice: details.invoice,
      requisition: details.requisition,
      notes: details.notes,
      ...(details.invoiceFile
        ? {
            invoicePath: details.invoiceFile.path,
            invoiceName: details.invoiceFile.name,
          }
        : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(securityPaperLots.tenantSlug, tenantSlug),
        eq(securityPaperLots.id, id),
      ),
    );
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "security-paper.lot-update",
    targetType: "security-paper",
    targetId: id,
  });
}

/** Voids a lot nothing was taken from yet; it stays in the classificador. */
export async function voidLotWith(
  database: Database,
  tenantSlug: string,
  id: string,
  reason: string,
  actorId: string,
): Promise<void> {
  const lot = await findLotWith(database, tenantSlug, id);
  if (!lot || lot.voidedAt) {
    throw new SecurityPaperError("Lote não encontrado.");
  }
  const used = await database
    .select({ id: securityPaperMovements.id })
    .from(securityPaperMovements)
    .where(
      and(
        eq(securityPaperMovements.lotId, id),
        isNull(securityPaperMovements.voidedAt),
      ),
    )
    .limit(1);
  if (used.length) {
    throw new SecurityPaperError(
      "Este lote já tem lançamentos. Anule os lançamentos antes de anular o lote.",
    );
  }
  await database
    .update(securityPaperLots)
    .set({
      voidedAt: new Date(),
      voidedBy: actorId,
      voidReason: reason,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(securityPaperLots.tenantSlug, tenantSlug),
        eq(securityPaperLots.id, id),
      ),
    );
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "security-paper.lot-void",
    targetType: "security-paper",
    targetId: id,
    reason,
  });
}

/* ------------------------------------------------------------- movements */

export interface MovementInput {
  lotId: string;
  type: MovementType;
  /** Either the numbers... */
  first?: number;
  last?: number;
  /** ...or how many, from the next free sheet on. */
  quantity?: number;
  occurredOn: string;
  reference: string;
  notes: string;
}

const MOVEMENT_ACTION: Record<MovementType, string> = {
  utilizado: "security-paper.use",
  inutilizado: "security-paper.spoil",
  avariado: "security-paper.spoil",
  extraviado: "security-paper.loss",
  subtraido: "security-paper.loss",
};

/**
 * Takes the range out of the lot, in a transaction that locks the lot, so
 * two clerks never give the same sheet twice.
 */
export async function addMovementWith(
  database: Database,
  tenantSlug: string,
  input: MovementInput,
  actorId: string,
): Promise<StoredMovement> {
  return database.transaction(async (tx) => {
    const [lotRow] = await tx
      .select()
      .from(securityPaperLots)
      .where(
        and(
          eq(securityPaperLots.tenantSlug, tenantSlug),
          eq(securityPaperLots.id, input.lotId),
        ),
      )
      .for("update")
      .limit(1);
    if (!lotRow) throw new SecurityPaperError("Escolha o lote.");
    const lot = lotOf(lotRow);
    if (input.occurredOn < lot.receivedOn && !lot.opening) {
      throw new SecurityPaperError(
        "A data do lançamento é anterior ao recebimento do lote.",
      );
    }
    const taken = (
      await tx
        .select()
        .from(securityPaperMovements)
        .where(eq(securityPaperMovements.lotId, lot.id))
    ).map(movementOf);
    const range =
      input.first !== undefined
        ? { first: input.first, last: input.last ?? input.first }
        : rangeForQuantity(lot, taken, input.quantity ?? 0);
    if (typeof range === "string") throw new SecurityPaperError(range);
    const problem = checkRange(lot, taken, range);
    if (problem) throw new SecurityPaperError(problem);
    const [row] = await tx
      .insert(securityPaperMovements)
      .values({
        tenantSlug,
        lotId: lot.id,
        type: input.type,
        firstNumber: range.first,
        lastNumber: range.last,
        occurredOn: input.occurredOn,
        reference: input.reference,
        notes: input.notes,
        createdBy: actorId,
      })
      .returning();
    if (!row) throw new Error("lançamento não gravado");
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId,
      action: MOVEMENT_ACTION[input.type],
      targetType: "security-paper",
      targetId: row.id,
    });
    return row;
  });
}

/** Voids a movement: the sheets go back to the stock; the row stays. */
export async function voidMovementWith(
  database: Database,
  tenantSlug: string,
  id: string,
  reason: string,
  actorId: string,
): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    throw new SecurityPaperError("Lançamento não encontrado.");
  }
  const updated = await database
    .update(securityPaperMovements)
    .set({ voidedAt: new Date(), voidedBy: actorId, voidReason: reason })
    .where(
      and(
        eq(securityPaperMovements.tenantSlug, tenantSlug),
        eq(securityPaperMovements.id, id),
        isNull(securityPaperMovements.voidedAt),
      ),
    )
    .returning({ id: securityPaperMovements.id });
  if (!updated.length) {
    throw new SecurityPaperError("Lançamento não encontrado.");
  }
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "security-paper.movement-void",
    targetType: "security-paper",
    targetId: id,
    reason,
  });
}

/* --------------------------------------------------------------- reports */

const ATTEMPTS = 5;

export function snapshotOf(row: StoredReport): ReportSnapshot {
  return row.snapshot as ReportSnapshot;
}

/** "012/2026" */
export function reportNumber(row: Pick<StoredReport, "year" | "sequence">) {
  return row.sequence ? formatGuideNumber(row.year, row.sequence) : null;
}

/**
 * Issues an ofício (numbered, series "oficio-papel") or the classificador's
 * report, with what it says frozen as of now.
 */
export async function issueReportWith(
  database: Database,
  tenant: Tenant,
  input: {
    kind: ReportKind;
    period: Period;
    issuedOn: string;
    notes: string;
    signerIndex: number;
    signers: { name: string; title: string; note?: string }[];
    /** For "extravio": the movements to tell; the period's by default. */
    movementIds?: string[];
  },
  actorId: string,
  now = new Date(),
): Promise<StoredReport> {
  const [{ lots, movements }, settings, reports] = await Promise.all([
    classifierWith(database, tenant.slug),
    getSecurityPaperSettingsWith(database, tenant),
    listReportsWith(database, tenant.slug),
  ]);
  const toldBy = reports
    .filter(
      (r) =>
        r.kind === "extravio" &&
        r.periodEnd >= input.period.start &&
        r.periodStart <= input.period.end,
    )
    .map((r) => reportNumber(r))
    .filter((n): n is string => Boolean(n))
    .reverse();
  const numbered = input.kind !== "relatorio";
  const year = officeYear(now);
  for (let attempt = 1; ; attempt++) {
    try {
      const sequence = numbered
        ? await nextNumberWith(database, tenant.slug, "oficio-papel", year)
        : null;
      const snapshot = buildSnapshot({
        kind: input.kind,
        period: input.period,
        issuedOn: input.issuedOn,
        number: sequence ? formatGuideNumber(year, sequence) : null,
        settings,
        lots,
        movements,
        movementIds: input.movementIds,
        toldBy,
        notes: input.notes,
        signer: input.signers[input.signerIndex] ?? input.signers[0] ?? null,
      });
      if (input.kind === "extravio" && snapshot.movements.length === 0) {
        throw new SecurityPaperError(
          "Não há extravio, subtração ou avaria lançados nesse período.",
        );
      }
      const [row] = await database
        .insert(securityPaperReports)
        .values({
          tenantSlug: tenant.slug,
          kind: input.kind,
          year,
          sequence,
          periodStart: input.period.start,
          periodEnd: input.period.end,
          snapshot,
          movementIds:
            input.kind === "extravio"
              ? snapshot.movements.map((m) => m.id)
              : [],
          signer: input.signerIndex,
          createdBy: actorId,
          createdAt: now,
        })
        .returning();
      if (!row) throw new Error("ofício não gravado");
      await recordAuditWith(database, {
        tenantSlug: tenant.slug,
        actorId,
        action: "security-paper.report-issue",
        targetType: "security-paper",
        targetId: row.id,
      });
      return row;
    } catch (error) {
      if (!isPostgresError(error, UNIQUE_VIOLATION) || attempt >= ATTEMPTS) {
        throw error;
      }
    }
  }
}

/** When the ofício reached the Corregedoria, and the protocol or malote. */
export async function recordReportSentWith(
  database: Database,
  tenantSlug: string,
  id: string,
  sentOn: string,
  reference: string,
  actorId: string,
): Promise<void> {
  const report = await findReportWith(database, tenantSlug, id);
  if (!report) throw new SecurityPaperError("Ofício não encontrado.");
  await database
    .update(securityPaperReports)
    .set({ sentOn, sentReference: reference })
    .where(
      and(
        eq(securityPaperReports.tenantSlug, tenantSlug),
        eq(securityPaperReports.id, id),
      ),
    );
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "security-paper.report-sent",
    targetType: "security-paper",
    targetId: id,
  });
}

/** The ofício (and its annex) or the report, as issued. */
export async function renderReportPdf(
  tenant: Tenant,
  row: StoredReport,
): Promise<Buffer> {
  return renderDocuments(
    buildReportDocuments(tenant, snapshotOf(row)),
    await brandFor(tenant),
  );
}

/* ------------------------------------------------------------- reminders */

/** What the Corregedoria is still owed, for the panel and the e-mail. */
export async function pendingDutiesWith(
  database: Database,
  tenantSlug: string,
  today: string,
): Promise<{ quarter: Quarter | null; occurrences: PaperMovement[] }> {
  const [{ lots, movements }, reports] = await Promise.all([
    classifierWith(database, tenantSlug),
    listReportsWith(database, tenantSlug),
  ]);
  return pendingDuties({
    today,
    lots,
    movements,
    reports: reports.map((r) => ({
      kind: r.kind as ReportKind,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      movementIds: r.movementIds,
    })),
  });
}

/** How many papers are owed: the badge on the menu. */
export async function pendingDutyCount(
  tenantSlug: string,
  today: string,
): Promise<number> {
  try {
    const duties = await pendingDutiesWith(db, tenantSlug, today);
    return (duties.quarter ? 1 : 0) + (duties.occurrences.length ? 1 : 0);
  } catch {
    return 0;
  }
}
