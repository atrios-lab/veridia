import "server-only";
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import {
  type CertidaoForm,
  certidaoModel,
  certidaoProblems,
  cleanCertidaoFields,
  formatMatricula,
  isCertidaoForm,
} from "@/core/rcpn/certidao.ts";
import {
  RCPN_KINDS,
  type RcpnKind,
  type RcpnRecord,
  type RcpnRole,
} from "@/core/rcpn/record.ts";
import { OFFICE_TIME_ZONE } from "@/core/time/office-time.ts";
import type { Database } from "@/db/index.ts";
import { rcpnCertidoes, rcpnPeople, rcpnRecords } from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";

/**
 * The certidões issued from the panel (decision of 14/11/2026): the office
 * pastes the selo of its TJRN lot while there is no caixa, prints or signs
 * digitally, attaches the signed copy, and corrects a typing error with a
 * justification. Nothing is deleted: an exclusion marks the row, with who,
 * when and why, and the audit keeps the act.
 */

export class CertidaoError extends Error {}

export type CertidaoRow = typeof rcpnCertidoes.$inferSelect;

export interface CertidaoInput {
  kind: RcpnKind;
  form: CertidaoForm;
  subtype: "" | "natimorto";
  recordId: string | null;
  fields: Record<string, unknown>;
  seal: string;
  sealKind: string;
  fees: string;
  signerName: string;
  signerTitle: string;
  /** The person checked the text against the book. */
  checked: boolean;
}

export const isRcpnKind = (value: unknown): value is RcpnKind =>
  (RCPN_KINDS as readonly unknown[]).includes(value);

const short = (value: string, max = 300) => value.trim().slice(0, max);

/** The clean values to store, or the reason they cannot be. */
function prepare(input: CertidaoInput) {
  if (!isRcpnKind(input.kind)) {
    throw new CertidaoError("Escolha o tipo de certidão.");
  }
  if (!input.checked) {
    throw new CertidaoError(
      "Confirme que conferiu o texto da certidão com o livro antes de emitir.",
    );
  }
  const form = isCertidaoForm(input.form) ? input.form : "breve";
  const fields = cleanCertidaoFields(input.kind, input.fields, form);
  const problems = certidaoProblems(input.kind, fields, form);
  if (problems.length > 0) throw new CertidaoError(problems.join(" "));
  return {
    kind: input.kind,
    form,
    subtype:
      input.kind === "obito" && input.subtype === "natimorto"
        ? "natimorto"
        : "",
    fields,
    seal: short(input.seal, 120),
    sealKind: short(input.sealKind, 60),
    fees: short(input.fees, 600),
    signerName: short(input.signerName, 200),
    signerTitle: short(input.signerTitle, 200),
  };
}

/**
 * One selo, one act: a selo already printed on another certidão (not
 * excluded) is refused, so the same code never goes on two documents.
 */
async function assertSealFree(
  database: Database,
  tenantSlug: string,
  seal: string,
  exceptId?: string,
): Promise<void> {
  if (!seal) return;
  const where = [
    eq(rcpnCertidoes.tenantSlug, tenantSlug),
    eq(rcpnCertidoes.seal, seal),
    isNull(rcpnCertidoes.removedAt),
  ];
  if (exceptId) where.push(ne(rcpnCertidoes.id, exceptId));
  const [used] = await database
    .select({ id: rcpnCertidoes.id, createdAt: rcpnCertidoes.createdAt })
    .from(rcpnCertidoes)
    .where(and(...where))
    .limit(1);
  if (used) {
    throw new CertidaoError(
      `Este selo já está em outra certidão, emitida em ${used.createdAt.toLocaleDateString("pt-BR", { timeZone: OFFICE_TIME_ZONE })}. Confira o lote e cole o selo seguinte.`,
    );
  }
}

/** A registro of the index with its people, for the form's first values. */
export async function getRecordWith(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<(RcpnRecord & { id: string }) | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await database
    .select()
    .from(rcpnRecords)
    .where(and(eq(rcpnRecords.tenantSlug, tenantSlug), eq(rcpnRecords.id, id)));
  if (!row) return null;
  const people = await database
    .select()
    .from(rcpnPeople)
    .where(eq(rcpnPeople.recordId, row.id));
  const order: RcpnRole[] = ["registrado", "conjuge1", "conjuge2", "falecido"];
  people.sort(
    (a, b) =>
      order.indexOf(a.role as RcpnRole) - order.indexOf(b.role as RcpnRole),
  );
  return {
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
    people: people.map((p) => ({
      role: p.role as RcpnRole,
      name: p.name,
      marriedName: p.marriedName,
      motherName: p.motherName,
      fatherName: p.fatherName,
      birthDate: p.birthDate,
      profession: p.profession,
      fatherProfession: p.fatherProfession,
      motherProfession: p.motherProfession,
    })),
  };
}

