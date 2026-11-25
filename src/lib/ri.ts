import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq, inArray, isNull, max } from "drizzle-orm";
import {
  type Act,
  type ActEffect,
  type ActKind,
  type ActParty,
  nextSeq,
  type PartyRole,
  ROLES_BY_EFFECT,
  situationOf,
} from "@/core/ri/acts.ts";
import { cnsDigits } from "@/core/ri/cnm.ts";
import {
  cnmBatch,
  type ExportProperty,
  indicadorPessoal,
  indicadorReal,
  type RealMode,
  type Skipped,
} from "@/core/ri/onr.ts";
import {
  EMPTY_CONDO,
  EMPTY_RURAL,
  isoDate,
  type PropertyInput,
} from "@/core/ri/property.ts";
import type { SheetOwner, SheetRow } from "@/core/ri/sheet.ts";
import { OFFICE_TIME_ZONE } from "@/core/time/office-time.ts";
import { type Database, db } from "@/db/index.ts";
import {
  riActParties,
  riActs,
  riExports,
  riPeople,
  riProperties,
  riSettings,
} from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";

/**
 * The Registro de Imóveis of the office (change registro-de-imoveis-acervo):
 * the matrículas, their lançamentos, the people of the Indicador Pessoal,
 * the import of the index the office already keeps and the files for the
 * ONR. Nothing here deletes a row: "apagar" marks it, every change keeps
 * what it replaced, and each act goes to the audit in the office's words.
 */

export class RiError extends Error {}

export interface Actor {
  id: string;
}

type PropertyRow = typeof riProperties.$inferSelect;
type PersonRow = typeof riPeople.$inferSelect;

export interface StoredProperty extends ExportProperty {
  source: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  history: HistoryEntry[];
}

export interface HistoryEntry {
  at: string;
  by: string;
  changes: { field: string; before: unknown; after: unknown }[];
}

const UUID = /^[0-9a-f-]{36}$/i;

export function toProperty(row: PropertyRow): StoredProperty {
  return {
    id: row.id,
    book: row.book === 3 ? 3 : 2,
    number: row.number,
    recordKind: row.recordKind,
    status: row.status,
    cnm: row.cnm,
    cnmInPgv: row.cnmInPgv,
    openedOn: row.openedOn,
    origin: row.origin,
    ficha: row.ficha,
    location: row.location,
    propertyKind: row.propertyKind,
    streetKind: row.streetKind,
    street: row.street,
    streetNumber: row.streetNumber,
    district: row.district,
    cep: row.cep,
    complement: row.complement,
    quadra: row.quadra,
    setor: row.setor,
    conjunto: row.conjunto,
    lote: row.lote,
    loteamento: row.loteamento,
    contributors: Array.isArray(row.contributors)
      ? (row.contributors as unknown[]).map(String)
      : [],
    rural: { ...EMPTY_RURAL, ...((row.rural as object) ?? {}) },
    condo: { ...EMPTY_CONDO, ...((row.condo as object) ?? {}) },
    area: row.area,
    priorActs: row.priorActs,
    description: row.description,
    notes: row.notes,
    source: row.source,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
    history: (row.history as HistoryEntry[]) ?? [],
  };
}

function columnsOf(input: PropertyInput) {
  return {
    book: input.book,
    number: input.number,
    recordKind: input.recordKind,
    status: input.status,
    cnm: input.cnm,
    cnmInPgv: input.cnmInPgv,
    openedOn: input.openedOn,
    origin: input.origin,
    ficha: input.ficha,
    location: input.location,
    propertyKind: input.propertyKind,
    streetKind: input.streetKind,
    street: input.street,
    streetNumber: input.streetNumber,
    district: input.district,
    cep: input.cep,
    complement: input.complement,
    quadra: input.quadra,
    setor: input.setor,
    conjunto: input.conjunto,
    lote: input.lote,
    loteamento: input.loteamento,
    contributors: input.contributors,
    rural: input.rural,
    condo: input.condo,
    area: input.area,
    priorActs: input.priorActs,
    description: input.description,
    notes: input.notes,
  };
}

/** The fields that changed, with what they had and what they get. */
export function changesBetween(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): HistoryEntry["changes"] {
  const out: HistoryEntry["changes"] = [];
  for (const [field, value] of Object.entries(after)) {
    const old = before[field];
    if (JSON.stringify(old ?? null) !== JSON.stringify(value ?? null)) {
      out.push({ field, before: old ?? null, after: value ?? null });
    }
  }
  return out;
}

// ------------------------------------------------------------- settings

export async function riSettingsWith(database: Database, tenantSlug: string) {
  const [row] = await database
    .select()
    .from(riSettings)
    .where(eq(riSettings.tenantSlug, tenantSlug))
    .limit(1);
  return { ibgeCity: row?.ibgeCity ?? "" };
}

