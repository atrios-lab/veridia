import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import { z } from "zod";
import {
  buildFilingReceipt,
  buildIssDocument,
  defaultIssSettings,
  type IssDeclarationInput,
  type IssSettings,
  IssSettingsSchema,
  issOf,
} from "@/core/iss/declaration.ts";
import { toIsoDate } from "@/core/scheduling/calendar.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { OFFICE_TIME_ZONE, officeYear } from "@/core/time/office-time.ts";
import { FUNDS_BY_STATE } from "@/core/transparency/rubrics.ts";
import { isPostgresError, UNIQUE_VIOLATION } from "@/db/errors.ts";
import { type Database, db } from "@/db/index.ts";
import {
  issDeclarations,
  tenantContent,
  transparencyBulletins,
} from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";
import { brandFor } from "./document-brand.ts";
import { nextNumberWith } from "./document-numbering.ts";
import { OFFICE_ISS_BULLETIN_KEY, OFFICE_ISS_KEY } from "./office-config.ts";
import { renderDocument } from "./pdf.ts";
import { upsertBulletinWith } from "./transparency.ts";
import { readStoredFile } from "./uploads.ts";

export class IssDeclarationError extends Error {}

/* --------------------------------------------------------------- settings */

async function readContent(
  database: Database,
  tenantSlug: string,
  key: string,
): Promise<unknown> {
  const [row] = await database
    .select({ published: tenantContent.published })
    .from(tenantContent)
    .where(
      and(eq(tenantContent.tenantSlug, tenantSlug), eq(tenantContent.key, key)),
    )
    .limit(1);
  return row?.published;
}

async function writeContent(
  database: Database,
  tenantSlug: string,
  key: string,
  value: unknown,
  actorId: string | null,
): Promise<void> {
  const now = new Date();
  await database
    .insert(tenantContent)
    .values({
      tenantSlug,
      key,
      published: value,
      publishedAt: now,
      updatedBy: actorId,
    })
    .onConflictDoUpdate({
      target: [tenantContent.tenantSlug, tenantContent.key],
      set: {
        published: value,
        publishedAt: now,
        updatedAt: now,
        updatedBy: actorId,
      },
    });
}

export async function getIssSettingsWith(
  database: Database,
  tenant: Tenant,
): Promise<IssSettings> {
  try {
    const parsed = IssSettingsSchema.safeParse(
      await readContent(database, tenant.slug, OFFICE_ISS_KEY),
    );
    if (parsed.success) {
      // Saved before the office's own address and contacts were here: they
      // start as the office's settings, until the holder changes them.
      const fallback = defaultIssSettings(tenant);
      return {
        ...parsed.data,
        officeAddress: parsed.data.officeAddress || fallback.officeAddress,
        officePhone: parsed.data.officePhone || fallback.officePhone,
        officeEmail: parsed.data.officeEmail || fallback.officeEmail,
      };
    }
  } catch {
    // The database being down shows the defaults, never a broken screen.
  }
  return defaultIssSettings(tenant);
}

export const getIssSettings = (tenant: Tenant) =>
  getIssSettingsWith(db, tenant);

export async function saveIssSettingsWith(
  database: Database,
  tenantSlug: string,
  settings: IssSettings,
  actorId: string,
): Promise<void> {
  await writeContent(database, tenantSlug, OFFICE_ISS_KEY, settings, actorId);
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "office-settings.save",
    targetType: "tenant-content",
    targetId: OFFICE_ISS_KEY,
  });
}

/* ------------------------------------------------------------ declarations */

export type StoredIssDeclaration = typeof issDeclarations.$inferSelect;

const ATTEMPTS = 5;

export interface IssAttachment {
  path: string;
  name: string;
}

