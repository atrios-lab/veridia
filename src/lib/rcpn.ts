import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { put } from "@vercel/blob";
import { and, asc, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import {
  type Conference,
  conferenceOf,
  toPublish,
} from "@/core/rcpn/conference.ts";
import { nameFit, nameTokens, normalizeName } from "@/core/rcpn/names.ts";
import {
  RCPN_KINDS,
  type RcpnKind,
  type RcpnPerson,
  type RcpnRecord,
  type RcpnRole,
  recordKey,
} from "@/core/rcpn/record.ts";
import { type Database, db } from "@/db/index.ts";
import { rcpnImports, rcpnPeople, rcpnRecords } from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";
import { readImportFile } from "./rcpn-reader.ts";
import { assertDiskFallbackAllowed, deleteStoredFile } from "./uploads.ts";

/**
 * The RCPN index (change `consulta-de-registro-rcpn`): files in, conference,
 * publication, search. Each publication writes only what the office chose:
 * new registros, and the changed ones it said to replace (decision of
 * 14/11/2026). Nothing here deletes a row: a registro replaced is updated
 * in place, a person by its role.
 */

export class RcpnImportError extends Error {}

export type ImportRow = typeof rcpnImports.$inferSelect;

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** The folder of the office's RCPN files in the store. */
export const rcpnFolder = (tenantSlug: string) => `rcpn/${tenantSlug}/`;

/** Keeps the file while the import is open (removed when it closes). */
export async function storeImportFile(
  tenantSlug: string,
  bytes: Uint8Array,
  fileName: string,
): Promise<string> {
  const safe = fileName.replace(/[^\w.-]+/g, "_").slice(-80) || "arquivo";
  const path = `${rcpnFolder(tenantSlug)}${randomUUID()}/${safe}`;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(path, Buffer.from(bytes), {
      access: "public",
      addRandomSuffix: true,
      contentType: "application/octet-stream",
    });
    return blob.url;
  }
  assertDiskFallbackAllowed();
  const full = join(resolve(process.env.UPLOAD_DIR ?? "./var/uploads"), path);
  await mkdir(join(full, ".."), { recursive: true });
  await writeFile(full, bytes);
  return full;
}

/** Reads the file and opens the import, refusing the same file twice. */
export async function createImportWith(
  database: Database,
  tenantSlug: string,
  input: {
    fileName: string;
    bytes: Uint8Array;
    storedPath: string;
    uploadedBy: string;
  },
): Promise<{ id: string }> {
  const hash = sha256(input.bytes);
  const [same] = await database
    .select({ id: rcpnImports.id, createdAt: rcpnImports.createdAt })
    .from(rcpnImports)
    .where(
      and(
        eq(rcpnImports.tenantSlug, tenantSlug),
        eq(rcpnImports.sha256, hash),
        sql`${rcpnImports.status} <> 'descartada'`,
      ),
    )
    .limit(1);
  if (same) {
    throw new RcpnImportError(
      `Este mesmo arquivo já foi enviado em ${same.createdAt.toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" })}.`,
    );
  }
  const reading = await readImportFile(input.bytes, input.fileName);
  const [row] = await database
    .insert(rcpnImports)
    .values({
      tenantSlug,
      fileName: input.fileName.slice(0, 300),
      sizeBytes: input.bytes.byteLength,
      sha256: hash,
      storedPath: input.storedPath,
      format: reading.format,
      status: reading.records.length > 0 ? "lida" : "nao-lida",
      notes: reading.notes,
      records: reading.records,
      uploadedBy: input.uploadedBy,
    })
    .returning({ id: rcpnImports.id });
  if (!row) throw new RcpnImportError("Não foi possível registrar o arquivo.");
  await recordAuditWith(database, {
    tenantSlug,
    actorId: input.uploadedBy,
    action: "rcpn.import.upload",
    targetType: "rcpn-import",
    targetId: row.id,
  });
  return row;
}

export async function listImportsWith(database: Database, tenantSlug: string) {
  return database
    .select({
      id: rcpnImports.id,
      fileName: rcpnImports.fileName,
      sizeBytes: rcpnImports.sizeBytes,
      format: rcpnImports.format,
      status: rcpnImports.status,
      publishedCount: rcpnImports.publishedCount,
      createdAt: rcpnImports.createdAt,
      closedAt: rcpnImports.closedAt,
    })
    .from(rcpnImports)
    .where(eq(rcpnImports.tenantSlug, tenantSlug))
    .orderBy(desc(rcpnImports.createdAt))
    .limit(100);
}

