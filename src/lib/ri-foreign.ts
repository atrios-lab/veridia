import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { RequerimentoDocument } from "@/core/request/requerimento.ts";
import {
  type AcquirerKind,
  FOREIGN_COLUMNS,
  type ForeignEntry,
  type ForeignInput,
  type ForeignKind,
  foreignRow,
  quarterSpan,
  recipientsFor,
} from "@/core/ri/foreign.ts";
import { officialName } from "@/core/tenant/identification.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import type { Database } from "@/db/index.ts";
import { riForeignEntries, riForeignReports } from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";
import type { Actor } from "./ri.ts";
import { RiError } from "./ri.ts";

/**
 * The Livro de Cadastro de Aquisição de Imóvel Rural por Estrangeiro and its
 * relação trimestral (src/core/ri/foreign.ts has the rules and sources).
 * Nothing is removed: a change keeps the previous values in `history`, a
 * deletion only marks the row.
 */

export type ForeignRow = typeof riForeignEntries.$inferSelect;
export type ForeignReportRow = typeof riForeignReports.$inferSelect;

interface HistoryEntry {
  at: string;
  by: string;
  what: string;
  before?: Record<string, unknown>;
}

const historyOf = (row: { history: unknown }) =>
  (row.history as HistoryEntry[] | null) ?? [];

export function entryOf(row: ForeignRow): ForeignEntry {
  return {
    number: row.number,
    kind: row.kind as ForeignKind,
    registeredOn: row.registeredOn,
    matricula: row.matricula,
    actRef: row.actRef,
    acquirerKind: row.acquirerKind as AcquirerKind,
    acquirerName: row.acquirerName,
    nationality: row.nationality,
    acquirerDocument: row.acquirerDocument,
    spouseName: row.spouseName,
    spouseCpf: row.spouseCpf,
    transmitterName: row.transmitterName,
    transmitterDocument: row.transmitterDocument,
    area: row.area,
    municipality: row.municipality,
    description: row.description,
    ccir: row.ccir,
    securityArea: row.securityArea,
    authorityBody: row.authorityBody,
    authorizationNumber: row.authorizationNumber,
    authorizationDate: row.authorizationDate ?? "",
    notes: row.notes,
    averbacoes: (
      (row.averbacoes as { text: string; at: string }[] | null) ?? []
    ).map(
      (a, i) =>
        `Av-${i + 1} (${a.at.slice(0, 10).split("-").reverse().join("/")}): ${a.text}`,
    ),
  };
}

const valuesOf = (input: ForeignInput) => ({
  ...input,
  authorizationDate: input.authorizationDate || null,
});

export async function listForeignWith(
  database: Database,
  tenantSlug: string,
  options: { deleted?: boolean } = {},
): Promise<ForeignRow[]> {
  const rows = await database
    .select()
    .from(riForeignEntries)
    .where(eq(riForeignEntries.tenantSlug, tenantSlug))
    .orderBy(asc(riForeignEntries.number));
  return rows.filter((r) => Boolean(r.deletedAt) === Boolean(options.deleted));
}

async function rowWith(database: Database, tenantSlug: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id))
    throw new RiError("Assento não encontrado.");
  const [row] = await database
    .select()
    .from(riForeignEntries)
    .where(
      and(
        eq(riForeignEntries.tenantSlug, tenantSlug),
        eq(riForeignEntries.id, id),
      ),
    );
  if (!row) throw new RiError("Assento não encontrado.");
  return row;
}

/** Lança the next assento, numbered after the last (deleted ones count). */
export async function createForeignWith(
  database: Database,
  tenantSlug: string,
  input: ForeignInput,
  actor: Actor,
): Promise<string> {
  const all = await database
    .select({ number: riForeignEntries.number })
    .from(riForeignEntries)
    .where(eq(riForeignEntries.tenantSlug, tenantSlug));
  const number = all.reduce((max, r) => Math.max(max, r.number), 0) + 1;
  const [row] = await database
    .insert(riForeignEntries)
    .values({ tenantSlug, number, ...valuesOf(input), createdBy: actor.id })
    .returning({ id: riForeignEntries.id });
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "ri.foreign-create",
    targetType: "ri-foreign",
    targetId: row?.id,
  });
  return row?.id ?? "";
}