/** Issues the declaration with the year's next number. */
export async function issueIssDeclarationWith(
  database: Database,
  tenantSlug: string,
  input: IssDeclarationInput,
  attachments: IssAttachment[],
  actorId: string,
  now = new Date(),
): Promise<StoredIssDeclaration> {
  const year = officeYear(now);
  for (let attempt = 1; ; attempt++) {
    try {
      const sequence = await nextNumberWith(
        database,
        tenantSlug,
        "declaracao-iss",
        year,
      );
      const [row] = await database
        .insert(issDeclarations)
        .values({
          tenantSlug,
          year,
          sequence,
          ...fields(input),
          ...papers(attachments),
          createdBy: actorId,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!row) throw new Error("declaração não gravada");
      await recordAuditWith(database, {
        tenantSlug,
        actorId,
        action: "iss-declaration.issue",
        targetType: "iss-declaration",
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

function fields(input: IssDeclarationInput) {
  return {
    competence: input.competence,
    emolumentsCents: input.emolumentsCents,
    rateBasisPoints: input.rateBasisPoints,
    issCents: issOf(input),
    issFromReport: input.issCents !== null,
    damNumber: input.damNumber,
    dueDate: input.dueDate,
    paidOn: input.paidOn,
    notes: input.notes,
  };
}

/** The papers, in the columns of before (the first) and in the list. */
function papers(attachments: IssAttachment[]) {
  return {
    attachmentPath: attachments[0]?.path ?? null,
    attachmentName: attachments[0]?.name ?? null,
    attachments,
  };
}

/** Every paper behind a declaration, the ones of before included. */
export function attachmentsOf(row: StoredIssDeclaration): IssAttachment[] {
  if (row.attachments?.length) return row.attachments;
  return row.attachmentPath
    ? [{ path: row.attachmentPath, name: row.attachmentName ?? "anexo.pdf" }]
    : [];
}

/** Corrects a declaration; papers sent again replace the old ones. */
export async function updateIssDeclarationWith(
  database: Database,
  tenantSlug: string,
  id: string,
  input: IssDeclarationInput,
  attachments: IssAttachment[],
  actorId: string,
  now = new Date(),
): Promise<StoredIssDeclaration> {
  const [row] = await database
    .update(issDeclarations)
    .set({
      ...fields(input),
      ...(attachments.length ? papers(attachments) : {}),
      updatedAt: now,
    })
    .where(
      and(
        eq(issDeclarations.tenantSlug, tenantSlug),
        eq(issDeclarations.id, id),
        isNull(issDeclarations.deletedAt),
      ),
    )
    .returning();
  if (!row) throw new IssDeclarationError("Declaração não encontrada.");
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "iss-declaration.update",
    targetType: "iss-declaration",
    targetId: row.id,
  });
  return row;
}

/** The number is already a live declaration's in that year. */
export class IssNumberTakenError extends IssDeclarationError {}

/**
 * Gives a declaration another number by hand, to follow the office's own
 * count. A number a live declaration holds is refused by the index.
 */
export async function renumberIssDeclarationWith(
  database: Database,
  tenantSlug: string,
  id: string,
  year: number,
  sequence: number,
  actorId: string,
): Promise<StoredIssDeclaration> {
  try {
    const [row] = await database
      .update(issDeclarations)
      .set({ year, sequence, updatedAt: new Date() })
      .where(
        and(
          eq(issDeclarations.tenantSlug, tenantSlug),
          eq(issDeclarations.id, id),
          isNull(issDeclarations.deletedAt),
        ),
      )
      .returning();
    if (!row) throw new IssDeclarationError("Declaração não encontrada.");
    await recordAuditWith(database, {
      tenantSlug,
      actorId,
      action: "iss-declaration.renumber",
      targetType: "iss-declaration",
      targetId: row.id,
    });
    return row;
  } catch (error) {
    if (isPostgresError(error, UNIQUE_VIOLATION)) {
      throw new IssNumberTakenError(
        `Já existe outra declaração com o número ${String(sequence).padStart(3, "0")}/${year}.`,
      );
    }
    throw error;
  }
}

/** Notes when the declaration reached the prefeitura, and its protocol. */
export async function recordIssFilingWith(
  database: Database,
  tenantSlug: string,
  id: string,
  filing: { filedOn: string; reference: string },
  actorId: string,
  now = new Date(),
): Promise<void> {
  const [row] = await database
    .update(issDeclarations)
    .set({
      filedOn: filing.filedOn,
      filingReference: filing.reference.trim().slice(0, 120),
      updatedAt: now,
    })
    .where(
      and(
        eq(issDeclarations.tenantSlug, tenantSlug),
        eq(issDeclarations.id, id),
        isNull(issDeclarations.deletedAt),
      ),
    )
    .returning({ id: issDeclarations.id });
  if (!row) throw new IssDeclarationError("Declaração não encontrada.");
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "iss-declaration.file",
    targetType: "iss-declaration",
    targetId: row.id,
  });
}

/** "Excluir": out of the list, kept with its trail; the number is free. */
export async function removeIssDeclarationWith(
  database: Database,
  tenantSlug: string,
  id: string,
  actorId: string,
  now = new Date(),
): Promise<void> {
  const [row] = await database
    .update(issDeclarations)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(issDeclarations.tenantSlug, tenantSlug),
        eq(issDeclarations.id, id),
        isNull(issDeclarations.deletedAt),
      ),
    )
    .returning({ id: issDeclarations.id });
  if (!row) throw new IssDeclarationError("Declaração não encontrada.");
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "iss-declaration.remove",
    targetType: "iss-declaration",
    targetId: row.id,
  });
}