export async function getImportWith(
  database: Database,
  tenantSlug: string,
  id: string,
) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await database
    .select()
    .from(rcpnImports)
    .where(and(eq(rcpnImports.tenantSlug, tenantSlug), eq(rcpnImports.id, id)))
    .limit(1);
  return row ?? null;
}

const PERSON_FIELDS = (p: typeof rcpnPeople.$inferSelect): RcpnPerson => ({
  role: p.role as RcpnRole,
  name: p.name,
  marriedName: p.marriedName,
  motherName: p.motherName,
  fatherName: p.fatherName,
  birthDate: p.birthDate,
  profession: p.profession,
  fatherProfession: p.fatherProfession,
  motherProfession: p.motherProfession,
});

/** The index as it is for these registros, by `kind:recordKey`. */
export async function existingFor(
  database: Database,
  tenantSlug: string,
  records: RcpnRecord[],
): Promise<Map<string, RcpnRecord & { id: string }>> {
  const map = new Map<string, RcpnRecord & { id: string }>();
  const keys = [...new Set(records.map(recordKey))];
  for (let i = 0; i < keys.length; i += 500) {
    const chunk = keys.slice(i, i + 500);
    const rows = await database
      .select()
      .from(rcpnRecords)
      .where(
        and(
          eq(rcpnRecords.tenantSlug, tenantSlug),
          inArray(rcpnRecords.recordKey, chunk),
        ),
      );
    if (rows.length === 0) continue;
    const people = await database
      .select()
      .from(rcpnPeople)
      .where(
        inArray(
          rcpnPeople.recordId,
          rows.map((r) => r.id),
        ),
      );
    for (const row of rows) {
      map.set(`${row.kind}:${row.recordKey}`, {
        id: row.id,
        kind: row.kind as RcpnKind,
        subtype: row.subtype === "natimorto" ? "natimorto" : "",
        matricula: row.matricula,
        book: row.book,
        page: row.page,
        term: row.term,
        registeredOn: row.registeredOn,
        eventOn: row.eventOn,
        details: (row.details ?? {}) as Record<string, string>,
        people: people.filter((p) => p.recordId === row.id).map(PERSON_FIELDS),
      });
    }
  }
  return map;
}

/** The conference of an open import against the index as it is now. */
export async function conferenceFor(
  database: Database,
  tenantSlug: string,
  row: ImportRow,
): Promise<Conference> {
  const records = (row.records ?? []) as RcpnRecord[];
  return conferenceOf(
    records,
    await existingFor(database, tenantSlug, records),
  );
}

/** The new value over the old, a blank never erasing what is known. */
function merged<T extends object>(incoming: T, current: T | undefined): T {
  if (!current) return incoming;
  const out = { ...current };
  for (const [key, value] of Object.entries(incoming)) {
    if (value !== "" && value !== null && value !== undefined) {
      (out as Record<string, unknown>)[key] = value;
    }
  }
  return out;
}

async function closeImport(
  database: Database,
  tenantSlug: string,
  row: ImportRow,
  status: "publicada" | "descartada",
  actorId: string,
  publishedCount: number | null,
) {
  await database
    .update(rcpnImports)
    .set({
      status,
      records: null,
      storedPath: null,
      publishedCount,
      closedAt: new Date(),
      closedBy: actorId,
    })
    .where(
      and(eq(rcpnImports.tenantSlug, tenantSlug), eq(rcpnImports.id, row.id)),
    );
  if (row.storedPath) await deleteStoredFile(row.storedPath);
}

/**
 * Publishes an open import: the new registros, and the changed ones in
 * `replace` (keys `kind:recordKey`). Returns how many were written.
 */
