import "server-only";
import { and, desc, eq, inArray, isNull, max } from "drizzle-orm";
import { deadlineDate } from "@/core/request/deadline.ts";
import { isoDate, matriculaNumber } from "@/core/ri/property.ts";
import {
  deadlinesFor,
  nextProtocolNumber,
  OPEN_STATUSES,
  PROTOCOL_STATUS_LABELS,
  type ProtocolKind,
  type ProtocolStatus,
  type Requirement,
} from "@/core/ri/protocol.ts";
import type { OfficeHolidays } from "@/core/scheduling/calendar.ts";
import { toIsoDate } from "@/core/scheduling/calendar.ts";
import { OFFICE_TIME_ZONE } from "@/core/time/office-time.ts";
import type { Database } from "@/db/index.ts";
import {
  riActs,
  riProperties,
  riProtocolDays,
  riProtocols,
} from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";
import { type Actor, RiError } from "./ri.ts";

/**
 * The Protocolo (Livro 1) of the Registro de Imóveis (change
 * registro-de-imoveis-protocolo): every título gets its order number when
 * presented, which fixes its priority (Lei nº 6.015/1973, arts. 174, 175,
 * 182 and 186); the prazos run in dias úteis (art. 9º, § 1º; arts. 188 and
 * 205); the nota devolutiva lists every exigência at once (art. 198). An
 * entry of the Livro 1 is never deleted: "apagar" marks it as lançado por
 * engano, with the reason, and it can be restored. Every change keeps what
 * it replaced.
 */

export type ProtocolRow = typeof riProtocols.$inferSelect;

export interface ProtocolHistoryEntry {
  at: string;
  by: string;
  what: string;
  reason?: string;
  changes?: { field: string; before: unknown; after: unknown }[];
}

export interface ProtocolInput {
  kind: ProtocolKind;
  presentedOn: string;
  presenterName: string;
  presenterDocument: string;
  presenterContact: string;
  titleKind: string;
  actsSummary: string;
  /** Matrícula numbers as written ("1.234; 1.235"). */
  matriculas: string;
  fast: boolean;
  reurb: boolean;
  fees: string;
  feeCents: number | null;
  notes: string;
}

const UUID = /^[0-9a-f-]{36}$/i;

const clean = (value: unknown, max = 300) =>
  String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, max);

/** Today in the office's zone (aaaa-mm-dd). */
export function officeToday(now = new Date()): string {
  return toIsoDate(now, OFFICE_TIME_ZONE);
}

/** The form, checked. Throws RiError with what the screen shows. */
export function readProtocolInput(
  raw: Record<string, unknown>,
  today = officeToday(),
): ProtocolInput {
  const kind: ProtocolKind = raw.kind === "exame" ? "exame" : "prenotacao";
  const presentedRaw = clean(raw.presentedOn, 20);
  const presentedOn = presentedRaw ? isoDate(presentedRaw) : today;
  if (!presentedOn) {
    throw new RiError("A data de apresentação não é uma data válida.");
  }
  if (presentedOn > today) {
    throw new RiError("A data de apresentação não pode ser depois de hoje.");
  }
  const presenterName = clean(raw.presenterName).replace(/\s+/g, " ");
  if (presenterName.length < 3) {
    throw new RiError("Informe o nome de quem apresenta o título.");
  }
  const titleKind = clean(raw.titleKind, 200);
  if (titleKind.length < 3) throw new RiError("Informe a natureza do título.");
  const feeText = clean(raw.feeValue, 30).replace(/[^\d,.-]/g, "");
  const feeCents = feeText
    ? Math.round(
        Number(
          feeText.includes(",")
            ? feeText.replace(/\./g, "").replace(",", ".")
            : feeText,
        ) * 100,
      )
    : null;
  if (feeCents !== null && (!Number.isFinite(feeCents) || feeCents < 0)) {
    throw new RiError("O valor dos emolumentos não é um valor válido.");
  }
  return {
    kind,
    presentedOn,
    presenterName,
    presenterDocument: clean(raw.presenterDocument, 30)
      .replace(/\D/g, "")
      .slice(0, 14),
    presenterContact: clean(raw.presenterContact, 200),
    titleKind,
    actsSummary: clean(raw.actsSummary, 2000),
    matriculas: clean(raw.matriculas, 300),
    fast: raw.fast === "on" || raw.fast === true || raw.fast === "1",
    reurb: raw.reurb === "on" || raw.reurb === true || raw.reurb === "1",
    fees: clean(raw.fees, 1000),
    feeCents,
    notes: clean(raw.notes, 5000),
  };
}