export async function findIssDeclarationWith(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<StoredIssDeclaration | undefined> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  const [row] = await database
    .select()
    .from(issDeclarations)
    .where(
      and(
        eq(issDeclarations.tenantSlug, tenantSlug),
        eq(issDeclarations.id, id),
        isNull(issDeclarations.deletedAt),
      ),
    )
    .limit(1);
  return row;
}

export async function listIssDeclarationsWith(
  database: Database,
  tenantSlug: string,
): Promise<StoredIssDeclaration[]> {
  return database
    .select()
    .from(issDeclarations)
    .where(
      and(
        eq(issDeclarations.tenantSlug, tenantSlug),
        isNull(issDeclarations.deletedAt),
      ),
    )
    .orderBy(desc(issDeclarations.competence), desc(issDeclarations.createdAt));
}

export function inputOf(row: StoredIssDeclaration): IssDeclarationInput {
  return {
    competence: row.competence,
    emolumentsCents: row.emolumentsCents,
    rateBasisPoints: row.rateBasisPoints,
    damNumber: row.damNumber,
    dueDate: row.dueDate,
    paidOn: row.paidOn,
    notes: row.notes,
    issCents: row.issFromReport ? row.issCents : null,
  };
}

/* -------------------------------------------------------------------- PDF */

/**
 * The declaration and, behind it, the month's book and the system's
 * reports: one PDF, to print or to sign digitally as a whole.
 */
export async function renderIssDeclarationPdf(
  tenant: Tenant,
  row: StoredIssDeclaration,
  settings: IssSettings,
): Promise<Buffer> {
  const attached = attachmentsOf(row);
  const declaration = await renderDocument(
    buildIssDocument(tenant, {
      declaration: inputOf(row),
      settings,
      year: row.year,
      sequence: row.sequence,
      issuedOn: toIsoDate(row.createdAt, OFFICE_TIME_ZONE),
      attachments: attached.length,
    }),
    await brandFor(tenant),
  );
  if (attached.length === 0) return declaration;
  const merged = await PDFDocument.load(declaration);
  for (const paper of attached) {
    try {
      const extra = await PDFDocument.load(await readStoredFile(paper.path), {
        ignoreEncryption: true,
      });
      const pages = await merged.copyPages(extra, extra.getPageIndices());
      for (const page of pages) merged.addPage(page);
    } catch {
      // A broken or protected paper never blocks the declaration.
    }
  }
  return Buffer.from(await merged.save());
}

/** The receipt the SEMUT stamps, for an office that delivers on paper. */
export async function renderIssReceiptPdf(
  tenant: Tenant,
  row: StoredIssDeclaration,
  settings: IssSettings,
): Promise<Buffer> {
  return renderDocument(
    buildFilingReceipt(tenant, {
      declaration: inputOf(row),
      settings,
      year: row.year,
      sequence: row.sequence,
      attachments: attachmentsOf(row).length,
    }),
    await brandFor(tenant),
  );
}

/* --------------------------------------------------------- monthly bulletin */

/**
 * What a declaration hands the month's bulletin: the ISS always; read from
 * the system's productivity report, also the acts, the funds, the intake and
 * the costs, so the bulletin opens all filled in (decision of 11/11/2026).
 */
export const PendingBulletinSchema = z.object({
  issCents: z.number().int().min(0),
  actsCount: z.number().int().min(0).optional(),
  fundAmountsCents: z.record(z.string(), z.number().int().min(0)).optional(),
  grossRevenueCents: z.number().int().min(0).optional(),
  expensesCents: z.number().int().min(0).optional(),
});
export type PendingBulletin = z.infer<typeof PendingBulletinSchema>;