export async function publishImportWith(
  database: Database,
  tenantSlug: string,
  id: string,
  actorId: string,
  replace: ReadonlySet<string>,
): Promise<number> {
  const row = await getImportWith(database, tenantSlug, id);
  if (!row || row.status !== "lida") {
    throw new RcpnImportError("Esta importação não está aberta para publicar.");
  }
  const existing = await existingFor(
    database,
    tenantSlug,
    (row.records ?? []) as RcpnRecord[],
  );
  const conference = conferenceOf(
    (row.records ?? []) as RcpnRecord[],
    existing,
  );
  const chosen = toPublish(conference, replace);

  // In batches (decision of 14/11/2026, after a whole base of ~24 thousand
  // registros did not fit one request): one insert per 500 registros and
  // one per their people, instead of two per registro.
  const BATCH = 500;
  const now = new Date();
  await database.transaction(async (tx) => {
    for (let i = 0; i < chosen.length; i += BATCH) {
      const slice = chosen.slice(i, i + BATCH).map((item) => {
        const current = existing.get(item.key);
        return {
          item,
          current,
          record: {
            ...merged(item.record, current),
            // Key by key: a blank in the new file never erases what the
            // book sent before.
            details: merged(item.record.details ?? {}, current?.details ?? {}),
          },
        };
      });
      const saved = await tx
        .insert(rcpnRecords)
        .values(
          slice.map(({ item, record }) => ({
            tenantSlug,
            kind: record.kind,
            subtype: record.subtype ?? "",
            recordKey: recordKey(item.record),
            matricula: record.matricula,
            book: record.book,
            page: record.page,
            term: record.term,
            registeredOn: record.registeredOn,
            eventOn: record.eventOn,
            details: record.details ?? {},
            importId: row.id,
          })),
        )
        .onConflictDoUpdate({
          target: [
            rcpnRecords.tenantSlug,
            rcpnRecords.kind,
            rcpnRecords.recordKey,
          ],
          set: {
            subtype: sql`excluded.subtype`,
            matricula: sql`excluded.matricula`,
            book: sql`excluded.book`,
            page: sql`excluded.page`,
            term: sql`excluded.term`,
            registeredOn: sql`excluded.registered_on`,
            eventOn: sql`excluded.event_on`,
            details: sql`excluded.details`,
            importId: sql`excluded.import_id`,
            updatedAt: now,
          },
        })
        .returning({
          id: rcpnRecords.id,
          kind: rcpnRecords.kind,
          recordKey: rcpnRecords.recordKey,
        });
      const idOf = new Map(
        saved.map((r) => [`${r.kind}:${r.recordKey}`, r.id]),
      );
      const people = slice.flatMap(({ item, current }) => {
        const recordId = idOf.get(item.key);
        if (!recordId) return [];
        return item.record.people.map((incoming) => {
          const person = merged(
            incoming,
            current?.people.find((p) => p.role === incoming.role),
          );
          return {
            tenantSlug,
            recordId,
            role: person.role,
            name: person.name,
            nameNorm: normalizeName(person.name),
            marriedName: person.marriedName,
            motherName: person.motherName,
            motherNorm: normalizeName(person.motherName),
            fatherName: person.fatherName,
            birthDate: person.birthDate,
            profession: person.profession,
            fatherProfession: person.fatherProfession,
            motherProfession: person.motherProfession,
          };
        });
      });
      if (people.length > 0) {
        await tx
          .insert(rcpnPeople)
          .values(people)
          .onConflictDoUpdate({
            target: [rcpnPeople.recordId, rcpnPeople.role],
            set: {
              name: sql`excluded.name`,
              nameNorm: sql`excluded.name_norm`,
              marriedName: sql`excluded.married_name`,
              motherName: sql`excluded.mother_name`,
              motherNorm: sql`excluded.mother_norm`,
              fatherName: sql`excluded.father_name`,
              birthDate: sql`excluded.birth_date`,
              profession: sql`excluded.profession`,
              fatherProfession: sql`excluded.father_profession`,
              motherProfession: sql`excluded.mother_profession`,
            },
          });
      }
    }
    await closeImport(
      tx as unknown as Database,
      tenantSlug,
      row,
      "publicada",
      actorId,
      chosen.length,
    );
  });
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "rcpn.import.publish",
    targetType: "rcpn-import",
    targetId: row.id,
  });
  return chosen.length;
}

export async function discardImportWith(
  database: Database,
  tenantSlug: string,
  id: string,
  actorId: string,
): Promise<void> {
  const row = await getImportWith(database, tenantSlug, id);
  if (!row || (row.status !== "lida" && row.status !== "nao-lida")) {
    throw new RcpnImportError("Esta importação já foi encerrada.");
  }
  await closeImport(database, tenantSlug, row, "descartada", actorId, null);
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "rcpn.import.discard",
    targetType: "rcpn-import",
    targetId: row.id,
  });
}

