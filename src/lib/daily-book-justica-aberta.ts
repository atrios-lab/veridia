import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  buildJusticaAbertaDocument,
  cnjSpecialtyOf,
  type FcrcpnRecord,
  type FcrcpnRepasse,
  fcrcpnEntryDescription,
  type JusticaAbertaFigures,
  justicaAbertaFigures,
  repassesIn,
  type Semester,
  type SemesterId,
} from "@/core/daily-book/justica-aberta.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import type { Database } from "@/db/index.ts";
import { tenantContent } from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";
import {
  addEntryWith,
  DailyBookError,
  type EntryInput,
  entryOf,
  getBookSettingsWith,
  listEntriesWith,
  removeEntryWith,
  updateEntryWith,
} from "./daily-book.ts";
import { brandFor } from "./document-brand.ts";
import { OFFICE_FCRCPN_KEY } from "./office-config.ts";
import { renderDocument } from "./pdf.ts";

/**
 * The Justiça Aberta panel's data (decision of 12/11/2026): the semester's
 * figures from the book, and the FCRCPN repasses the office types in.
 * Repasses removed stay, marked with the reason; nothing is deleted.
 */

const EMPTY: FcrcpnRecord = { repasses: [], noneIn: [] };

export async function getFcrcpnRecordWith(
  database: Database,
  tenantSlug: string,
): Promise<FcrcpnRecord> {
  try {
    const [row] = await database
      .select({ published: tenantContent.published })
      .from(tenantContent)
      .where(
        and(
          eq(tenantContent.tenantSlug, tenantSlug),
          eq(tenantContent.key, OFFICE_FCRCPN_KEY),
        ),
      )
      .limit(1);
    const value = row?.published as Partial<FcrcpnRecord> | undefined;
    return {
      repasses: Array.isArray(value?.repasses) ? value.repasses : [],
      noneIn: Array.isArray(value?.noneIn) ? value.noneIn : [],
    };
  } catch {
    return EMPTY;
  }
}

async function write(
  database: Database,
  tenantSlug: string,
  record: FcrcpnRecord,
  actorId: string,
): Promise<void> {
  const now = new Date();
  await database
    .insert(tenantContent)
    .values({
      tenantSlug,
      key: OFFICE_FCRCPN_KEY,
      published: record,
      publishedAt: now,
      updatedBy: actorId,
    })
    .onConflictDoUpdate({
      target: [tenantContent.tenantSlug, tenantContent.key],
      set: {
        published: record,
        publishedAt: now,
        updatedAt: now,
        updatedBy: actorId,
      },
    });
}

export type FcrcpnInput = Pick<
  FcrcpnRepasse,
  | "receivedOn"
  | "competence"
  | "payer"
  | "receivedCents"
  | "withheldCents"
  | "notes"
>;

function check(input: FcrcpnInput): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.receivedOn)) {
    throw new DailyBookError("Informe o dia em que o repasse foi recebido.");
  }
  if (input.competence && !/^\d{4}-(0[1-9]|1[0-2])$/.test(input.competence)) {
    throw new DailyBookError("Confira o mês de competência.");
  }
  if (!Number.isInteger(input.receivedCents) || input.receivedCents <= 0) {
    throw new DailyBookError("Informe o valor recebido.");
  }
  if (!Number.isInteger(input.withheldCents) || input.withheldCents < 0) {
    throw new DailyBookError("Confira o imposto retido.");
  }
  if (!input.payer.trim()) {
    throw new DailyBookError("Informe quem pagou o repasse.");
  }
}

export async function saveFcrcpnRepasseWith(
  database: Database,
  tenantSlug: string,
  input: FcrcpnInput,
  actorId: string,
  id?: string,
): Promise<FcrcpnRepasse> {
  check(input);
  const record = await getFcrcpnRecordWith(database, tenantSlug);
  const now = new Date().toISOString();
  const clean = {
    ...input,
    payer: input.payer.trim(),
    notes: input.notes.trim(),
  };
  // The book's line first (decision of 12/11/2026): the net amount as
  // revenue of the Registro Civil, so the book shows the repasse as the
  // law asks; then the repasse that points at it.
  const line = await bookLine(database, tenantSlug, clean);
  let saved: FcrcpnRepasse;
  if (id) {
    const old = record.repasses.find((r) => r.id === id && !r.removedAt);
    if (!old) throw new DailyBookError("Repasse não encontrado.");
    let entryId = old.entryId;
    if (entryId) {
      await updateEntryWith(database, tenantSlug, entryId, line, actorId);
    } else {
      entryId = (await addEntryWith(database, tenantSlug, line, actorId)).id;
    }
    saved = { ...old, ...clean, entryId, updatedAt: now };
    record.repasses = record.repasses.map((r) => (r.id === id ? saved : r));
  } else {
    const entry = await addEntryWith(database, tenantSlug, line, actorId);
    saved = {
      ...clean,
      id: randomUUID(),
      entryId: entry.id,
      createdAt: now,
      createdBy: actorId,
    };
    record.repasses = [...record.repasses, saved];
  }
  await write(database, tenantSlug, record, actorId);
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: id ? "daily-book.fcrcpn-edit" : "daily-book.fcrcpn-save",
    targetType: "daily-book",
    targetId: saved.id,
  });
  return saved;
}

