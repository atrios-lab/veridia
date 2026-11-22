import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { normalizeName } from "@/core/rcpn/names.ts";
import {
  answerLookup,
  type LookupAnswer,
  type LookupCandidate,
  type LookupQuery,
} from "@/core/rcpn/public-lookup.ts";
import type { RcpnKind, RcpnRole } from "@/core/rcpn/record.ts";
import { type Database, db } from "@/db/index.ts";
import {
  auditLog,
  rcpnPeople,
  rcpnRecords,
  tenantContent,
} from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";

/**
 * The public lookup of the Registro Civil index (see core/rcpn/public-
 * lookup.ts): the office's switch, the query against the index, and the
 * record of every lookup (who asked, why, what was asked, whether it was
 * found), kept in the audit to protect the Tabelião.
 */

const SETTING_KEY = "rcpn-public-lookup";

/** On unless the office switched it off. */
export async function publicLookupEnabledWith(
  database: Database,
  tenantSlug: string,
): Promise<boolean> {
  const [row] = await database
    .select({ published: tenantContent.published })
    .from(tenantContent)
    .where(
      and(
        eq(tenantContent.tenantSlug, tenantSlug),
        eq(tenantContent.key, SETTING_KEY),
      ),
    )
    .limit(1);
  return (row?.published as { enabled?: boolean } | null)?.enabled !== false;
}

export function publicLookupEnabled(tenantSlug: string): Promise<boolean> {
  return publicLookupEnabledWith(db, tenantSlug);
}

export async function setPublicLookupWith(
  database: Database,
  tenantSlug: string,
  enabled: boolean,
  actorId: string,
): Promise<void> {
  const value = { enabled, at: new Date().toISOString(), by: actorId };
  await database
    .insert(tenantContent)
    .values({
      tenantSlug,
      key: SETTING_KEY,
      published: value,
      updatedBy: actorId,
    })
    .onConflictDoUpdate({
      target: [tenantContent.tenantSlug, tenantContent.key],
      set: { published: value, updatedAt: new Date(), updatedBy: actorId },
    });
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: enabled ? "rcpn.public-lookup-on" : "rcpn.public-lookup-off",
    targetType: "rcpn",
    targetId: SETTING_KEY,
  });
}

/** Who asks, as the form identifies them. */
export interface Asker {
  name: string;
  cpf: string;
  oab: string;
  purpose: string;
  /** The client's address, hashed here before anything is kept. */
  ip: string;
}

const maskCpf = (cpf: string) => {
  const d = cpf.replace(/\D/g, "");
  return d.length === 11 ? `***.${d.slice(3, 6)}.***-${d.slice(9)}` : "";
};

/** The candidates of the index for that mother's name, not canceled. */
async function candidatesWith(
  database: Database,
  tenantSlug: string,
  mother: string,
): Promise<LookupCandidate[]> {
  const motherNorm = normalizeName(mother);
  if (!motherNorm) return [];
  const rows = await database
    .select({ person: rcpnPeople, record: rcpnRecords })
    .from(rcpnPeople)
    .innerJoin(rcpnRecords, eq(rcpnRecords.id, rcpnPeople.recordId))
    .where(
      and(
        eq(rcpnPeople.tenantSlug, tenantSlug),
        eq(rcpnPeople.motherNorm, motherNorm),
        isNull(rcpnRecords.canceledAt),
      ),
    )
    .limit(500);
  return rows.map(({ person, record }) => ({
    kind: record.kind as RcpnKind,
    subtype: record.subtype === "natimorto" ? "natimorto" : "",
    person: {
      role: person.role as RcpnRole,
      name: person.name,
      marriedName: person.marriedName,
      motherName: person.motherName,
      fatherName: person.fatherName,
      birthDate: person.birthDate,
      profession: person.profession,
      fatherProfession: person.fatherProfession,
      motherProfession: person.motherProfession,
    },
  }));
}

/** Looks the registro up and keeps the record of the lookup. */
export async function lookupRegistroWith(
  database: Database,
  tenantSlug: string,
  query: LookupQuery,
  asker: Asker,
): Promise<LookupAnswer> {
  const answer = answerLookup(
    query,
    await candidatesWith(database, tenantSlug, query.mother),
  );
  const ipHash = createHash("sha256")
    .update(`${tenantSlug}:${asker.ip}`)
    .digest("hex")
    .slice(0, 16);
  const result = answer.found
    ? `localizado (${answer.items.map((i) => i.kindLabel).join(", ")})`
    : "não localizado";
  await recordAuditWith(database, {
    tenantSlug,
    actorId: null,
    action: "rcpn.public-lookup",
    targetType: "rcpn",
    targetId: null,
    reason: [
      `Quem consultou: ${asker.name.trim().slice(0, 120)}, CPF ${maskCpf(asker.cpf)}${asker.oab.trim() ? `, OAB ${asker.oab.trim().slice(0, 30)}` : ""}`,
      `Finalidade: ${asker.purpose}`,
      `Perguntou: ${query.name.trim().slice(0, 150)}, mãe ${query.mother.trim().slice(0, 150)}${query.birthDate ? `, nascimento ${query.birthDate}` : ", sem data de nascimento"}`,
      `Resultado: ${result}`,
      `IP (cifrado): ${ipHash}`,
    ].join(" | "),
  });
  return answer;
}

export function lookupRegistro(
  tenantSlug: string,
  query: LookupQuery,
  asker: Asker,
): Promise<LookupAnswer> {
  return lookupRegistroWith(db, tenantSlug, query, asker);
}

/** The latest lookups, for the Registro Civil area of the panel. */
export async function recentLookupsWith(
  database: Database,
  tenantSlug: string,
  limit = 50,
): Promise<{ at: Date; text: string }[]> {
  const rows = await database
    .select({ at: auditLog.createdAt, reason: auditLog.reason })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.tenantSlug, tenantSlug),
        eq(auditLog.action, "rcpn.public-lookup"),
      ),
    )
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
  return rows.map((r) => ({ at: r.at, text: r.reason ?? "" }));
}

export function recentLookups(tenantSlug: string, limit = 50) {
  return recentLookupsWith(db, tenantSlug, limit);
}