export async function issueCertidaoWith(
  database: Database,
  tenantSlug: string,
  input: CertidaoInput,
  actorId: string,
): Promise<string> {
  let recordId: string | null = null;
  let fields = input.fields;
  if (input.recordId) {
    const record = await getRecordWith(database, tenantSlug, input.recordId);
    if (!record || record.kind !== input.kind) {
      throw new CertidaoError("O registro escolhido não está no índice.");
    }
    recordId = record.id;
    // The matrícula is the registro's, never typed over (decision of
    // 14/11/2026: "tudo é editável, menos a matrícula").
    if (record.matricula) {
      fields = { ...fields, matricula: formatMatricula(record.matricula) };
    }
  }
  const values = prepare({ ...input, fields });
  await assertSealFree(database, tenantSlug, values.seal);
  const [row] = await database
    .insert(rcpnCertidoes)
    .values({ tenantSlug, recordId, ...values, createdBy: actorId })
    .returning({ id: rcpnCertidoes.id });
  if (!row) throw new CertidaoError("Não foi possível emitir agora.");
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "rcpn.certidao.issue",
    targetType: "rcpn-certidao",
    targetId: row.id,
  });
  return row.id;
}

export async function getCertidaoWith(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<CertidaoRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await database
    .select()
    .from(rcpnCertidoes)
    .where(
      and(
        eq(rcpnCertidoes.tenantSlug, tenantSlug),
        eq(rcpnCertidoes.id, id),
        isNull(rcpnCertidoes.removedAt),
      ),
    );
  return row ?? null;
}

export async function listCertidoesWith(
  database: Database,
  tenantSlug: string,
): Promise<CertidaoRow[]> {
  return database
    .select()
    .from(rcpnCertidoes)
    .where(
      and(
        eq(rcpnCertidoes.tenantSlug, tenantSlug),
        isNull(rcpnCertidoes.removedAt),
      ),
    )
    .orderBy(desc(rcpnCertidoes.createdAt))
    .limit(300);
}

async function mustExist(database: Database, tenantSlug: string, id: string) {
  const row = await getCertidaoWith(database, tenantSlug, id);
  if (!row) throw new CertidaoError("Certidão não encontrada.");
  return row;
}

/** A correction: same certidão, new text. The justification goes to the audit. */
export async function updateCertidaoWith(
  database: Database,
  tenantSlug: string,
  id: string,
  input: Omit<CertidaoInput, "recordId" | "kind" | "form">,
  actorId: string,
): Promise<void> {
  const current = await mustExist(database, tenantSlug, id);
  // A certidão of a registro keeps the matrícula it was issued with.
  const issued = (current.fields ?? {}) as Record<string, string>;
  const fields =
    current.recordId && issued.matricula
      ? { ...input.fields, matricula: issued.matricula }
      : input.fields;
  const values = prepare({
    ...input,
    fields,
    kind: current.kind as RcpnKind,
    form: isCertidaoForm(current.form) ? current.form : "breve",
    recordId: current.recordId,
  });
  await assertSealFree(database, tenantSlug, values.seal, current.id);
  await database
    .update(rcpnCertidoes)
    .set({ ...values, updatedBy: actorId, updatedAt: new Date() })
    .where(eq(rcpnCertidoes.id, current.id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "rcpn.certidao.edit",
    targetType: "rcpn-certidao",
    targetId: current.id,
  });
}

/** The signed (or scanned) certidão, kept with the one issued. */
export async function attachCertidaoWith(
  database: Database,
  tenantSlug: string,
  id: string,
  file: { path: string; name: string },
  actorId: string,
): Promise<void> {
  const current = await mustExist(database, tenantSlug, id);
  await database
    .update(rcpnCertidoes)
    .set({
      attachmentPath: file.path,
      attachmentName: file.name.slice(0, 200),
      updatedBy: actorId,
      updatedAt: new Date(),
    })
    .where(eq(rcpnCertidoes.id, current.id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "rcpn.certidao.attach",
    targetType: "rcpn-certidao",
    targetId: current.id,
  });
}

/** Marks it excluded (soft delete): the row and its audit stay. */
export async function removeCertidaoWith(
  database: Database,
  tenantSlug: string,
  id: string,
  actorId: string,
  reason: string,
): Promise<void> {
  const current = await mustExist(database, tenantSlug, id);
  await database
    .update(rcpnCertidoes)
    .set({
      removedAt: new Date(),
      removedBy: actorId,
      removedReason: reason.slice(0, 5000),
    })
    .where(eq(rcpnCertidoes.id, current.id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "rcpn.certidao.remove",
    targetType: "rcpn-certidao",
    targetId: current.id,
    reason,
  });
}

/** The person the certidão is about, for lists and file names. */
export function certidaoSubject(row: Pick<CertidaoRow, "kind" | "fields">) {
  const fields = (row.fields ?? {}) as Record<string, string>;
  const kind = row.kind as RcpnKind;
  const raw = kind === "casamento" ? fields.nomes : fields.nome;
  return (raw ?? "").split("\n").filter(Boolean).join(" e ");
}

export function certidaoTitle(kind: RcpnKind, form: unknown = "breve") {
  const title = certidaoModel(
    kind,
    isCertidaoForm(form) ? form : "breve",
  ).title;
  return title.charAt(0) + title.slice(1).toLowerCase();
}