/** The repasse as a line of the Livro Diário: revenue, net, no act. */
async function bookLine(
  database: Database,
  tenantSlug: string,
  r: FcrcpnInput,
): Promise<EntryInput> {
  const settings = await getBookSettingsWith(database, tenantSlug);
  const specialty =
    settings.specialties.find((s) => cnjSpecialtyOf(s.name) === "rcpn")?.name ??
    "Registro Civil das Pessoas Naturais";
  return {
    kind: "receita",
    occurredOn: r.receivedOn,
    specialty,
    category: "",
    actCode: "",
    description: fcrcpnEntryDescription(r),
    quantity: 0,
    amountCents: r.receivedCents,
    fundsCents: 0,
    issCents: 0,
    supplier: "",
    documentRef: "Repasse do FCRCPN",
    fiscalDistinct: false,
    fiscalNote: "",
    explanation: r.notes,
    source: "fcrcpn",
  };
}

/** Marked removed, with the reason; it stays stored. */
export async function removeFcrcpnRepasseWith(
  database: Database,
  tenantSlug: string,
  id: string,
  reason: string,
  actorId: string,
): Promise<void> {
  const record = await getFcrcpnRecordWith(database, tenantSlug);
  if (!record.repasses.some((r) => r.id === id && !r.removedAt)) {
    throw new DailyBookError("Repasse não encontrado.");
  }
  const old = record.repasses.find((r) => r.id === id);
  // Its line leaves the book with the same reason; it stays stored too.
  if (old?.entryId) {
    await removeEntryWith(database, tenantSlug, old.entryId, reason, actorId);
  }
  const now = new Date().toISOString();
  record.repasses = record.repasses.map((r) =>
    r.id === id
      ? { ...r, removedAt: now, removedBy: actorId, removeReason: reason }
      : r,
  );
  await write(database, tenantSlug, record, actorId);
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "daily-book.fcrcpn-remove",
    targetType: "daily-book",
    targetId: id,
    reason,
  });
}

/** "Não houve repasse do FCRCPN neste semestre", or that undone. */
export async function setFcrcpnNoneWith(
  database: Database,
  tenantSlug: string,
  semester: SemesterId,
  none: boolean,
  actorId: string,
): Promise<void> {
  const record = await getFcrcpnRecordWith(database, tenantSlug);
  const rest = record.noneIn.filter((s) => s !== semester);
  record.noneIn = none ? [...rest, semester] : rest;
  await write(database, tenantSlug, record, actorId);
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "daily-book.fcrcpn-none",
    targetType: "daily-book",
    targetId: semester,
  });
}

export async function justicaAbertaWith(
  database: Database,
  tenantSlug: string,
  semester: Semester,
): Promise<{
  figures: JusticaAbertaFigures;
  record: FcrcpnRecord;
  interim: boolean;
}> {
  const [rows, record, settings] = await Promise.all([
    listEntriesWith(database, tenantSlug, {
      start: semester.start,
      end: semester.end,
    }),
    getFcrcpnRecordWith(database, tenantSlug),
    getBookSettingsWith(database, tenantSlug),
  ]);
  return {
    figures: justicaAbertaFigures(
      rows.map(entryOf),
      semester,
      repassesIn(record, semester),
    ),
    record,
    interim: settings.interim,
  };
}

export async function renderJusticaAbertaPdf(
  database: Database,
  tenant: Tenant,
  semester: Semester,
  issuedOn: string,
  signer: { name: string; title: string } | null,
): Promise<Buffer> {
  const { figures, interim } = await justicaAbertaWith(
    database,
    tenant.slug,
    semester,
  );
  return renderDocument(
    buildJusticaAbertaDocument(
      tenant,
      semester,
      figures,
      issuedOn,
      signer,
      interim,
    ),
    await brandFor(tenant),
  );
}