/** Changes an assento; the values before go to the history. */
export async function updateForeignWith(
  database: Database,
  tenantSlug: string,
  id: string,
  input: ForeignInput,
  reason: string,
  actor: Actor,
): Promise<void> {
  const row = await rowWith(database, tenantSlug, id);
  const before: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(valuesOf(input))) {
    const old = (row as Record<string, unknown>)[key];
    if (String(old ?? "") !== String(value ?? "")) before[key] = old;
  }
  if (Object.keys(before).length === 0) return;
  await database
    .update(riForeignEntries)
    .set({
      ...valuesOf(input),
      history: [
        ...historyOf(row),
        { at: new Date().toISOString(), by: actor.id, what: reason, before },
      ],
    })
    .where(eq(riForeignEntries.id, row.id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "ri.foreign-update",
    targetType: "ri-foreign",
    targetId: row.id,
    reason,
  });
}

/** An averbação on the assento (a later fact: cancelamento, retificação). */
export async function addForeignAverbacaoWith(
  database: Database,
  tenantSlug: string,
  id: string,
  text: string,
  actor: Actor,
): Promise<void> {
  const clean = text.trim().slice(0, 5000);
  if (clean.length < 3) throw new RiError("Escreva o texto da averbação.");
  const row = await rowWith(database, tenantSlug, id);
  const list = (row.averbacoes as unknown[] | null) ?? [];
  await database
    .update(riForeignEntries)
    .set({
      averbacoes: [
        ...list,
        { at: new Date().toISOString(), by: actor.id, text: clean },
      ],
    })
    .where(eq(riForeignEntries.id, row.id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "ri.foreign-averbacao",
    targetType: "ri-foreign",
    targetId: row.id,
    reason: clean,
  });
}

/** Marks (or unmarks) an assento as deleted; the row stays. */
export async function setForeignDeletedWith(
  database: Database,
  tenantSlug: string,
  id: string,
  deleted: boolean,
  reason: string,
  actor: Actor,
): Promise<void> {
  const row = await rowWith(database, tenantSlug, id);
  await database
    .update(riForeignEntries)
    .set({
      deletedAt: deleted ? new Date() : null,
      deletedBy: deleted ? actor.id : null,
      history: [
        ...historyOf(row),
        {
          at: new Date().toISOString(),
          by: actor.id,
          what: `${deleted ? "Apagado" : "Restaurado"}: ${reason}`,
        },
      ],
    })
    .where(eq(riForeignEntries.id, row.id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: deleted ? "ri.foreign-delete" : "ri.foreign-restore",
    targetType: "ri-foreign",
    targetId: row.id,
    reason,
  });
}

// ── relação trimestral ──────────────────────────────────────────────────

export async function listForeignReportsWith(
  database: Database,
  tenantSlug: string,
): Promise<ForeignReportRow[]> {
  return database
    .select()
    .from(riForeignReports)
    .where(
      and(
        eq(riForeignReports.tenantSlug, tenantSlug),
        isNull(riForeignReports.deletedAt),
      ),
    )
    .orderBy(asc(riForeignReports.year), asc(riForeignReports.quarter));
}

/** The assentos registered in one trimestre. */
export function entriesOfQuarter(
  rows: ForeignRow[],
  year: number,
  quarter: number,
): ForeignRow[] {
  const { from, to } = quarterSpan(year, quarter);
  return rows.filter(
    (r) => !r.deletedAt && r.registeredOn >= from && r.registeredOn <= to,
  );
}

/** Records that the relação of a trimestre was sent, to whom and when. */
export async function recordForeignReportWith(
  database: Database,
  tenantSlug: string,
  input: {
    year: number;
    quarter: number;
    kind: "positiva" | "negativa";
    recipients: string[];
    sentOn: string;
    notes: string;
  },
  actor: Actor,
): Promise<void> {
  if (input.quarter < 1 || input.quarter > 4 || input.year < 1971) {
    throw new RiError("Escolha o trimestre.");
  }
  const [row] = await database
    .insert(riForeignReports)
    .values({ tenantSlug, ...input, createdBy: actor.id })
    .returning({ id: riForeignReports.id });
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "ri.foreign-report",
    targetType: "ri-foreign-report",
    targetId: row?.id,
  });
}

export async function setForeignReportDeletedWith(
  database: Database,
  tenantSlug: string,
  id: string,
  reason: string,
  actor: Actor,
): Promise<void> {
  const [row] = await database
    .select()
    .from(riForeignReports)
    .where(
      and(
        eq(riForeignReports.tenantSlug, tenantSlug),
        eq(riForeignReports.id, id),
      ),
    );
  if (!row) throw new RiError("Envio não encontrado.");
  await database
    .update(riForeignReports)
    .set({
      deletedAt: new Date(),
      deletedBy: actor.id,
      history: [
        ...historyOf(row),
        { at: new Date().toISOString(), by: actor.id, what: reason },
      ],
    })
    .where(eq(riForeignReports.id, row.id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "ri.foreign-report-delete",
    targetType: "ri-foreign-report",
    targetId: row.id,
    reason,
  });
}