export async function saveRiSettingsWith(
  database: Database,
  tenantSlug: string,
  ibgeCity: string,
  actor: Actor,
): Promise<void> {
  const code = ibgeCity.replace(/\D/g, "");
  if (code && code.length !== 7) {
    throw new RiError("O código IBGE do município tem 7 dígitos.");
  }
  await database
    .insert(riSettings)
    .values({ tenantSlug, ibgeCity: code, updatedBy: actor.id })
    .onConflictDoUpdate({
      target: riSettings.tenantSlug,
      set: { ibgeCity: code, updatedBy: actor.id, updatedAt: new Date() },
    });
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "ri.settings",
    targetType: "ri-settings",
    targetId: null,
  });
}

// --------------------------------------------------------------- acervo

export interface Acervo {
  properties: StoredProperty[];
  acts: Map<string, Act[]>;
  people: Map<string, PersonRow>;
}

/** Everything of the acervo in force, read in four queries. */
export async function loadAcervoWith(
  database: Database,
  tenantSlug: string,
  options: { deleted?: boolean } = {},
): Promise<Acervo> {
  const [propertyRows, actRows, partyRows, personRows] = await Promise.all([
    database
      .select()
      .from(riProperties)
      .where(
        and(
          eq(riProperties.tenantSlug, tenantSlug),
          options.deleted ? undefined : isNull(riProperties.deletedAt),
        ),
      ),
    database
      .select()
      .from(riActs)
      .where(and(eq(riActs.tenantSlug, tenantSlug), isNull(riActs.deletedAt))),
    database
      .select()
      .from(riActParties)
      .where(
        and(
          eq(riActParties.tenantSlug, tenantSlug),
          isNull(riActParties.removedAt),
        ),
      ),
    database.select().from(riPeople).where(eq(riPeople.tenantSlug, tenantSlug)),
  ]);
  const people = new Map(personRows.map((p) => [p.id, p]));
  const partiesByAct = new Map<string, ActParty[]>();
  for (const party of partyRows) {
    const person = people.get(party.personId);
    const list = partiesByAct.get(party.actId) ?? [];
    list.push({
      personId: party.personId,
      name: person?.name ?? "",
      document: person?.document ?? "",
      role: party.role as PartyRole,
      share: party.share,
    });
    partiesByAct.set(party.actId, list);
  }
  const acts = new Map<string, Act[]>();
  for (const row of actRows) {
    const list = acts.get(row.propertyId) ?? [];
    list.push(actOf(row, partiesByAct.get(row.id) ?? []));
    acts.set(row.propertyId, list);
  }
  for (const list of acts.values()) list.sort((a, b) => a.seq - b.seq);
  return {
    properties: propertyRows
      .map(toProperty)
      .sort(
        (a, b) =>
          a.recordKind - b.recordKind || a.book - b.book || a.number - b.number,
      ),
    acts,
    people,
  };
}

export function loadAcervo(
  tenantSlug: string,
  options?: { deleted?: boolean },
) {
  return loadAcervoWith(db, tenantSlug, options);
}

function actOf(row: typeof riActs.$inferSelect, parties: ActParty[]): Act {
  return {
    id: row.id,
    seq: row.seq,
    kind: row.kind as ActKind,
    effect: row.effect as ActEffect,
    nature: row.nature,
    registeredOn: row.registeredOn,
    summary: row.summary,
    cancelsActId: row.cancelsActId,
    parties,
  };
}

export interface PropertyDetail {
  property: StoredProperty;
  acts: (Act & {
    protocol: string;
    seal: string;
    valueCents: number | null;
    edited: boolean;
  })[];
  deletedActs: { id: string; label: string; deletedAt: Date }[];
}