/** The ids of the matrículas written, and the numbers not found. */
async function propertyIdsFor(
  database: Database,
  tenantSlug: string,
  written: string,
): Promise<{ ids: string[]; missing: string[] }> {
  const numbers = written
    .split(/[;,\n]+/)
    .map((n) => n.trim())
    .filter(Boolean);
  if (numbers.length === 0) return { ids: [], missing: [] };
  const wanted = numbers
    .map((n) => matriculaNumber(n))
    .filter((n): n is number => n !== null);
  const rows = wanted.length
    ? await database
        .select({ id: riProperties.id, number: riProperties.number })
        .from(riProperties)
        .where(
          and(
            eq(riProperties.tenantSlug, tenantSlug),
            eq(riProperties.book, 2),
            isNull(riProperties.deletedAt),
            inArray(riProperties.number, wanted),
          ),
        )
    : [];
  const found = new Set(rows.map((r) => r.number));
  return {
    ids: rows.map((r) => r.id),
    missing: numbers.filter((n) => {
      const num = matriculaNumber(n);
      return num === null || !found.has(num);
    }),
  };
}

function deadlinesOf(input: ProtocolInput, holidays: OfficeHolidays) {
  // Exame e cálculo is not a prenotação (art. 12, parágrafo único).
  if (input.kind === "exame") return { qualifyBy: null, prenotationEnds: null };
  return deadlinesFor(
    input.presentedOn,
    { fast: input.fast, reurb: input.reurb },
    holidays,
  );
}

/** Lança the título in the Livro 1 with the next order number. */
/**
 * A day of the Protocolo already closed takes no prenotação (art. 184):
 * reopen it, with the reason, in Protocolo › Encerramento dos dias.
 */
async function assertDayOpen(
  database: Database,
  tenantSlug: string,
  input: Pick<ProtocolInput, "kind" | "presentedOn">,
) {
  if (input.kind !== "prenotacao") return;
  const [closed] = await database
    .select({ id: riProtocolDays.id })
    .from(riProtocolDays)
    .where(
      and(
        eq(riProtocolDays.tenantSlug, tenantSlug),
        eq(riProtocolDays.day, input.presentedOn),
        isNull(riProtocolDays.reopenedAt),
      ),
    )
    .limit(1);
  if (closed) {
    const d = input.presentedOn;
    throw new RiError(
      `O Protocolo do dia ${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)} já foi encerrado. Para prenotar nele, reabra o dia em Protocolo › Encerramento dos dias, com a justificativa.`,
    );
  }
}

export async function createProtocolWith(
  database: Database,
  tenantSlug: string,
  input: ProtocolInput,
  holidays: OfficeHolidays,
  actor: Actor,
): Promise<{ id: string; number: number; missing: string[] }> {
  await assertDayOpen(database, tenantSlug, input);
  const { ids, missing } = await propertyIdsFor(
    database,
    tenantSlug,
    input.matriculas,
  );
  const { qualifyBy, prenotationEnds } = deadlinesOf(input, holidays);
  return database.transaction(async (tx) => {
    const t = tx as unknown as Database;
    const [top] = await t
      .select({ number: max(riProtocols.number) })
      .from(riProtocols)
      .where(
        and(
          eq(riProtocols.tenantSlug, tenantSlug),
          eq(riProtocols.kind, input.kind),
        ),
      );
    const number = nextProtocolNumber([top?.number ?? 0]);
    const [row] = await t
      .insert(riProtocols)
      .values({
        tenantSlug,
        kind: input.kind,
        number,
        presentedOn: input.presentedOn,
        presenterName: input.presenterName,
        presenterDocument: input.presenterDocument,
        presenterContact: input.presenterContact,
        titleKind: input.titleKind,
        actsSummary: input.actsSummary,
        propertyIds: ids,
        fast: input.fast,
        reurb: input.reurb,
        qualifyBy,
        prenotationEnds,
        status: "prenotado",
        fees: input.fees,
        feeCents: input.feeCents,
        notes: input.notes,
        createdBy: actor.id,
        history: [
          {
            at: new Date().toISOString(),
            by: actor.id,
            what:
              input.kind === "exame"
                ? `Exame e cálculo nº ${number} lançado`
                : `Protocolo nº ${number} lançado (prenotação)`,
          },
        ],
      })
      .returning({ id: riProtocols.id });
    await recordAuditWith(t, {
      tenantSlug,
      actorId: actor.id,
      action: "ri.protocol-create",
      targetType: "ri-protocol",
      targetId: row?.id ?? null,
    });
    return { id: row?.id as string, number, missing };
  });
}