// ── documentos ──────────────────────────────────────────────────────────

const tableOf = (rows: ForeignRow[]) => ({
  columns: FOREIGN_COLUMNS.map((label, i) => ({
    label,
    weight: [0.4, 2, 2.4, 1.6, 1.4][i],
  })),
  rows: rows.map((r) => foreignRow(entryOf(r))),
  empty: "Nenhum assento.",
});

/** The book: every assento in the 5 columns of the model. */
export function foreignBookDocument(
  tenant: Tenant,
  rows: ForeignRow[],
  signer: { signee?: string; signature: string[] },
): RequerimentoDocument {
  return {
    eyebrow: "Registro de Imóveis · Livro auxiliar",
    title: "Cadastro de Aquisição de Imóvel Rural por Estrangeiro",
    subtitle:
      "Lei nº 5.709/1971, art. 10; Decreto nº 74.965/1974, art. 15; Prov. nº 156/2016 CGJ/RN, arts. 68, § 1º, e 274",
    office: [officialName(tenant), tenant.subtitle],
    sections: [{ heading: "Assentos", table: tableOf(rows) }],
    ...signer,
    footer: `${officialName(tenant)} · Cadastro de aquisição por estrangeiro`,
  };
}

/**
 * The relação of a trimestre, one per destinatário (Prov. 156/RN, art. 275;
 * Lei nº 5.709/1971, art. 11), or the certidão negativa when there was none.
 */
export function foreignQuarterDocument(
  tenant: Tenant,
  rows: ForeignRow[],
  year: number,
  quarter: number,
  recipient: string,
  dateLine: string,
  signer: { signee?: string; signature: string[] },
): RequerimentoDocument {
  const span = quarterSpan(year, quarter);
  const br = (iso: string) => iso.split("-").reverse().join("/");
  const negative = rows.length === 0;
  return {
    eyebrow: "Registro de Imóveis · Comunicação trimestral",
    title: negative
      ? "Certidão negativa de aquisição de imóvel rural por estrangeiro"
      : "Relação de aquisições de imóveis rurais por estrangeiros",
    subtitle: `${span.label} (${br(span.from)} a ${br(span.to)})`,
    office: [officialName(tenant), tenant.subtitle],
    sections: [
      { heading: "Destinatário", paragraphs: [recipient] },
      negative
        ? {
            heading: "Certidão",
            paragraphs: [
              `Certifico que, no ${span.label}, não houve registro de aquisição nem de arrendamento de imóvel rural por pessoa estrangeira, física ou jurídica, nem por pessoa jurídica brasileira a ela equiparada, nesta serventia.`,
            ],
          }
        : {
            heading: `Aquisições e arrendamentos registrados (${rows.length})`,
            paragraphs: [
              "Em cumprimento ao art. 11 da Lei nº 5.709/1971 e ao art. 275 do Código de Normas da CGJ/RN (Prov. nº 156/2016), segue a relação dos assentos lançados no Livro de Cadastro de Aquisição de Imóvel Rural por Estrangeiro no período.",
            ],
            table: tableOf(rows),
          },
    ],
    dateLine,
    ...signer,
    footer: `${officialName(tenant)} · ${span.label}`,
  };
}

export { recipientsFor };

/**
 * Imports the assentos read from the model spreadsheet. An assento with a
 * number already in the book stays out; without a number, it takes the
 * next one. Returns how many came in and how many were left out.
 */
export async function importForeignWith(
  database: Database,
  tenantSlug: string,
  items: (ForeignInput & { number: number | null })[],
  actor: Actor,
): Promise<{ created: number; skipped: number }> {
  const taken = new Set(
    (
      await database
        .select({ number: riForeignEntries.number })
        .from(riForeignEntries)
        .where(eq(riForeignEntries.tenantSlug, tenantSlug))
    ).map((r) => r.number),
  );
  let next = Math.max(0, ...taken) + 1;
  let created = 0;
  let skipped = 0;
  for (const { number, ...input } of items) {
    if (number !== null && taken.has(number)) {
      skipped++;
      continue;
    }
    const n = number ?? next;
    taken.add(n);
    next = Math.max(next, n + 1);
    await database.insert(riForeignEntries).values({
      tenantSlug,
      number: n,
      ...valuesOf(input),
      createdBy: actor.id,
    });
    created++;
  }
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "ri.foreign-import",
    targetType: "ri-foreign",
    reason: `${created} assentos importados, ${skipped} já existiam`,
  });
  return { created, skipped };
}