export async function propertyDetailWith(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<PropertyDetail | null> {
  if (!UUID.test(id)) return null;
  const [row] = await database
    .select()
    .from(riProperties)
    .where(
      and(eq(riProperties.tenantSlug, tenantSlug), eq(riProperties.id, id)),
    )
    .limit(1);
  if (!row) return null;
  const actRows = await database
    .select()
    .from(riActs)
    .where(and(eq(riActs.tenantSlug, tenantSlug), eq(riActs.propertyId, id)));
  const live = actRows.filter((a) => !a.deletedAt);
  const partyRows = live.length
    ? await database
        .select({ party: riActParties, person: riPeople })
        .from(riActParties)
        .innerJoin(riPeople, eq(riPeople.id, riActParties.personId))
        .where(
          and(
            inArray(
              riActParties.actId,
              live.map((a) => a.id),
            ),
            isNull(riActParties.removedAt),
          ),
        )
    : [];
  const acts = live
    .map((a) => ({
      ...actOf(
        a,
        partyRows
          .filter((p) => p.party.actId === a.id)
          .map((p) => ({
            personId: p.person.id,
            name: p.person.name,
            document: p.person.document,
            role: p.party.role as PartyRole,
            share: p.party.share,
          })),
      ),
      protocol: a.protocol,
      seal: a.seal,
      valueCents: a.valueCents,
      edited: ((a.history as unknown[]) ?? []).length > 0,
    }))
    .sort((a, b) => a.seq - b.seq);
  return {
    property: toProperty(row),
    acts,
    deletedActs: actRows
      .filter((a) => a.deletedAt)
      .map((a) => ({
        id: a.id,
        label: `${a.kind}-${a.seq} ${a.nature}`.trim(),
        deletedAt: a.deletedAt as Date,
      })),
  };
}

// ------------------------------------------------------------ matrículas

async function ownProperty(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<PropertyRow> {
  if (!UUID.test(id)) throw new RiError("Matrícula não encontrada.");
  const [row] = await database
    .select()
    .from(riProperties)
    .where(
      and(eq(riProperties.tenantSlug, tenantSlug), eq(riProperties.id, id)),
    )
    .limit(1);
  if (!row) throw new RiError("Matrícula não encontrada.");
  return row;
}

export async function createPropertyWith(
  database: Database,
  tenantSlug: string,
  input: PropertyInput,
  actor: Actor,
  options: { source?: string; owners?: SheetOwner[] } = {},
): Promise<string> {
  return database.transaction(async (tx) => {
    const [row] = await tx
      .insert(riProperties)
      .values({
        tenantSlug,
        ...columnsOf(input),
        source: options.source ?? "manual",
        createdBy: actor.id,
      })
      .returning({ id: riProperties.id });
    if (!row) throw new RiError("Não deu para salvar a matrícula.");
    if (options.owners && options.owners.length > 0) {
      const [migration] = await tx
        .insert(riActs)
        .values({
          tenantSlug,
          propertyId: row.id,
          kind: "M",
          seq: 0,
          effect: "titularidade",
          nature: "Situação na migração",
          registeredOn: input.openedOn,
          createdBy: actor.id,
        })
        .returning({ id: riActs.id });
      for (const owner of options.owners) {
        const personId = await findOrCreatePersonWith(
          tx as unknown as Database,
          tenantSlug,
          owner,
          actor,
        );
        await tx.insert(riActParties).values({
          tenantSlug,
          actId: migration?.id as string,
          personId,
          role: "titular",
        });
      }
    }
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId: actor.id,
      action: "ri.property-create",
      targetType: "ri-property",
      targetId: row.id,
    });
    return row.id;
  });
}

/** Changes a matrícula, keeping what it had. 0 when nothing changed. */
export async function updatePropertyWith(
  database: Database,
  tenantSlug: string,
  id: string,
  input: PropertyInput,
  actor: Actor,
): Promise<number> {
  const row = await ownProperty(database, tenantSlug, id);
  if (row.deletedAt) throw new RiError("Esta matrícula está apagada.");
  const before = columnsOf(toProperty(row));
  const after = columnsOf(input);
  const changes = changesBetween(before, after);
  if (changes.length === 0) return 0;
  const history = [
    ...((row.history as HistoryEntry[]) ?? []),
    { at: new Date().toISOString(), by: actor.id, changes },
  ];
  await database
    .update(riProperties)
    .set({ ...after, history, updatedAt: new Date() })
    .where(eq(riProperties.id, id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "ri.property-edit",
    targetType: "ri-property",
    targetId: id,
  });
  return changes.length;
}

export async function setPropertyDeletedWith(
  database: Database,
  tenantSlug: string,
  id: string,
  deleted: boolean,
  actor: Actor,
): Promise<void> {
  const row = await ownProperty(database, tenantSlug, id);
  if (Boolean(row.deletedAt) === deleted) return;
  await database
    .update(riProperties)
    .set(
      deleted
        ? { deletedAt: new Date(), deletedBy: actor.id }
        : { deletedAt: null, deletedBy: null, updatedAt: new Date() },
    )
    .where(eq(riProperties.id, id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: deleted ? "ri.property-delete" : "ri.property-restore",
    targetType: "ri-property",
    targetId: id,
  });
}

/** Marks the CNM of these matrículas as already in the PGV (or not). */
export async function setCnmInPgvWith(
  database: Database,
  tenantSlug: string,
  ids: string[],
  inPgv: boolean,
  actor: Actor,
): Promise<number> {
  const valid = ids.filter((id) => UUID.test(id));
  if (valid.length === 0) return 0;
  const rows = await database
    .update(riProperties)
    .set({ cnmInPgv: inPgv, updatedAt: new Date() })
    .where(
      and(
        eq(riProperties.tenantSlug, tenantSlug),
        inArray(riProperties.id, valid),
      ),
    )
    .returning({ id: riProperties.id });
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: inPgv ? "ri.cnm-in-pgv" : "ri.cnm-not-in-pgv",
    targetType: "ri-property",
    targetId: rows.length === 1 ? (rows[0]?.id ?? null) : null,
  });
  return rows.length;
}

