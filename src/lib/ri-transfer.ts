import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import {
  actTable,
  fillEmpty,
  JSON_FORMAT,
  objectsOf,
  ownersOf,
  peopleTable,
  personalTable,
  propertyKey,
  propertyTable,
  type Table,
  TRANSFER_LABELS,
  type Transfer,
  type TransferKind,
} from "@/core/ri/transfer.ts";
import { OFFICE_TIME_ZONE } from "@/core/time/office-time.ts";
import type { Database } from "@/db/index.ts";
import { riActParties, riActs, riPeople, riProperties } from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";
import {
  type Actor,
  createPropertyWith,
  findOrCreatePersonWith,
  loadAcervoWith,
  RiError,
  toProperty,
  updatePropertyWith,
} from "./ri.ts";
import { csvOf, xlsxOf } from "./ri-sheet.ts";

/**
 * The acervo of the Registro de Imóveis in and out (change
 * registro-de-imoveis-importar-exportar). Export: every table in .xlsx,
 * .csv and .json, and the whole acervo in one JSON. Import: after the
 * conferência, only what is missing comes in. A matrícula already in the
 * system keeps every value it has (at most its empty fields are filled,
 * when the office asks); an ato whose number is already on the matrícula
 * stays out; a person with the same CPF/CNPJ is the same person.
 */

export type TransferFormat = "xlsx" | "csv" | "json";

export const TRANSFER_FORMATS: Record<TransferFormat, string> = {
  xlsx: "Excel (.xlsx)",
  csv: "CSV (.csv)",
  json: "JSON (.json)",
};

const FILE_NAMES: Record<TransferKind | "acervo", string> = {
  matriculas: "matriculas",
  atos: "atos",
  pessoas: "pessoas",
  "indicador-real": "indicador-real",
  "indicador-pessoal": "indicador-pessoal",
  acervo: "acervo-registro-de-imoveis",
};

/** The tables of the acervo in force (apagadas stay out). */
export async function transferTablesWith(
  database: Database,
  tenantSlug: string,
  book: 2 | 3 | null = null,
): Promise<Record<TransferKind, Table>> {
  const acervo = await loadAcervoWith(database, tenantSlug);
  const properties = acervo.properties.filter(
    (p) => !p.deletedAt && (book === null || p.book === book),
  );
  const items = properties.map((property) => ({
    property,
    acts: acervo.acts.get(property.id) ?? [],
  }));
  const withOwners = items.map(({ property, acts }) => ({
    ...property,
    owners: ownersOf(acts),
  }));
  return {
    matriculas: propertyTable(withOwners),
    atos: actTable(items),
    pessoas: peopleTable(items),
    "indicador-real": propertyTable(
      withOwners.filter((p) => p.book === 2 && p.status !== 4),
      { real: true },
    ),
    "indicador-pessoal": personalTable(items),
  };
}

export interface ExportFile {
  bytes: Uint8Array;
  name: string;
  type: string;
  rows: number;
}

/** aaaa-mm-dd of today in the office's zone, for the file name. */
function stamp(): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: OFFICE_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** One table, or the whole acervo ("acervo", JSON only), as a file. */
export async function transferExportWith(
  database: Database,
  tenantSlug: string,
  kind: TransferKind | "acervo",
  format: TransferFormat,
  actor: Actor,
  book: 2 | 3 | null = null,
): Promise<ExportFile> {
  const tables = await transferTablesWith(database, tenantSlug, book);
  const base = `${FILE_NAMES[kind]}${book ? `-livro-${book}` : ""}-${stamp()}`;
  let file: ExportFile;
  if (kind === "acervo") {
    const json = {
      formato: JSON_FORMAT,
      tipo: "acervo",
      versao: 1,
      geradoEm: new Date().toISOString(),
      matriculas: objectsOf(tables.matriculas),
      atos: objectsOf(tables.atos),
      pessoas: objectsOf(tables.pessoas),
    };
    file = {
      bytes: new TextEncoder().encode(JSON.stringify(json, null, 1)),
      name: `${base}.json`,
      type: "application/json; charset=utf-8",
      rows: json.matriculas.length,
    };
  } else {
    const table = tables[kind];
    const rows = Math.max(0, table.length - 1);
    if (format === "xlsx") {
      file = {
        bytes: await xlsxOf(table, TRANSFER_LABELS[kind].split(" (")[0]),
        name: `${base}.xlsx`,
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        rows,
      };
    } else if (format === "csv") {
      file = {
        bytes: csvOf(table),
        name: `${base}.csv`,
        type: "text/csv; charset=utf-8",
        rows,
      };
    } else {
      const json = {
        formato: JSON_FORMAT,
        tipo: kind,
        versao: 1,
        geradoEm: new Date().toISOString(),
        linhas: objectsOf(table),
      };
      file = {
        bytes: new TextEncoder().encode(JSON.stringify(json, null, 1)),
        name: `${base}.json`,
        type: "application/json; charset=utf-8",
        rows,
      };
    }
  }
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "ri.transfer-export",
    targetType: "ri-property",
    targetId: null,
  });
  return file;
}