export async function protocolWith(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<ProtocolRow | null> {
  if (!UUID.test(id)) return null;
  const [row] = await database
    .select()
    .from(riProtocols)
    .where(and(eq(riProtocols.tenantSlug, tenantSlug), eq(riProtocols.id, id)))
    .limit(1);
  return row ?? null;
}

async function ownProtocol(database: Database, tenantSlug: string, id: string) {
  const row = await protocolWith(database, tenantSlug, id);
  if (!row) throw new RiError("Protocolo não encontrado.");
  return row;
}

export async function listProtocolsWith(
  database: Database,
  tenantSlug: string,
  options: { open?: boolean; voided?: boolean } = {},
): Promise<ProtocolRow[]> {
  const rows = await database
    .select()
    .from(riProtocols)
    .where(eq(riProtocols.tenantSlug, tenantSlug))
    .orderBy(desc(riProtocols.kind), desc(riProtocols.number));
  return rows
    .filter((r) => (options.voided ? Boolean(r.voidedAt) : !r.voidedAt))
    .filter(
      (r) =>
        !options.open ||
        (OPEN_STATUSES as readonly string[]).includes(r.status),
    );
}

const historyOf = (row: ProtocolRow) =>
  (row.history as ProtocolHistoryEntry[] | null) ?? [];

async function saveHistory(
  database: Database,
  row: ProtocolRow,
  set: Partial<typeof riProtocols.$inferInsert>,
  entry: ProtocolHistoryEntry,
) {
  await database
    .update(riProtocols)
    .set({
      ...set,
      updatedAt: new Date(),
      history: [...historyOf(row), entry],
    })
    .where(eq(riProtocols.id, row.id));
}

/** Changes the data of the entry, keeping what it had. */
export async function updateProtocolWith(
  database: Database,
  tenantSlug: string,
  id: string,
  input: ProtocolInput,
  holidays: OfficeHolidays,
  actor: Actor,
): Promise<{ changed: number; missing: string[] }> {
  const row = await ownProtocol(database, tenantSlug, id);
  if (row.voidedAt) throw new RiError("Este protocolo está apagado.");
  if (row.kind !== input.kind) {
    throw new RiError(
      "Prenotação e exame e cálculo têm numeração própria: lance um novo protocolo.",
    );
  }
  if (input.presentedOn !== row.presentedOn) {
    await assertDayOpen(database, tenantSlug, input);
  }
  const { ids, missing } = await propertyIdsFor(
    database,
    tenantSlug,
    input.matriculas,
  );
  const { qualifyBy, prenotationEnds } = deadlinesOf(input, holidays);
  const after = {
    presentedOn: input.presentedOn,
    presenterName: input.presenterName,
    presenterDocument: input.presenterDocument,
    presenterContact: input.presenterContact,
    titleKind: input.titleKind,
    actsSummary: input.actsSummary,
    propertyIds: ids,
    fast: input.fast,
    reurb: input.reurb,
    // A reingresso already set its own prazo (art. 188, § 1º, III).
    qualifyBy: row.reentryOn ? row.qualifyBy : qualifyBy,
    prenotationEnds,
    fees: input.fees,
    feeCents: input.feeCents,
    notes: input.notes,
  };
  const before: Record<string, unknown> = row;
  const changes = Object.entries(after)
    .filter(
      ([field, value]) =>
        JSON.stringify(before[field] ?? null) !== JSON.stringify(value ?? null),
    )
    .map(([field, value]) => ({
      field,
      before: before[field] ?? null,
      after: value ?? null,
    }));
  if (changes.length > 0) {
    await saveHistory(database, row, after, {
      at: new Date().toISOString(),
      by: actor.id,
      what: "Dados do protocolo alterados",
      changes,
    });
    await recordAuditWith(database, {
      tenantSlug,
      actorId: actor.id,
      action: "ri.protocol-edit",
      targetType: "ri-protocol",
      targetId: id,
    });
  }
  return { changed: changes.length, missing };
}

/** "texto | fonte" per line → the exigências. */
export function readRequirements(text: string): Requirement[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 40)
    .map((line) => {
      const [first = "", ...rest] = line.split("|");
      return {
        text: first
          .replace(/^\d+[.)]\s*/, "")
          .trim()
          .slice(0, 1000),
        source: rest.join("|").trim().slice(0, 300),
      };
    })
    .filter((r) => r.text.length > 2);
}