// --------------------------------------------------------------- people

const normalName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

/**
 * The person with this CPF/CNPJ, or (with no document on either side) the
 * same name; created when there is none.
 */
export async function findOrCreatePersonWith(
  database: Database,
  tenantSlug: string,
  who: { name: string; document: string },
  actor: Actor,
): Promise<string> {
  const name = who.name.replace(/\s+/g, " ").trim().slice(0, 300);
  const document = who.document.replace(/\D/g, "").slice(0, 14);
  if (name.length < 2) throw new RiError("Escreva o nome da pessoa.");
  const candidates = await database
    .select()
    .from(riPeople)
    .where(
      and(
        eq(riPeople.tenantSlug, tenantSlug),
        isNull(riPeople.deletedAt),
        document ? eq(riPeople.document, document) : eq(riPeople.document, ""),
      ),
    );
  const found = document
    ? candidates[0]
    : candidates.find((p) => normalName(p.name) === normalName(name));
  if (found) return found.id;
  const [row] = await database
    .insert(riPeople)
    .values({ tenantSlug, name, document, createdBy: actor.id })
    .returning({ id: riPeople.id });
  return row?.id as string;
}

async function ownPerson(database: Database, tenantSlug: string, id: string) {
  if (!UUID.test(id)) throw new RiError("Pessoa não encontrada.");
  const [row] = await database
    .select()
    .from(riPeople)
    .where(and(eq(riPeople.tenantSlug, tenantSlug), eq(riPeople.id, id)))
    .limit(1);
  if (!row) throw new RiError("Pessoa não encontrada.");
  return row;
}

export async function personWith(
  database: Database,
  tenantSlug: string,
  id: string,
) {
  return UUID.test(id) ? ownPerson(database, tenantSlug, id) : null;
}

export async function createPersonWith(
  database: Database,
  tenantSlug: string,
  who: { name: string; document: string; notes: string },
  actor: Actor,
): Promise<string> {
  const document = who.document.replace(/\D/g, "");
  if (document) {
    const [same] = await database
      .select({ id: riPeople.id })
      .from(riPeople)
      .where(
        and(
          eq(riPeople.tenantSlug, tenantSlug),
          eq(riPeople.document, document),
          isNull(riPeople.deletedAt),
        ),
      )
      .limit(1);
    if (same) throw new RiError("Já há uma pessoa com este CPF/CNPJ.");
  }
  const id = await findOrCreatePersonWith(database, tenantSlug, who, actor);
  if (who.notes) {
    await database
      .update(riPeople)
      .set({ notes: who.notes.slice(0, 5000) })
      .where(eq(riPeople.id, id));
  }
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "ri.person-create",
    targetType: "ri-person",
    targetId: id,
  });
  return id;
}

export async function updatePersonWith(
  database: Database,
  tenantSlug: string,
  id: string,
  who: { name: string; document: string; notes: string },
  actor: Actor,
): Promise<number> {
  const row = await ownPerson(database, tenantSlug, id);
  if (row.deletedAt) throw new RiError("Esta pessoa está apagada.");
  const name = who.name.replace(/\s+/g, " ").trim().slice(0, 300);
  if (name.length < 2) throw new RiError("Escreva o nome da pessoa.");
  const after = {
    name,
    document: who.document.replace(/\D/g, "").slice(0, 14),
    notes: who.notes.trim().slice(0, 5000),
  };
  const changes = changesBetween(
    { name: row.name, document: row.document, notes: row.notes },
    after,
  );
  if (changes.length === 0) return 0;
  await database
    .update(riPeople)
    .set({
      ...after,
      updatedAt: new Date(),
      history: [
        ...((row.history as HistoryEntry[]) ?? []),
        { at: new Date().toISOString(), by: actor.id, changes },
      ],
    })
    .where(eq(riPeople.id, id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "ri.person-edit",
    targetType: "ri-person",
    targetId: id,
  });
  return changes.length;
}

export async function setPersonDeletedWith(
  database: Database,
  tenantSlug: string,
  id: string,
  deleted: boolean,
  actor: Actor,
): Promise<void> {
  const row = await ownPerson(database, tenantSlug, id);
  if (Boolean(row.deletedAt) === deleted) return;
  await database
    .update(riPeople)
    .set(
      deleted
        ? { deletedAt: new Date(), deletedBy: actor.id }
        : { deletedAt: null, deletedBy: null, updatedAt: new Date() },
    )
    .where(eq(riPeople.id, id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: deleted ? "ri.person-delete" : "ri.person-restore",
    targetType: "ri-person",
    targetId: id,
  });
}

// ------------------------------------------------------------------ atos

export interface ActPartyInput {
  personId?: string;
  name: string;
  document: string;
  role: PartyRole;
  share: string;
}

