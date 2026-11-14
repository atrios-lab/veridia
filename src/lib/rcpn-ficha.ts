import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { applyFicha, type FichaChange } from "@/core/rcpn/ficha.ts";
import { nameFit, nameTokens, normalizeName } from "@/core/rcpn/names.ts";
import type {
  RcpnKind,
  RcpnPerson,
  RcpnRecord,
  RcpnRole,
} from "@/core/rcpn/record.ts";
import { user } from "@/db/auth-schema.ts";
import { type Database, db } from "@/db/index.ts";
import { rcpnPeople, rcpnRecordChanges, rcpnRecords } from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";

/**
 * The ficha of a registro of the index (decision of 14/11/2026): read
 * whole, corrected with a justification, cancelled and restored ("como no
 * sistema atual"). Nothing is deleted: a correction keeps the fields
 * before and after, a cancellation marks the row, an estorno takes the
 * mark off, and each one goes to the audit with its reason.
 */

export class FichaError extends Error {}

export interface Ficha {
  record: RcpnRecord & { id: string };
  canceledAt: Date | null;
  cancelReason: string;
  editedAt: Date | null;
  history: {
    id: string;
    kind: "edicao" | "cancelamento" | "estorno";
    reason: string;
    changes: FichaChange[];
    actorId: string;
    /** The person's name; "" for the platform's own account. */
    actorName: string;
    createdAt: Date;
  }[];
}

const ROLE_ORDER: RcpnRole[] = [
  "registrado",
  "conjuge1",
  "conjuge2",
  "falecido",
];

const isUuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

function personOf(p: typeof rcpnPeople.$inferSelect): RcpnPerson {
  return {
    role: p.role as RcpnRole,
    name: p.name,
    marriedName: p.marriedName,
    motherName: p.motherName,
    fatherName: p.fatherName,
    birthDate: p.birthDate,
    profession: p.profession,
    fatherProfession: p.fatherProfession,
    motherProfession: p.motherProfession,
  };
}

export async function getFichaWith(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<Ficha | null> {
  if (!isUuid(id)) return null;
  const [row] = await database
    .select()
    .from(rcpnRecords)
    .where(and(eq(rcpnRecords.tenantSlug, tenantSlug), eq(rcpnRecords.id, id)));
  if (!row) return null;
  const [people, history] = await Promise.all([
    database.select().from(rcpnPeople).where(eq(rcpnPeople.recordId, row.id)),
    database
      .select()
      .from(rcpnRecordChanges)
      .where(eq(rcpnRecordChanges.recordId, row.id))
      .orderBy(desc(rcpnRecordChanges.createdAt))
      .limit(100),
  ]);
  people.sort(
    (a, b) =>
      ROLE_ORDER.indexOf(a.role as RcpnRole) -
      ROLE_ORDER.indexOf(b.role as RcpnRole),
  );
  const actorIds = [...new Set(history.map((h) => h.actorId))];
  // The Átrios account leaves no name behind (decision of 13/11/2026).
  const names = new Map(
    actorIds.length
      ? (
          await database
            .select({ id: user.id, name: user.name, role: user.role })
            .from(user)
            .where(inArray(user.id, actorIds))
        )
          .filter((person) => person.role !== "superadmin")
          .map((person) => [person.id, person.name])
      : [],
  );
  return {
    record: {
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
      people: people.map(personOf),
    },
    canceledAt: row.canceledAt,
    cancelReason: row.cancelReason ?? "",
    editedAt: row.editedAt,
    history: history.map((h) => ({
      id: h.id,
      kind: h.kind as Ficha["history"][number]["kind"],
      reason: h.reason,
      changes: (h.changes ?? []) as FichaChange[],
      actorId: h.actorId,
      actorName: names.get(h.actorId) ?? "",
      createdAt: h.createdAt,
    })),
  };
}

const MIN_REASON = 3;

function mustReason(reason: string): string {
  const clean = reason.trim();
  if (clean.length < MIN_REASON) {
    throw new FichaError("Escreva a justificativa (pelo menos 3 letras).");
  }
  return clean.slice(0, 5000);
}

/**
 * Saves the ficha: the registro's columns, its people and the rest of the
 * registro. Returns how many fields changed (0: nothing to save).
 */
export async function saveFichaWith(
  database: Database,
  tenantSlug: string,
  id: string,
  values: Record<string, string>,
  actorId: string,
  reason: string,
): Promise<number> {
  const why = mustReason(reason);
  const ficha = await getFichaWith(database, tenantSlug, id);
  if (!ficha) throw new FichaError("Registro não encontrado.");
  const { record, changes, problems } = applyFicha(ficha.record, values);
  if (problems.length > 0) throw new FichaError(problems.join(" "));
  if (changes.length === 0) return 0;
  const now = new Date();
  await database.transaction(async (tx) => {
    await tx
      .update(rcpnRecords)
      .set({
        matricula: record.matricula,
        book: record.book,
        page: record.page,
        term: record.term,
        registeredOn: record.registeredOn,
        eventOn: record.eventOn,
        details: record.details ?? {},
        editedAt: now,
        editedBy: actorId,
        updatedAt: now,
      })
      .where(eq(rcpnRecords.id, ficha.record.id));
    for (const person of record.people) {
      const values = {
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
      await tx
        .insert(rcpnPeople)
        .values({
          tenantSlug,
          recordId: ficha.record.id,
          role: person.role,
          ...values,
        })
        .onConflictDoUpdate({
          target: [rcpnPeople.recordId, rcpnPeople.role],
          set: values,
        });
    }
    await tx.insert(rcpnRecordChanges).values({
      tenantSlug,
      recordId: ficha.record.id,
      kind: "edicao",
      reason: why,
      changes,
      actorId,
    });
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId,
      action: "rcpn.record.edit",
      targetType: "rcpn-record",
      targetId: ficha.record.id,
      reason: why,
    });
  });
  return changes.length;
}