/** The nota devolutiva: every exigência at once (art. 198). */
export async function issueRequirementsWith(
  database: Database,
  tenantSlug: string,
  id: string,
  requirements: Requirement[],
  actor: Actor,
): Promise<void> {
  const row = await ownProtocol(database, tenantSlug, id);
  if (row.voidedAt) throw new RiError("Este protocolo está apagado.");
  if (requirements.length === 0) {
    throw new RiError("Escreva ao menos uma exigência.");
  }
  if (row.status === "registrado") {
    throw new RiError("O título já foi registrado.");
  }
  const previous = (row.requirements as Requirement[]) ?? [];
  await saveHistory(
    database,
    row,
    {
      status: row.kind === "exame" ? row.status : "exigencia",
      requirements,
      requirementIssuedAt: new Date(),
      requirementIssuedBy: actor.id,
    },
    {
      at: new Date().toISOString(),
      by: actor.id,
      what:
        previous.length > 0
          ? "Nota devolutiva refeita"
          : "Nota devolutiva emitida",
      changes:
        previous.length > 0
          ? [{ field: "requirements", before: previous, after: requirements }]
          : undefined,
    },
  );
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "ri.protocol-requirements",
    targetType: "ri-protocol",
    targetId: id,
  });
}

/**
 * The título comes back with the exigências met, within the prenotação:
 * the registro is due in 5 dias úteis (art. 188, § 1º, III).
 */
export async function reentryWith(
  database: Database,
  tenantSlug: string,
  id: string,
  on: string,
  holidays: OfficeHolidays,
  actor: Actor,
): Promise<void> {
  const row = await ownProtocol(database, tenantSlug, id);
  if (row.voidedAt) throw new RiError("Este protocolo está apagado.");
  if (row.status !== "exigencia") {
    throw new RiError("O reingresso é para o título que está em exigência.");
  }
  const date = isoDate(on);
  if (!date) throw new RiError("A data do reingresso não é uma data válida.");
  if (row.prenotationEnds && date > row.prenotationEnds) {
    throw new RiError(
      "A prenotação já tinha cessado nessa data (art. 205): o título precisa de novo protocolo.",
    );
  }
  await saveHistory(
    database,
    row,
    {
      status: "prenotado",
      reentryOn: date,
      qualifyBy: deadlineDate(date, 5, holidays),
    },
    {
      at: new Date().toISOString(),
      by: actor.id,
      what: "Reingresso com as exigências cumpridas",
    },
  );
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "ri.protocol-reentry",
    targetType: "ri-protocol",
    targetId: id,
  });
}

const MANUAL: readonly ProtocolStatus[] = [
  "prenotado",
  "exigencia",
  "cessado",
  "desistencia",
  "duvida",
  "exame-concluido",
];

/** Desistência, cessação, dúvida, exame concluído or reopening, with why. */
export async function setProtocolStatusWith(
  database: Database,
  tenantSlug: string,
  id: string,
  status: string,
  reason: string,
  actor: Actor,
): Promise<void> {
  const row = await ownProtocol(database, tenantSlug, id);
  if (row.voidedAt) throw new RiError("Este protocolo está apagado.");
  const next = MANUAL.find((s) => s === status);
  if (!next) throw new RiError("Escolha a nova situação.");
  if (next === row.status) return;
  if (row.status === "registrado") {
    throw new RiError(
      "O título já foi registrado: para desfazer, apague o ato na matrícula.",
    );
  }
  if (next === "exame-concluido" && row.kind !== "exame") {
    throw new RiError("Só o protocolo de exame e cálculo se conclui assim.");
  }
  const why = reason.trim();
  if (why.length < 3) throw new RiError("Escreva o motivo.");
  await saveHistory(
    database,
    row,
    { status: next },
    {
      at: new Date().toISOString(),
      by: actor.id,
      what: `Situação: ${PROTOCOL_STATUS_LABELS[row.status as ProtocolStatus] ?? row.status} → ${PROTOCOL_STATUS_LABELS[next]}`,
      reason: why.slice(0, 1000),
    },
  );
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "ri.protocol-status",
    targetType: "ri-protocol",
    targetId: id,
    reason: why.slice(0, 1000),
  });
}