export interface ActInput {
  kind: "R" | "AV";
  effect: ActEffect;
  nature: string;
  registeredOn: string | null;
  summary: string;
  cancelsActId: string | null;
  protocol: string;
  seal: string;
  valueCents: number | null;
  parties: ActPartyInput[];
}

const EFFECTS = Object.keys(ROLES_BY_EFFECT) as ActEffect[];

export function readActInput(raw: {
  kind: string;
  effect: string;
  nature: string;
  registeredOn: string;
  summary: string;
  cancelsActId: string;
  protocol: string;
  seal: string;
  value: string;
  parties: ActPartyInput[];
}): ActInput {
  const kind = raw.kind === "AV" ? "AV" : raw.kind === "R" ? "R" : null;
  if (!kind) throw new RiError("Escolha se é registro (R) ou averbação (AV).");
  const effect = EFFECTS.find((e) => e === raw.effect);
  if (!effect) throw new RiError("Escolha o que o ato faz na matrícula.");
  const nature = raw.nature.replace(/\s+/g, " ").trim().slice(0, 200);
  if (nature.length < 2) throw new RiError("Escreva a natureza do ato.");
  const registeredOn = isoDate(raw.registeredOn);
  if (raw.registeredOn.trim() && !registeredOn) {
    throw new RiError("A data do ato não é uma data válida.");
  }
  const cents = raw.value.trim()
    ? Math.round(
        Number(
          raw.value
            .replace(/[^\d,.-]/g, "")
            .replace(/\./g, "")
            .replace(",", "."),
        ) * 100,
      )
    : null;
  if (cents !== null && (!Number.isFinite(cents) || cents < 0)) {
    throw new RiError("O valor do ato não é um valor válido.");
  }
  const allowed = new Set(ROLES_BY_EFFECT[effect]);
  const parties = raw.parties
    .map((p) => ({
      ...p,
      name: p.name.replace(/\s+/g, " ").trim(),
      document: p.document.replace(/\D/g, ""),
      share: p.share.trim().slice(0, 40),
    }))
    .filter((p) => p.name || p.personId);
  for (const p of parties) {
    if (!allowed.has(p.role)) {
      throw new RiError("Uma das partes está num papel que este ato não tem.");
    }
  }
  if (
    effect === "transmissao" &&
    !parties.some((p) => p.role === "adquirente")
  ) {
    throw new RiError("Informe quem adquire o imóvel.");
  }
  if (effect === "titularidade" && !parties.some((p) => p.role === "titular")) {
    throw new RiError("Informe os proprietários.");
  }
  if (effect === "cancelamento" && !UUID.test(raw.cancelsActId)) {
    throw new RiError("Escolha o ônus que este ato cancela.");
  }
  return {
    kind,
    effect,
    nature,
    registeredOn,
    summary: raw.summary.replace(/\r\n?/g, "\n").trim().slice(0, 5000),
    cancelsActId: effect === "cancelamento" ? raw.cancelsActId : null,
    protocol: raw.protocol.trim().slice(0, 60),
    seal: raw.seal.trim().slice(0, 120),
    valueCents: cents,
    parties,
  };
}

async function partyIds(
  database: Database,
  tenantSlug: string,
  parties: ActPartyInput[],
  actor: Actor,
) {
  const out: { personId: string; role: PartyRole; share: string }[] = [];
  for (const p of parties) {
    const personId =
      p.personId && UUID.test(p.personId)
        ? (await ownPerson(database, tenantSlug, p.personId)).id
        : await findOrCreatePersonWith(database, tenantSlug, p, actor);
    out.push({ personId, role: p.role, share: p.share });
  }
  return out;
}

async function checkCancels(
  database: Database,
  tenantSlug: string,
  propertyId: string,
  input: ActInput,
  self?: string,
) {
  if (input.effect !== "cancelamento" || !input.cancelsActId) return;
  const acervo = await loadAcervoWith(database, tenantSlug);
  const acts = (acervo.acts.get(propertyId) ?? []).filter((a) => a.id !== self);
  const target = acts.find((a) => a.id === input.cancelsActId);
  if (!target || target.effect !== "onus") {
    throw new RiError("O ato escolhido não é um ônus desta matrícula.");
  }
  const still = situationOf(acts).burdens.some((b) => b.actId === target.id);
  if (!still) throw new RiError("Esse ônus já foi cancelado por outro ato.");
}