export interface Coverage {
  kind: RcpnKind;
  count: number;
  /** Of the óbitos, how many are natimortos (Livro C Auxiliar). */
  natimortos: number;
  first: string;
  last: string;
}

/** How much of the registry the index holds, and of which period. */
export async function coverageWith(
  database: Database,
  tenantSlug: string,
): Promise<Coverage[]> {
  const rows = await database
    .select({
      kind: rcpnRecords.kind,
      count: sql<number>`count(*)::int`,
      natimortos: sql<number>`count(*) filter (where ${rcpnRecords.subtype} = 'natimorto')::int`,
      first: sql<string>`min(nullif(${rcpnRecords.registeredOn}, ''))`,
      last: sql<string>`max(nullif(${rcpnRecords.registeredOn}, ''))`,
    })
    .from(rcpnRecords)
    .where(eq(rcpnRecords.tenantSlug, tenantSlug))
    .groupBy(rcpnRecords.kind);
  return RCPN_KINDS.map((kind) => {
    const row = rows.find((r) => r.kind === kind);
    return {
      kind,
      count: row?.count ?? 0,
      natimortos: row?.natimortos ?? 0,
      first: row?.first ?? "",
      last: row?.last ?? "",
    };
  });
}

export interface SearchQuery {
  name: string;
  mother?: string;
  birthDate?: string;
}

export interface SearchHit {
  fit: "exact" | "near";
  person: RcpnPerson;
  record: Omit<RcpnRecord, "people"> & { id: string };
}

/**
 * The panel's search: tolerant of spelling and word order (design, decision
 * 6; the public lookup is exact and lives elsewhere). Candidates come by
 * birth date when given, else by any word's first letters; the fit is
 * decided here, in the core's terms.
 */
export async function searchWith(
  database: Database,
  tenantSlug: string,
  query: SearchQuery,
): Promise<SearchHit[]> {
  const tokens = nameTokens(query.name).filter((t) => t.length >= 3);
  if (tokens.length === 0 && !query.birthDate) return [];
  const where = [eq(rcpnPeople.tenantSlug, tenantSlug)];
  if (query.birthDate) where.push(eq(rcpnPeople.birthDate, query.birthDate));
  const byWord = or(
    ...tokens.map((t) => like(rcpnPeople.nameNorm, `%${t.slice(0, 3)}%`)),
  );
  if (!query.birthDate && byWord) where.push(byWord);
  const rows = await database
    .select({ person: rcpnPeople, record: rcpnRecords })
    .from(rcpnPeople)
    .innerJoin(rcpnRecords, eq(rcpnRecords.id, rcpnPeople.recordId))
    .where(and(...where))
    .orderBy(asc(rcpnPeople.nameNorm))
    .limit(3000);

  const hits: SearchHit[] = [];
  for (const { person, record } of rows) {
    const fit = query.name.trim()
      ? nameFit(query.name, `${person.name} ${person.marriedName}`)
      : "exact";
    if (!fit) continue;
    let finalFit = fit;
    if (query.mother?.trim()) {
      const motherFit = nameFit(query.mother, person.motherName);
      if (!motherFit) continue;
      if (motherFit === "near") finalFit = "near";
    }
    hits.push({
      fit: finalFit,
      person: PERSON_FIELDS(person),
      record: {
        id: record.id,
        kind: record.kind as RcpnKind,
        subtype: record.subtype === "natimorto" ? "natimorto" : "",
        matricula: record.matricula,
        book: record.book,
        page: record.page,
        term: record.term,
        registeredOn: record.registeredOn,
        eventOn: record.eventOn,
      },
    });
  }
  hits.sort((a, b) =>
    a.fit === b.fit
      ? a.person.name.localeCompare(b.person.name, "pt-BR")
      : a.fit === "exact"
        ? -1
        : 1,
  );
  return hits.slice(0, 50);
}