/** The atos lançados with this protocolo's number. */
export async function protocolActsWith(
  database: Database,
  tenantSlug: string,
  row: Pick<ProtocolRow, "kind" | "number">,
) {
  if (row.kind !== "prenotacao") return [];
  return database
    .select({
      id: riActs.id,
      propertyId: riActs.propertyId,
      kind: riActs.kind,
      seq: riActs.seq,
      nature: riActs.nature,
      seal: riActs.seal,
      number: riProperties.number,
    })
    .from(riActs)
    .innerJoin(riProperties, eq(riProperties.id, riActs.propertyId))
    .where(
      and(
        eq(riActs.tenantSlug, tenantSlug),
        eq(riActs.protocol, String(row.number)),
        isNull(riActs.deletedAt),
      ),
    );
}

/**
 * The título is registered: every ato lançado with its number has the selo
 * (the selo is informed by hand, decision of 25/11/2026).
 */
export async function registerProtocolWith(
  database: Database,
  tenantSlug: string,
  id: string,
  actor: Actor,
): Promise<void> {
  const row = await ownProtocol(database, tenantSlug, id);
  if (row.voidedAt) throw new RiError("Este protocolo está apagado.");
  if (row.kind !== "prenotacao") {
    throw new RiError("Exame e cálculo não gera registro (art. 12).");
  }
  if (row.status === "registrado") return;
  const acts = await protocolActsWith(database, tenantSlug, row);
  if (acts.length === 0) {
    throw new RiError(
      `Lance antes o ato na matrícula, com o protocolo nº ${row.number} e o selo.`,
    );
  }
  const noSeal = acts.filter((a) => !a.seal.trim());
  if (noSeal.length > 0) {
    throw new RiError(
      `Falta o selo em: ${noSeal.map((a) => `${a.kind}-${a.seq}-${a.number.toLocaleString("pt-BR")}`).join(", ")}.`,
    );
  }
  await saveHistory(
    database,
    row,
    { status: "registrado" },
    {
      at: new Date().toISOString(),
      by: actor.id,
      what: `Registrado: ${acts.map((a) => `${a.kind}-${a.seq}-${a.number.toLocaleString("pt-BR")}`).join(", ")}`,
    },
  );
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "ri.protocol-register",
    targetType: "ri-protocol",
    targetId: id,
  });
}

/** "Apagar": the entry stays in the Livro 1, marked, with the reason. */
export async function setProtocolVoidedWith(
  database: Database,
  tenantSlug: string,
  id: string,
  voided: boolean,
  reason: string,
  actor: Actor,
): Promise<void> {
  const row = await ownProtocol(database, tenantSlug, id);
  if (Boolean(row.voidedAt) === voided) return;
  const why = reason.trim();
  if (why.length < 3) throw new RiError("Escreva o motivo.");
  await saveHistory(
    database,
    row,
    voided
      ? { voidedAt: new Date(), voidedBy: actor.id }
      : { voidedAt: null, voidedBy: null },
    {
      at: new Date().toISOString(),
      by: actor.id,
      what: voided
        ? "Apagado (lançado por engano); o número não é usado de novo"
        : "Restaurado",
      reason: why.slice(0, 1000),
    },
  );
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: voided ? "ri.protocol-delete" : "ri.protocol-restore",
    targetType: "ri-protocol",
    targetId: id,
    reason: why.slice(0, 1000),
  });
}

export interface ProtocolCounters {
  open: number;
  qualifyLate: number;
  qualifyToday: number;
  prenotationEnding: number;
}

/** What the Mesa shows: open títulos and the prazos that need attention. */
export function countersOf(
  rows: readonly ProtocolRow[],
  today: string,
): ProtocolCounters {
  const open = rows.filter(
    (r) =>
      !r.voidedAt && (OPEN_STATUSES as readonly string[]).includes(r.status),
  );
  return {
    open: open.length,
    qualifyLate: open.filter(
      (r) => r.status === "prenotado" && r.qualifyBy && r.qualifyBy < today,
    ).length,
    qualifyToday: open.filter(
      (r) => r.status === "prenotado" && r.qualifyBy === today,
    ).length,
    prenotationEnding: open.filter(
      (r) =>
        r.status === "exigencia" &&
        r.prenotationEnds &&
        r.prenotationEnds <= today,
    ).length,
  };
}