/** A new R or AV, numbered after every lançamento ever made on it. */
export async function createActWith(
  database: Database,
  tenantSlug: string,
  propertyId: string,
  input: ActInput,
  actor: Actor,
): Promise<{ id: string; seq: number }> {
  const property = await ownProperty(database, tenantSlug, propertyId);
  if (property.deletedAt) throw new RiError("Esta matrícula está apagada.");
  await checkCancels(database, tenantSlug, propertyId, input);
  return database.transaction(async (tx) => {
    const t = tx as unknown as Database;
    const [top] = await t
      .select({ seq: max(riActs.seq) })
      .from(riActs)
      .where(eq(riActs.propertyId, propertyId));
    const seq = nextSeq([{ seq: top?.seq ?? 0 }], property.priorActs);
    const [row] = await t
      .insert(riActs)
      .values({
        tenantSlug,
        propertyId,
        kind: input.kind,
        seq,
        effect: input.effect,
        nature: input.nature,
        registeredOn: input.registeredOn,
        summary: input.summary,
        cancelsActId: input.cancelsActId,
        protocol: input.protocol,
        seal: input.seal,
        valueCents: input.valueCents,
        createdBy: actor.id,
      })
      .returning({ id: riActs.id });
    const id = row?.id as string;
    for (const p of await partyIds(t, tenantSlug, input.parties, actor)) {
      await t.insert(riActParties).values({ tenantSlug, actId: id, ...p });
    }
    await t
      .update(riProperties)
      .set({ updatedAt: new Date() })
      .where(eq(riProperties.id, propertyId));
    await recordAuditWith(t, {
      tenantSlug,
      actorId: actor.id,
      action: "ri.act-create",
      targetType: "ri-property",
      targetId: propertyId,
    });
    return { id, seq };
  });
}

async function ownAct(database: Database, tenantSlug: string, id: string) {
  if (!UUID.test(id)) throw new RiError("Ato não encontrado.");
  const [row] = await database
    .select()
    .from(riActs)
    .where(and(eq(riActs.tenantSlug, tenantSlug), eq(riActs.id, id)))
    .limit(1);
  if (!row) throw new RiError("Ato não encontrado.");
  return row;
}

/** Changes a lançamento (not its number), keeping what it had. */
export async function updateActWith(
  database: Database,
  tenantSlug: string,
  id: string,
  input: ActInput,
  actor: Actor,
): Promise<number> {
  const row = await ownAct(database, tenantSlug, id);
  if (row.deletedAt) throw new RiError("Este ato está apagado.");
  if (row.kind === "M" && input.effect !== "titularidade") {
    throw new RiError("A situação na migração só define os proprietários.");
  }
  await checkCancels(database, tenantSlug, row.propertyId, input, id);
  const current = await database
    .select()
    .from(riActParties)
    .where(and(eq(riActParties.actId, id), isNull(riActParties.removedAt)));
  const wanted = await partyIds(database, tenantSlug, input.parties, actor);
  const key = (p: { personId: string; role: string; share: string }) =>
    `${p.personId}|${p.role}|${p.share}`;
  const wantedKeys = new Set(wanted.map(key));
  const currentKeys = new Set(current.map(key));
  const after = {
    kind: row.kind === "M" ? "M" : input.kind,
    effect: input.effect,
    nature: row.kind === "M" ? row.nature : input.nature,
    registeredOn: input.registeredOn,
    summary: input.summary,
    cancelsActId: input.cancelsActId,
    protocol: input.protocol,
    seal: input.seal,
    valueCents: input.valueCents,
  };
  const changes = changesBetween(
    {
      kind: row.kind,
      effect: row.effect,
      nature: row.nature,
      registeredOn: row.registeredOn,
      summary: row.summary,
      cancelsActId: row.cancelsActId,
      protocol: row.protocol,
      seal: row.seal,
      valueCents: row.valueCents,
    },
    after,
  );
  const partiesChanged =
    wantedKeys.size !== currentKeys.size ||
    [...wantedKeys].some((k) => !currentKeys.has(k));
  if (partiesChanged) {
    changes.push({
      field: "parties",
      before: current.map(key),
      after: wanted.map(key),
    });
  }
  if (changes.length === 0) return 0;
  await database.transaction(async (tx) => {
    const t = tx as unknown as Database;
    await t
      .update(riActs)
      .set({
        ...after,
        updatedAt: new Date(),
        history: [
          ...((row.history as HistoryEntry[]) ?? []),
          { at: new Date().toISOString(), by: actor.id, changes },
        ],
      })
      .where(eq(riActs.id, id));
    if (partiesChanged) {
      for (const p of current) {
        if (!wantedKeys.has(key(p))) {
          await t
            .update(riActParties)
            .set({ removedAt: new Date(), removedBy: actor.id })
            .where(eq(riActParties.id, p.id));
        }
      }
      for (const p of wanted) {
        if (!currentKeys.has(key(p))) {
          await t.insert(riActParties).values({ tenantSlug, actId: id, ...p });
        }
      }
    }
    await t
      .update(riProperties)
      .set({ updatedAt: new Date() })
      .where(eq(riProperties.id, row.propertyId));
    await recordAuditWith(t, {
      tenantSlug,
      actorId: actor.id,
      action: "ri.act-edit",
      targetType: "ri-property",
      targetId: row.propertyId,
    });
  });
  return changes.length;
}