// ----------------------------------------------------------------- import

export interface TransferPreview {
  format: string;
  properties: { new: number; existing: number; fillable: number };
  acts: { new: number; existing: number; orphan: number };
  people: { new: number; existing: number };
  /** The first lines, as the conferência shows them. */
  sample: { line: number; what: string; text: string; note: string }[];
  errors: { line: number; message: string }[];
  columns: { header: string; field: string }[];
}

async function indexWith(database: Database, tenantSlug: string) {
  const [properties, acts, people] = await Promise.all([
    database
      .select()
      .from(riProperties)
      .where(
        and(
          eq(riProperties.tenantSlug, tenantSlug),
          isNull(riProperties.deletedAt),
        ),
      ),
    database
      .select({
        id: riActs.id,
        propertyId: riActs.propertyId,
        seq: riActs.seq,
      })
      .from(riActs)
      .where(and(eq(riActs.tenantSlug, tenantSlug), isNull(riActs.deletedAt))),
    database
      .select({ document: riPeople.document, name: riPeople.name })
      .from(riPeople)
      .where(
        and(eq(riPeople.tenantSlug, tenantSlug), isNull(riPeople.deletedAt)),
      ),
  ]);
  const byKey = new Map(properties.map((p) => [propertyKey(p), p]));
  const seqs = new Map<string, Map<number, string>>();
  for (const act of acts) {
    const map = seqs.get(act.propertyId) ?? new Map<number, string>();
    map.set(act.seq, act.id);
    seqs.set(act.propertyId, map);
  }
  const documents = new Set(people.map((p) => p.document).filter(Boolean));
  return { byKey, seqs, documents };
}

const label = (p: { book: number; number: number; recordKind: number }) =>
  `${p.recordKind === 4 ? "Transcrição" : p.book === 3 ? "Livro 3" : "Matrícula"} ${p.number.toLocaleString("pt-BR")}`;

/** What the import would do, without saving anything. */
export async function previewTransferWith(
  database: Database,
  tenantSlug: string,
  transfer: Transfer,
): Promise<TransferPreview> {
  const index = await indexWith(database, tenantSlug);
  const preview: TransferPreview = {
    format: transfer.format,
    properties: { new: 0, existing: 0, fillable: 0 },
    acts: { new: 0, existing: 0, orphan: 0 },
    people: { new: 0, existing: 0 },
    sample: [],
    errors: transfer.errors.slice(0, 100),
    columns: transfer.columns,
  };
  const incoming = new Set<string>();
  for (const row of transfer.properties) {
    const key = propertyKey(row.input);
    const found = index.byKey.get(key);
    let note = row.warnings.join("; ");
    if (found) {
      preview.properties.existing++;
      const { fields } = fillEmpty(toProperty(found), row.input);
      if (fields.length > 0) {
        preview.properties.fillable++;
        note = [
          note,
          `já está no sistema; campos vazios que podem ser completados: ${fields.join(", ")}`,
        ]
          .filter(Boolean)
          .join("; ");
      } else {
        note = [note, "já está no sistema: nada muda"]
          .filter(Boolean)
          .join("; ");
      }
    } else {
      preview.properties.new++;
      incoming.add(key);
    }
    if (preview.sample.length < 200) {
      preview.sample.push({
        line: row.line,
        what: found ? "Matrícula já cadastrada" : "Matrícula nova",
        text: `${label(row.input)}${row.owners.length ? `: ${row.owners.map((o) => o.name).join("; ")}` : ""}`,
        note,
      });
    }
  }
  for (const row of transfer.acts) {
    const key = propertyKey(row);
    const found = index.byKey.get(key);
    let what: string;
    if (!found && !incoming.has(key)) {
      preview.acts.orphan++;
      what = "Ato sem matrícula no sistema (fica de fora)";
    } else if (found && index.seqs.get(found.id)?.has(row.seq)) {
      preview.acts.existing++;
      what = "Ato já lançado (fica como está)";
    } else {
      preview.acts.new++;
      what = "Ato novo";
    }
    if (preview.sample.length < 200) {
      preview.sample.push({
        line: row.line,
        what,
        text: `${label(row)}: ${row.kind === "M" ? "situação na migração" : `${row.kind}-${row.seq}`} ${row.nature}`,
        note: row.warnings.join("; "),
      });
    }
  }
  for (const row of transfer.people) {
    const existing = Boolean(row.document) && index.documents.has(row.document);
    if (existing) preview.people.existing++;
    else preview.people.new++;
    if (preview.sample.length < 200) {
      preview.sample.push({
        line: row.line,
        what: existing ? "Pessoa já cadastrada" : "Pessoa nova",
        text: `${row.name}${row.document ? ` (${row.document})` : ""}`,
        note: row.where ? `aparece em ${row.where}`.slice(0, 200) : "",
      });
    }
  }
  return preview;
}