/** Marks the registro cancelled: it stays, with who, when and why. */
export async function cancelRecordWith(
  database: Database,
  tenantSlug: string,
  id: string,
  actorId: string,
  reason: string,
): Promise<void> {
  const why = mustReason(reason);
  const ficha = await getFichaWith(database, tenantSlug, id);
  if (!ficha) throw new FichaError("Registro não encontrado.");
  if (ficha.canceledAt)
    throw new FichaError("Este registro já está cancelado.");
  await database.transaction(async (tx) => {
    await tx
      .update(rcpnRecords)
      .set({
        canceledAt: new Date(),
        canceledBy: actorId,
        cancelReason: why,
      })
      .where(eq(rcpnRecords.id, ficha.record.id));
    await tx.insert(rcpnRecordChanges).values({
      tenantSlug,
      recordId: ficha.record.id,
      kind: "cancelamento",
      reason: why,
      actorId,
    });
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId,
      action: "rcpn.record.cancel",
      targetType: "rcpn-record",
      targetId: ficha.record.id,
      reason: why,
    });
  });
}

/** The estorno: the cancellation undone; the history keeps both. */
export async function restoreRecordWith(
  database: Database,
  tenantSlug: string,
  id: string,
  actorId: string,
  reason: string,
): Promise<void> {
  const why = mustReason(reason);
  const ficha = await getFichaWith(database, tenantSlug, id);
  if (!ficha) throw new FichaError("Registro não encontrado.");
  if (!ficha.canceledAt)
    throw new FichaError("Este registro não está cancelado.");
  await database.transaction(async (tx) => {
    await tx
      .update(rcpnRecords)
      .set({ canceledAt: null, canceledBy: null, cancelReason: null })
      .where(eq(rcpnRecords.id, ficha.record.id));
    await tx.insert(rcpnRecordChanges).values({
      tenantSlug,
      recordId: ficha.record.id,
      kind: "estorno",
      reason: why,
      actorId,
    });
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId,
      action: "rcpn.record.restore",
      targetType: "rcpn-record",
      targetId: ficha.record.id,
      reason: why,
    });
  });
}

/** The keys (`kind:recordKey`) of registros corrected by hand. */
export async function editedKeysWith(
  database: Database,
  tenantSlug: string,
): Promise<Set<string>> {
  const rows = await database
    .select({ kind: rcpnRecords.kind, recordKey: rcpnRecords.recordKey })
    .from(rcpnRecords)
    .where(
      and(
        eq(rcpnRecords.tenantSlug, tenantSlug),
        isNotNull(rcpnRecords.editedAt),
      ),
    );
  return new Set(rows.map((r) => `${r.kind}:${r.recordKey}`));
}

// ---------------------------------------------------------------- search