/**
 * A bulletin already published for the month takes the new ISS at once
 * (only the ISS: what was published stays as the office checked it); a
 * month not published yet keeps everything waiting, and the bulletin form
 * opens with it filled in, to check and publish.
 */
export async function applyIssToBulletinWith(
  database: Database,
  tenantSlug: string,
  competence: string,
  figures: PendingBulletin,
  actorId: string,
): Promise<"updated" | "pending"> {
  const referenceMonth = `${competence}-01`;
  const [row] = await database
    .update(transparencyBulletins)
    .set({ issCents: figures.issCents, updatedAt: new Date() })
    .where(
      and(
        eq(transparencyBulletins.tenantSlug, tenantSlug),
        eq(transparencyBulletins.referenceMonth, referenceMonth),
        // A bulletin in the old format has one taxes total and no ISS line.
        isNull(transparencyBulletins.taxesPaidCents),
        // An excluded month is not published: it waits, like a new one.
        isNull(transparencyBulletins.removedAt),
      ),
    )
    .returning({ id: transparencyBulletins.id });
  if (row) {
    await recordAuditWith(database, {
      tenantSlug,
      actorId,
      action: "transparency.bulletin.iss",
      targetType: "transparency-bulletin",
      targetId: referenceMonth,
    });
    return "updated";
  }
  const pending = await pendingBulletinsWith(database, tenantSlug);
  await writeContent(
    database,
    tenantSlug,
    OFFICE_ISS_BULLETIN_KEY,
    {
      ...pending,
      // A correction that brings only the ISS keeps what the report gave.
      [competence]: PendingBulletinSchema.parse({
        ...pending[competence],
        ...figures,
      }),
    },
    actorId,
  );
  return "pending";
}

/**
 * What declarations left for months whose bulletin is not published yet.
 * The first ones kept only the ISS, as a number.
 */
export async function pendingBulletinsWith(
  database: Database,
  tenantSlug: string,
): Promise<Record<string, PendingBulletin>> {
  const raw = await readContent(database, tenantSlug, OFFICE_ISS_BULLETIN_KEY);
  const out: Record<string, PendingBulletin> = {};
  if (raw && typeof raw === "object") {
    for (const [month, value] of Object.entries(raw)) {
      if (!/^20\d\d-\d\d$/.test(month)) continue;
      const parsed = PendingBulletinSchema.safeParse(
        Number.isInteger(value) ? { issCents: value } : value,
      );
      if (parsed.success) out[month] = parsed.data;
    }
  }
  return out;
}

/**
 * Publishes the month's bulletin straight from the declaration, when the
 * holder chose it (decision of 11/11/2026): only with every figure the
 * bulletin needs; otherwise it stays waiting, filled in, as before.
 */
export async function publishBulletinFromIssWith(
  database: Database,
  tenant: Tenant,
  competence: string,
  figures: PendingBulletin,
  actorId: string,
): Promise<"published" | "pending"> {
  const funds = FUNDS_BY_STATE[tenant.location.state] ?? [];
  const privateFigures = tenant.publishBulletinPrivateFigures;
  const complete =
    figures.actsCount !== undefined &&
    funds.every((f) => figures.fundAmountsCents?.[f.key] !== undefined) &&
    (!privateFigures ||
      (figures.grossRevenueCents !== undefined &&
        figures.expensesCents !== undefined));
  if (!complete) {
    await applyIssToBulletinWith(
      database,
      tenant.slug,
      competence,
      figures,
      actorId,
    );
    return "pending";
  }
  await upsertBulletinWith(
    database,
    tenant.slug,
    {
      referenceMonth: `${competence}-01`,
      figures: {
        actsCount: figures.actsCount ?? 0,
        fundAmountsCents: Object.fromEntries(
          funds.map((f) => [f.key, figures.fundAmountsCents?.[f.key] ?? 0]),
        ),
        issCents: figures.issCents,
        grossRevenueCents: privateFigures
          ? (figures.grossRevenueCents ?? null)
          : null,
        expensesCents: privateFigures ? (figures.expensesCents ?? null) : null,
      },
      status: "consolidated",
    },
    actorId,
  );
  return "published";
}