export interface TransferResult {
  properties: number;
  completed: number;
  acts: number;
  people: number;
  skipped: { line: number; reason: string }[];
}

/**
 * Saves what the conferência showed. `complete`: also fills the empty
 * fields of matrículas already in the system (never a value they have).
 */
export async function applyTransferWith(
  database: Database,
  tenantSlug: string,
  transfer: Transfer,
  options: { complete: boolean },
  actor: Actor,
): Promise<TransferResult> {
  const result: TransferResult = {
    properties: 0,
    completed: 0,
    acts: 0,
    people: 0,
    skipped: [],
  };
  const index = await indexWith(database, tenantSlug);
  // A matrícula whose "situação na migração" comes in the atos takes its
  // owners from there (as they were), not from the matrícula's row (the
  // owners of today).
  const withMigration = new Set(
    transfer.acts.filter((a) => a.kind === "M").map((a) => propertyKey(a)),
  );
  const ids = new Map<string, string>();
  for (const [key, row] of index.byKey) ids.set(key, row.id);

  for (const row of transfer.properties) {
    const key = propertyKey(row.input);
    const found = index.byKey.get(key);
    if (found) {
      if (!options.complete) {
        result.skipped.push({
          line: row.line,
          reason: `${label(row.input)} já está no sistema`,
        });
        continue;
      }
      const { input, fields } = fillEmpty(toProperty(found), row.input);
      if (fields.length > 0) {
        await updatePropertyWith(database, tenantSlug, found.id, input, actor);
        result.completed++;
      }
      continue;
    }
    if (ids.has(key)) {
      result.skipped.push({
        line: row.line,
        reason: `${label(row.input)} aparece duas vezes no arquivo: entrou a primeira`,
      });
      continue;
    }
    const owners = withMigration.has(key) ? [] : row.owners;
    const id = await createPropertyWith(
      database,
      tenantSlug,
      row.input,
      actor,
      { source: "importacao", owners },
    );
    ids.set(key, id);
    index.seqs.set(id, new Map(owners.length ? [[0, "m"]] : []));
    result.properties++;
  }

  const acts = [...transfer.acts].sort(
    (a, b) => propertyKey(a).localeCompare(propertyKey(b)) || a.seq - b.seq,
  );
  for (const row of acts) {
    const propertyId = ids.get(propertyKey(row));
    if (!propertyId) {
      result.skipped.push({
        line: row.line,
        reason: `${label(row)} não está no sistema: importe a matrícula antes`,
      });
      continue;
    }
    const taken = index.seqs.get(propertyId) ?? new Map<number, string>();
    if (taken.has(row.seq)) {
      result.skipped.push({
        line: row.line,
        reason: `${label(row)}: o ato nº ${row.seq} já está lançado`,
      });
      continue;
    }
    const cancels =
      row.cancelsSeq !== null && row.cancelsSeq > 0
        ? (taken.get(row.cancelsSeq) ?? null)
        : null;
    const [inserted] = await database
      .insert(riActs)
      .values({
        tenantSlug,
        propertyId,
        kind: row.kind,
        seq: row.seq,
        effect:
          row.effect === "cancelamento" && !cancels ? "outro" : row.effect,
        nature:
          row.nature || (row.kind === "M" ? "Situação na migração" : "Ato"),
        registeredOn: row.registeredOn,
        summary: row.summary,
        cancelsActId: cancels,
        protocol: row.protocol,
        seal: row.seal,
        valueCents: row.valueCents,
        createdBy: actor.id,
      })
      .returning({ id: riActs.id });
    const actId = inserted?.id as string;
    taken.set(row.seq, actId);
    index.seqs.set(propertyId, taken);
    for (const party of row.parties) {
      const personId = await findOrCreatePersonWith(
        database,
        tenantSlug,
        party,
        actor,
      );
      await database.insert(riActParties).values({
        tenantSlug,
        actId,
        personId,
        role: party.role,
        share: party.share,
      });
    }
    await database
      .update(riProperties)
      .set({ updatedAt: new Date() })
      .where(eq(riProperties.id, propertyId));
    result.acts++;
  }

  for (const row of transfer.people) {
    if (row.document && index.documents.has(row.document)) continue;
    await findOrCreatePersonWith(database, tenantSlug, row, actor);
    if (row.document) index.documents.add(row.document);
    result.people++;
  }

  if (
    result.properties + result.completed + result.acts + result.people ===
    0
  ) {
    if (result.skipped.length === 0) {
      throw new RiError("Não havia nada novo para importar neste arquivo.");
    }
  }
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "ri.transfer-import",
    targetType: "ri-property",
    targetId: null,
  });
  return result;
}