export const rcpn = {
  createImport: (
    tenantSlug: string,
    input: Parameters<typeof createImportWith>[2],
  ) => createImportWith(db, tenantSlug, input),
  listImports: (tenantSlug: string) => listImportsWith(db, tenantSlug),
  getImport: (tenantSlug: string, id: string) =>
    getImportWith(db, tenantSlug, id),
  conference: (tenantSlug: string, row: ImportRow) =>
    conferenceFor(db, tenantSlug, row),
  publish: (
    tenantSlug: string,
    id: string,
    actorId: string,
    replace: ReadonlySet<string>,
  ) => publishImportWith(db, tenantSlug, id, actorId, replace),
  discard: (tenantSlug: string, id: string, actorId: string) =>
    discardImportWith(db, tenantSlug, id, actorId),
  coverage: (tenantSlug: string) => coverageWith(db, tenantSlug),
  search: (tenantSlug: string, query: SearchQuery) =>
    searchWith(db, tenantSlug, query),
  books: (tenantSlug: string) => booksWith(db, tenantSlug),
  bookIndex: (tenantSlug: string, kind: RcpnKind, book: string) =>
    bookIndexWith(db, tenantSlug, kind, book),
};

/** One book of the index: its kind, how many registros, from which term. */
export interface BookSummary {
  kind: RcpnKind;
  subtype: "" | "natimorto";
  book: string;
  count: number;
  first: string;
  last: string;
}

/**
 * The books the office sent, each with its registros (decision of
 * 14/11/2026: "fazer cada índice com base nos livros que enviei").
 */
export async function booksWith(
  database: Database,
  tenantSlug: string,
): Promise<BookSummary[]> {
  const rows = await database
    .select({
      kind: rcpnRecords.kind,
      subtype: rcpnRecords.subtype,
      book: rcpnRecords.book,
      count: sql<number>`count(*)::int`,
      first: sql<string>`min(${rcpnRecords.registeredOn})`,
      last: sql<string>`max(${rcpnRecords.registeredOn})`,
    })
    .from(rcpnRecords)
    .where(eq(rcpnRecords.tenantSlug, tenantSlug))
    .groupBy(rcpnRecords.kind, rcpnRecords.subtype, rcpnRecords.book);
  const order = (kind: string) => RCPN_KINDS.indexOf(kind as RcpnKind);
  return rows
    .map((r) => ({
      kind: r.kind as RcpnKind,
      subtype: (r.subtype === "natimorto" ? "natimorto" : "") as
        | ""
        | "natimorto",
      book: r.book,
      count: Number(r.count),
      first: r.first ?? "",
      last: r.last ?? "",
    }))
    .sort(
      (a, b) =>
        order(a.kind) - order(b.kind) ||
        a.subtype.localeCompare(b.subtype) ||
        a.book.localeCompare(b.book, "pt-BR", { numeric: true }),
    );
}

export interface BookEntry {
  id: string;
  page: string;
  term: string;
  matricula: string;
  registeredOn: string;
  eventOn: string;
  names: string[];
  complete: boolean;
}

/** The index of one book: its registros by folha and termo. */
export async function bookIndexWith(
  database: Database,
  tenantSlug: string,
  kind: RcpnKind,
  book: string,
): Promise<BookEntry[]> {
  const records = await database
    .select()
    .from(rcpnRecords)
    .where(
      and(
        eq(rcpnRecords.tenantSlug, tenantSlug),
        eq(rcpnRecords.kind, kind),
        eq(rcpnRecords.book, book),
      ),
    )
    .limit(5000);
  if (records.length === 0) return [];
  const people = await database
    .select({
      recordId: rcpnPeople.recordId,
      role: rcpnPeople.role,
      name: rcpnPeople.name,
    })
    .from(rcpnPeople)
    .where(
      inArray(
        rcpnPeople.recordId,
        records.map((r) => r.id),
      ),
    );
  const num = (v: string) => Number.parseInt(v.replace(/\D/g, ""), 10) || 0;
  return records
    .map((r) => ({
      id: r.id,
      page: r.page,
      term: r.term,
      matricula: r.matricula,
      registeredOn: r.registeredOn,
      eventOn: r.eventOn,
      names: people
        .filter((p) => p.recordId === r.id)
        .sort((a, b) => a.role.localeCompare(b.role))
        .map((p) => p.name),
      complete: Object.keys((r.details ?? {}) as object).length > 0,
    }))
    .sort((a, b) => num(a.page) - num(b.page) || num(a.term) - num(b.term));
}