export const SEARCH_MODES = [
  "nome",
  "filiacao",
  "avos",
  "termo",
  "livro",
  "matricula",
  "dnv",
  "cpf",
] as const;
export type SearchMode = (typeof SEARCH_MODES)[number];

export const SEARCH_MODE_LABELS: Record<SearchMode, string> = {
  nome: "Nome",
  filiacao: "Filiação (mãe ou pai)",
  avos: "Avós",
  termo: "Número do termo",
  livro: "Livro",
  matricula: "Matrícula",
  dnv: "DNV",
  cpf: "CPF",
};

export const DATE_FIELDS = ["nascimento", "registro", "evento"] as const;
export type DateField = (typeof DATE_FIELDS)[number];

export interface RecordQuery {
  kind: RcpnKind;
  mode: SearchMode;
  text: string;
  dateField?: DateField;
  from?: string;
  to?: string;
}

export interface RecordHit {
  id: string;
  kind: RcpnKind;
  subtype: "" | "natimorto";
  book: string;
  page: string;
  term: string;
  matricula: string;
  registeredOn: string;
  eventOn: string;
  names: string[];
  motherName: string;
  fatherName: string;
  birthDate: string;
  canceled: boolean;
  hasNotes: boolean;
  fit: "exact" | "near";
}

const MAX_HITS = 200;

/**
 * Capitals without accents, in SQL, to compare with the core's name tokens
 * (core/rcpn/names). The accents go first: `upper` alone does not know
 * them in every database locale.
 */
const plain = (column: unknown) =>
  sql`upper(translate(${column}, 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'))`;

/** "A-08", "A08" and "a 8": the same book. */
const bookNorm = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/([A-Z]+)0+(\d)/, "$1$2");

const digits = (value: string) => value.replace(/\D/g, "");

/**
 * The search of the Registro Civil by kind (decision of 14/11/2026): by
 * name, filiação, avós, termo, livro, matrícula, DNV or CPF, and between
 * two dates of birth, registro or the event. A name is matched in any
 * order and with one letter off (core/rcpn/names); a number is matched by
 * its digits. Cancelled registros come too, marked.
 */