/** "Apagar" a lançamento: it leaves the situação; its number is not reused. */
export async function setActDeletedWith(
  database: Database,
  tenantSlug: string,
  id: string,
  deleted: boolean,
  actor: Actor,
): Promise<string> {
  const row = await ownAct(database, tenantSlug, id);
  if (Boolean(row.deletedAt) !== deleted) {
    await database
      .update(riActs)
      .set(
        deleted
          ? { deletedAt: new Date(), deletedBy: actor.id }
          : { deletedAt: null, deletedBy: null, updatedAt: new Date() },
      )
      .where(eq(riActs.id, id));
    await database
      .update(riProperties)
      .set({ updatedAt: new Date() })
      .where(eq(riProperties.id, row.propertyId));
    await recordAuditWith(database, {
      tenantSlug,
      actorId: actor.id,
      action: deleted ? "ri.act-delete" : "ri.act-restore",
      targetType: "ri-property",
      targetId: row.propertyId,
    });
  }
  return row.propertyId;
}

// -------------------------------------------------------------- import

export interface ImportResult {
  created: number;
  skipped: { line: number; reason: string }[];
}

/**
 * The rows of the office's index, after the conferência. A number already
 * in the system is left out (importing the same sheet twice changes
 * nothing); two rows with the same number in the sheet both come in, as
 * the pendência of art. 338 they are.
 */
export async function importSheetWith(
  database: Database,
  tenantSlug: string,
  rows: SheetRow[],
  actor: Actor,
): Promise<ImportResult> {
  const existing = await database
    .select({
      book: riProperties.book,
      number: riProperties.number,
      recordKind: riProperties.recordKind,
    })
    .from(riProperties)
    .where(
      and(
        eq(riProperties.tenantSlug, tenantSlug),
        isNull(riProperties.deletedAt),
      ),
    );
  const key = (p: { book: number; number: number; recordKind: number }) =>
    `${p.recordKind === 4 ? "T" : p.book}:${p.number}`;
  const have = new Set(existing.map(key));
  const result: ImportResult = { created: 0, skipped: [] };
  for (const row of rows) {
    if (have.has(key(row.input))) {
      result.skipped.push({
        line: row.line,
        reason: `a ${row.input.recordKind === 4 ? "transcrição" : "matrícula"} ${row.input.number.toLocaleString("pt-BR")} já está no sistema`,
      });
      continue;
    }
    await createPropertyWith(database, tenantSlug, row.input, actor, {
      source: "planilha",
      owners: row.owners,
    });
    result.created++;
  }
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "ri.import",
    targetType: "ri-property",
    targetId: null,
  });
  return result;
}

// --------------------------------------------------------------- exports

export type ExportKind = "cnm" | "indicador-real" | "indicador-pessoal";

export const EXPORT_LABELS: Record<ExportKind, string> = {
  cnm: "Lote de CNM (PGV-CNM)",
  "indicador-real": "Indicador Real (Livro 4)",
  "indicador-pessoal": "Indicador Pessoal (Livro 5)",
};

export interface Office {
  slug: string;
  cns: string;
  state: string;
}

