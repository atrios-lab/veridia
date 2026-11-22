import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { and, eq } from "drizzle-orm";
import { normalizeName } from "@/core/rcpn/names.ts";
import type { Database } from "@/db/index.ts";
import { auditLog, rcpnPeople, rcpnRecords } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  lookupRegistroWith,
  publicLookupEnabledWith,
  recentLookupsWith,
  setPublicLookupWith,
} from "./rcpn-lookup.ts";

const OFFICE = "cartorio-consulta";
let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => close());

// Fictitious registros only.
async function registro(
  kind: string,
  key: string,
  person: { name: string; mother: string; profession?: string },
  canceled = false,
) {
  const [record] = await db
    .insert(rcpnRecords)
    .values({
      tenantSlug: OFFICE,
      kind,
      recordKey: key,
      ...(canceled ? { canceledAt: new Date(), canceledBy: "u1" } : {}),
    })
    .returning({ id: rcpnRecords.id });
  if (!record) throw new Error("fixture");
  await db.insert(rcpnPeople).values({
    tenantSlug: OFFICE,
    recordId: record.id,
    role: kind === "obito" ? "falecido" : "registrado",
    name: person.name,
    nameNorm: normalizeName(person.name),
    motherName: person.mother,
    motherNorm: normalizeName(person.mother),
    profession: person.profession ?? "",
  });
}

const asker = {
  name: "Advogada Fictícia",
  cpf: "52998224725",
  oab: "RN 00000",
  purpose: "Aposentadoria ou benefício do INSS",
  ip: "203.0.113.7",
};

test("consulta pelo site: encontra pelo nome e pela mãe, e fica registrada", async () => {
  await registro("obito", "L1|F1|T1", {
    name: "Pedro Exemplo Lima",
    mother: "Ana Fictícia Lima",
    profession: "Pedreiro",
  });
  // A canceled registro never answers.
  await registro(
    "nascimento",
    "L2|F2|T2",
    { name: "Pedro Exemplo Lima", mother: "Ana Fictícia Lima" },
    true,
  );
  const answer = await lookupRegistroWith(
    db,
    OFFICE,
    { name: "Pedro Exemplo Lima", mother: "Ana Ficticia Lima", birthDate: "" },
    asker,
  );
  assert.equal(answer.found, true);
  if (answer.found) {
    assert.deepEqual(
      answer.items.map((i) => [i.kind, i.professions[0]?.value]),
      [["obito", "Pedreiro"]],
    );
  }
  const miss = await lookupRegistroWith(
    db,
    OFFICE,
    { name: "Pedro Lima", mother: "Ana Fictícia Lima", birthDate: "" },
    asker,
  );
  assert.equal(miss.found, false);

  const rows = await db
    .select({ reason: auditLog.reason, actorId: auditLog.actorId })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.tenantSlug, OFFICE),
        eq(auditLog.action, "rcpn.public-lookup"),
      ),
    );
  assert.equal(rows.length, 2);
  const text = rows.map((r) => r.reason).join("\n");
  assert.match(text, /Finalidade: Aposentadoria/);
  assert.match(text, /CPF \*\*\*\.982\.\*\*\*-25/);
  // The address is never kept in clear.
  assert.doesNotMatch(text, /203\.0\.113\.7/);
  assert.equal((await recentLookupsWith(db, OFFICE)).length, 2);
});

test("a serventia liga e desliga a consulta pelo site", async () => {
  assert.equal(await publicLookupEnabledWith(db, OFFICE), true);
  await setPublicLookupWith(db, OFFICE, false, "tabeliao");
  assert.equal(await publicLookupEnabledWith(db, OFFICE), false);
  await setPublicLookupWith(db, OFFICE, true, "tabeliao");
  assert.equal(await publicLookupEnabledWith(db, OFFICE), true);
});
