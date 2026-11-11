import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import {
  buildIssDocument,
  defaultIssSettings,
  type IssDeclarationInput,
  type IssSettings,
  IssSettingsSchema,
  issOn,
} from "@/core/iss/declaration.ts";
import { toIsoDate } from "@/core/scheduling/calendar.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { OFFICE_TIME_ZONE, officeYear } from "@/core/time/office-time.ts";
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
    if (parsed.success) return parsed.data;
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
  attachment: IssAttachment | null,
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
          attachmentPath: attachment?.path ?? null,
          attachmentName: attachment?.name ?? null,
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
    issCents: issOn(input.emolumentsCents, input.rateBasisPoints),
    damNumber: input.damNumber,
    dueDate: input.dueDate,
    paidOn: input.paidOn,
    notes: input.notes,
  };
}

/** Corrects a declaration; a new attachment replaces the old one. */
export async function updateIssDeclarationWith(
  database: Database,
  tenantSlug: string,
  id: string,
  input: IssDeclarationInput,
  attachment: IssAttachment | null,
  actorId: string,
  now = new Date(),
): Promise<StoredIssDeclaration> {
  const [row] = await database
    .update(issDeclarations)
    .set({
      ...fields(input),
      ...(attachment
        ? { attachmentPath: attachment.path, attachmentName: attachment.name }
        : {}),
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
  };
}

/* -------------------------------------------------------------------- PDF */

/**
 * The declaration and, behind it, the month's book or cash report: one
 * PDF, to print or to sign digitally as a whole.
 */
export async function renderIssDeclarationPdf(
  tenant: Tenant,
  row: StoredIssDeclaration,
  settings: IssSettings,
): Promise<Buffer> {
  const declaration = await renderDocument(
    buildIssDocument(tenant, {
      declaration: inputOf(row),
      settings,
      year: row.year,
      sequence: row.sequence,
      issuedOn: toIsoDate(row.createdAt, OFFICE_TIME_ZONE),
      withAttachment: Boolean(row.attachmentPath),
    }),
    await brandFor(tenant),
  );
  if (!row.attachmentPath) return declaration;
  try {
    const merged = await PDFDocument.load(declaration);
    const extra = await PDFDocument.load(
      await readStoredFile(row.attachmentPath),
      {
        ignoreEncryption: true,
      },
    );
    const pages = await merged.copyPages(extra, extra.getPageIndices());
    for (const page of pages) merged.addPage(page);
    return Buffer.from(await merged.save());
  } catch {
    // A broken or protected attachment never blocks the declaration.
    return declaration;
  }
}

/* --------------------------------------------------------- monthly bulletin */

/**
 * The month's ISS goes to the transparency bulletin (decision of
 * 11/11/2026). A bulletin already published for the month takes the new
 * ISS at once; a month not published yet keeps it waiting, and the
 * bulletin form opens with it filled in.
 */
export async function applyIssToBulletinWith(
  database: Database,
  tenantSlug: string,
  competence: string,
  issCents: number,
  actorId: string,
): Promise<"updated" | "pending"> {
  const referenceMonth = `${competence}-01`;
  const [row] = await database
    .update(transparencyBulletins)
    .set({ issCents, updatedAt: new Date() })
    .where(
      and(
        eq(transparencyBulletins.tenantSlug, tenantSlug),
        eq(transparencyBulletins.referenceMonth, referenceMonth),
        // A bulletin in the old format has one taxes total and no ISS line.
        isNull(transparencyBulletins.taxesPaidCents),
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
  const pending = await pendingBulletinIssWith(database, tenantSlug);
  await writeContent(
    database,
    tenantSlug,
    OFFICE_ISS_BULLETIN_KEY,
    { ...pending, [competence]: issCents },
    actorId,
  );
  return "pending";
}

/** ISS declared for months whose bulletin is not published yet. */
export async function pendingBulletinIssWith(
  database: Database,
  tenantSlug: string,
): Promise<Record<string, number>> {
  const raw = await readContent(database, tenantSlug, OFFICE_ISS_BULLETIN_KEY);
  const out: Record<string, number> = {};
  if (raw && typeof raw === "object") {
    for (const [month, cents] of Object.entries(raw)) {
      if (/^20\d\d-\d\d$/.test(month) && Number.isInteger(cents)) {
        out[month] = cents as number;
      }
    }
  }
  return out;
}