/** aaaammdd-hhmm in the office's zone, for the file name. */
function stamp(date: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: OFFICE_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}`;
}

/** Builds one file for the ONR from the acervo as it is now, and keeps it. */
export async function generateExportWith(
  database: Database,
  office: Office,
  kind: ExportKind,
  mode: RealMode,
  actor: Actor,
  now = new Date(),
): Promise<{ id: string; count: number; skipped: Skipped[] }> {
  const cns = cnsDigits(office.cns);
  if (!cns) throw new RiError("O CNS da serventia não está cadastrado.");
  const acervo = await loadAcervoWith(database, office.slug);
  let content: string;
  let count: number;
  let skipped: Skipped[];
  let fileName: string;
  let note = "";
  if (kind === "cnm") {
    const batch = cnmBatch(cns, acervo.properties);
    ({ count, skipped } = batch);
    content = batch.xml;
    fileName = `lote-cnm-${cns}-${stamp(now)}.xml`;
    if (batch.usesClosedSituations) {
      note =
        "O lote tem matrículas encerradas, canceladas ou inexistentes. Na primeira vez, o ONR recomenda testar com um lote pequeno.";
    }
  } else if (kind === "indicador-real") {
    const { ibgeCity } = await riSettingsWith(database, office.slug);
    let properties = acervo.properties;
    if (mode === "atualizacao") {
      const [last] = await database
        .select({ at: riExports.createdAt })
        .from(riExports)
        .where(
          and(
            eq(riExports.tenantSlug, office.slug),
            eq(riExports.kind, "indicador-real"),
            isNull(riExports.withdrawnAt),
          ),
        )
        .orderBy(desc(riExports.createdAt))
        .limit(1);
      if (last) properties = properties.filter((p) => p.updatedAt > last.at);
    }
    try {
      const out = indicadorReal(
        { cns, state: office.state, ibgeCity },
        properties,
        mode,
      );
      ({ count, skipped } = out);
      content = out.json;
    } catch (error) {
      throw new RiError((error as Error).message);
    }
    fileName = `indicador-real-${cns}-${stamp(now)}.json`;
  } else {
    const out = indicadorPessoal(
      acervo.properties.map((p) => ({
        number: p.number,
        status: p.status,
        openedOn: p.openedOn,
        acts: acervo.acts.get(p.id) ?? [],
      })),
    );
    ({ count, skipped } = out);
    content = out.xml;
    fileName = `indicador-pessoal-${cns}-${stamp(now)}.xml`;
  }
  if (count === 0) {
    throw new RiError(
      skipped.length
        ? "Nenhuma linha pôde entrar no arquivo: resolva as pendências listadas."
        : "Não há nada para enviar neste arquivo.",
    );
  }
  const [row] = await database
    .insert(riExports)
    .values({
      tenantSlug: office.slug,
      kind,
      mode: kind === "indicador-real" ? mode : "",
      fileName,
      content,
      recordCount: count,
      skipped,
      sha256: createHash("sha256").update(content).digest("hex"),
      note,
      createdBy: actor.id,
    })
    .returning({ id: riExports.id });
  await recordAuditWith(database, {
    tenantSlug: office.slug,
    actorId: actor.id,
    action: "ri.export",
    targetType: "ri-export",
    targetId: row?.id ?? null,
  });
  return { id: row?.id as string, count, skipped };
}

export async function listExportsWith(database: Database, tenantSlug: string) {
  return database
    .select({
      id: riExports.id,
      kind: riExports.kind,
      mode: riExports.mode,
      fileName: riExports.fileName,
      recordCount: riExports.recordCount,
      skipped: riExports.skipped,
      sha256: riExports.sha256,
      note: riExports.note,
      importedAt: riExports.importedAt,
      createdAt: riExports.createdAt,
      createdBy: riExports.createdBy,
      withdrawnAt: riExports.withdrawnAt,
    })
    .from(riExports)
    .where(eq(riExports.tenantSlug, tenantSlug))
    .orderBy(desc(riExports.createdAt));
}

export async function exportFileWith(
  database: Database,
  tenantSlug: string,
  id: string,
) {
  if (!UUID.test(id)) return null;
  const [row] = await database
    .select()
    .from(riExports)
    .where(and(eq(riExports.tenantSlug, tenantSlug), eq(riExports.id, id)))
    .limit(1);
  return row ?? null;
}

/**
 * "Já importei no ONR": records it and, for a lote of CNM, marks the
 * numbers it carried as already in the PGV, with the CNM it had.
 */
export async function markExportImportedWith(
  database: Database,
  tenantSlug: string,
  id: string,
  imported: boolean,
  actor: Actor,
): Promise<void> {
  const row = await exportFileWith(database, tenantSlug, id);
  if (!row || row.withdrawnAt) throw new RiError("Arquivo não encontrado.");
  await database
    .update(riExports)
    .set(
      imported
        ? { importedAt: new Date(), importedBy: actor.id }
        : { importedAt: null, importedBy: null },
    )
    .where(eq(riExports.id, id));
  if (row.kind === "cnm") {
    const pairs = [
      ...row.content.matchAll(/<NUM>(\d+)<\/NUM><CNM>([^<]+)<\/CNM>/g),
    ].map((m) => ({ number: Number(m[1]), cnm: m[2] as string }));
    for (const pair of pairs) {
      const [target] = await database
        .select()
        .from(riProperties)
        .where(
          and(
            eq(riProperties.tenantSlug, tenantSlug),
            eq(riProperties.book, 2),
            eq(riProperties.number, pair.number),
            isNull(riProperties.deletedAt),
          ),
        )
        .limit(2);
      if (!target || target.recordKind === 4) continue;
      await database
        .update(riProperties)
        .set({
          cnmInPgv: imported,
          cnm: imported && !target.cnm ? pair.cnm : target.cnm,
          updatedAt: new Date(),
        })
        .where(eq(riProperties.id, target.id));
    }
  }
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: imported ? "ri.export-imported" : "ri.export-not-imported",
    targetType: "ri-export",
    targetId: id,
  });
}

export async function withdrawExportWith(
  database: Database,
  tenantSlug: string,
  id: string,
  actor: Actor,
): Promise<void> {
  const row = await exportFileWith(database, tenantSlug, id);
  if (!row) throw new RiError("Arquivo não encontrado.");
  if (row.withdrawnAt) return;
  await database
    .update(riExports)
    .set({ withdrawnAt: new Date(), withdrawnBy: actor.id })
    .where(eq(riExports.id, id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "ri.export-delete",
    targetType: "ri-export",
    targetId: id,
  });
}