export async function searchRecordsWith(
  database: Database,
  tenantSlug: string,
  query: RecordQuery,
): Promise<RecordHit[]> {
  const text = query.text.trim().slice(0, 200);
  const where = [
    eq(rcpnRecords.tenantSlug, tenantSlug),
    eq(rcpnRecords.kind, query.kind),
  ];
  const byName = query.mode === "nome" || query.mode === "filiacao";
  const tokens = nameTokens(text).filter((t) => t.length >= 3);

  if (text) {
    switch (query.mode) {
      case "nome":
      case "filiacao": {
        if (tokens.length === 0) return [];
        const column =
          query.mode === "nome"
            ? sql`${rcpnPeople.nameNorm} || ' ' || ${rcpnPeople.marriedName}`
            : sql`${rcpnPeople.motherNorm} || ' ' || ${rcpnPeople.fatherName}`;
        where.push(
          sql`(${sql.join(
            tokens.map(
              (t) => sql`${plain(column)} like ${`%${t.slice(0, 3)}%`}`,
            ),
            sql` or `,
          )})`,
        );
        break;
      }
      case "avos": {
        if (tokens.length === 0) return [];
        const avos = sql`coalesce(${rcpnRecords.details}->>'avos1', '') || ' ' || coalesce(${rcpnRecords.details}->>'avos2', '')`;
        for (const t of tokens) {
          where.push(sql`${plain(avos)} like ${`%${t}%`}`);
        }
        break;
      }
      case "termo": {
        const n = Number.parseInt(digits(text), 10);
        if (!Number.isFinite(n)) return [];
        where.push(
          sql`nullif(regexp_replace(${rcpnRecords.term}, '\\D', '', 'g'), '')::bigint = ${n}`,
        );
        break;
      }
      case "livro": {
        const wanted = bookNorm(text);
        if (!wanted) return [];
        where.push(
          sql`regexp_replace(regexp_replace(upper(${rcpnRecords.book}), '[^0-9A-Z]', '', 'g'), '([A-Z]+)0+([0-9])', '\\1\\2') = ${wanted}`,
        );
        break;
      }
      case "matricula": {
        const d = digits(text);
        if (d.length < 6) return [];
        where.push(sql`${rcpnRecords.matricula} like ${`%${d}%`}`);
        break;
      }
      case "dnv": {
        const d = digits(text);
        if (!d) return [];
        where.push(
          sql`regexp_replace(coalesce(${rcpnRecords.details}->>'dnv', ''), '\\D', '', 'g') = ${d}`,
        );
        break;
      }
      case "cpf": {
        const d = digits(text);
        if (d.length < 11) return [];
        const cpfs = sql`coalesce(${rcpnRecords.details}->>'cpf', '') || ' ' || coalesce(${rcpnRecords.details}->>'conjuge1Cpf', '') || ' ' || coalesce(${rcpnRecords.details}->>'conjuge2Cpf', '') || ' ' || coalesce(${rcpnRecords.details}->>'documento', '')`;
        where.push(
          sql`regexp_replace(${cpfs}, '\\D', '', 'g') like ${`%${d}%`}`,
        );
        break;
      }
    }
  }

  const from = query.from ?? "";
  const to = query.to ?? "";
  if (from || to) {
    const column =
      query.dateField === "nascimento"
        ? rcpnPeople.birthDate
        : query.dateField === "evento"
          ? rcpnRecords.eventOn
          : rcpnRecords.registeredOn;
    if (from) where.push(sql`${column} <> '' and ${column} >= ${from}`);
    if (to) where.push(sql`${column} <> '' and ${column} <= ${to}`);
  }
  if (!text && !from && !to) return [];

  const rows = await database
    .select({ person: rcpnPeople, record: rcpnRecords })
    .from(rcpnPeople)
    .innerJoin(rcpnRecords, eq(rcpnRecords.id, rcpnPeople.recordId))
    .where(and(...where))
    .orderBy(asc(rcpnPeople.nameNorm))
    .limit(3000);

  const hits = new Map<string, RecordHit>();
  for (const { person, record } of rows) {
    let fit: "exact" | "near" = "exact";
    if (text && byName) {
      const found =
        query.mode === "nome"
          ? nameFit(text, `${person.name} ${person.marriedName}`)
          : (nameFit(text, person.motherName) ??
            nameFit(text, person.fatherName));
      if (!found) continue;
      fit = found;
    }
    const current = hits.get(record.id);
    if (current) {
      if (!current.names.includes(person.name)) current.names.push(person.name);
      if (fit === "exact") current.fit = "exact";
      continue;
    }
    const details = (record.details ?? {}) as Record<string, string>;
    hits.set(record.id, {
      id: record.id,
      kind: record.kind as RcpnKind,
      subtype: record.subtype === "natimorto" ? "natimorto" : "",
      book: record.book,
      page: record.page,
      term: record.term,
      matricula: record.matricula,
      registeredOn: record.registeredOn,
      eventOn: record.eventOn,
      names: [person.name],
      motherName: person.motherName,
      fatherName: person.fatherName,
      birthDate: person.birthDate,
      canceled: Boolean(record.canceledAt),
      hasNotes: Boolean(details.observacoes?.trim()),
      fit,
    });
  }
  return [...hits.values()]
    .sort((a, b) =>
      a.fit === b.fit
        ? (a.names[0] ?? "").localeCompare(b.names[0] ?? "", "pt-BR")
        : a.fit === "exact"
          ? -1
          : 1,
    )
    .slice(0, MAX_HITS);
}

/** Which of these registros are cancelled, for lists built elsewhere. */
export async function canceledAmongWith(
  database: Database,
  ids: string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await database
    .select({ id: rcpnRecords.id })
    .from(rcpnRecords)
    .where(
      and(inArray(rcpnRecords.id, ids), isNotNull(rcpnRecords.canceledAt)),
    );
  return new Set(rows.map((r) => r.id));
}

export const ficha = {
  get: (tenantSlug: string, id: string) => getFichaWith(db, tenantSlug, id),
  save: (
    tenantSlug: string,
    id: string,
    values: Record<string, string>,
    actorId: string,
    reason: string,
  ) => saveFichaWith(db, tenantSlug, id, values, actorId, reason),
  cancel: (tenantSlug: string, id: string, actorId: string, reason: string) =>
    cancelRecordWith(db, tenantSlug, id, actorId, reason),
  restore: (tenantSlug: string, id: string, actorId: string, reason: string) =>
    restoreRecordWith(db, tenantSlug, id, actorId, reason),
  search: (tenantSlug: string, query: RecordQuery) =>
    searchRecordsWith(db, tenantSlug, query),
};
