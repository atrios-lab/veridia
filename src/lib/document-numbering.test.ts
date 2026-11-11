import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { getAct } from "@/core/acts/catalog.ts";
import { emptyGuide } from "@/core/guides/schema.ts";
import { defaultGuideSettings } from "@/core/guides/settings.ts";
import { hashAccessKey } from "@/core/request/access-key.ts";
import { TENANTS } from "@/core/tenant/resolve.ts";
import { officeYear } from "@/core/time/office-time.ts";
import type { Database } from "@/db/index.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  clearNumberingFloorWith,
  getDocumentNumberingWith,
  lastUsedWith,
  NumberingError,
  nextNumberWith,
  saveNumberingFloorWith,
} from "./document-numbering.ts";
import {
  issueIssDeclarationWith,
  removeIssDeclarationWith,
  renumberIssDeclarationWith,
} from "./iss-declarations.ts";
import { createServiceRequestWith } from "./service-request.ts";
import { deleteGuideWith, issueGuideWith } from "./tax-guides.ts";

let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

const TENANT = TENANTS["cartorio-marinho"];
// Fictitious people only (LGPD).
const blank = emptyGuide(defaultGuideSettings(TENANT));
const guide = {
  ...blank,
  parties: blank.parties.map((party, index) => ({
    ...party,
    name: index ? "Maria Exemplo da Silva" : "João Fictício de Souza",
  })),
  property: { ...blank.property, description: "Rua Projetada, 10." },
  declaredValueCents: 2_700_000,
};

test("a serventia diz que as guias de 2026 seguem da 020 e a próxima sai 020/2026", async () => {
  await saveNumberingFloorWith(db, TENANT.slug, "guia", 2026, 20, "u1");
  const first = await issueGuideWith(
    db,
    TENANT.slug,
    guide,
    "u1",
    new Date("2026-03-10T12:00:00Z"),
  );
  const second = await issueGuideWith(
    db,
    TENANT.slug,
    guide,
    "u1",
    new Date("2026-03-11T12:00:00Z"),
  );
  assert.equal(first.sequence, 20);
  assert.equal(second.sequence, 21);
  // Another year is untouched.
  const other = await issueGuideWith(
    db,
    TENANT.slug,
    guide,
    "u1",
    new Date("2027-01-05T12:00:00Z"),
  );
  assert.equal(other.sequence, 1);
  assert.equal(await lastUsedWith(db, TENANT.slug, "guia", 2026), 21);

  // A number already used is refused, with the next free one named.
  await assert.rejects(
    saveNumberingFloorWith(db, TENANT.slug, "guia", 2026, 21, "u1"),
    (error) =>
      error instanceof NumberingError && /022\/2026/.test(error.message),
  );
  // A number below, free, may be chosen (the guias reuse freed numbers).
  await saveNumberingFloorWith(db, TENANT.slug, "guia", 2026, 5, "u1");
  assert.equal(await nextNumberWith(db, TENANT.slug, "guia", 2026), 5);
  // The next year can be set ahead.
  await saveNumberingFloorWith(db, TENANT.slug, "guia", 2028, 50, "u1");
  assert.deepEqual((await getDocumentNumberingWith(db, TENANT.slug)).guia, {
    "2026": 5,
    "2028": 50,
  });
});

test("o protocolo do pedido segue do número informado para o ano", async () => {
  const act = getAct("notas-ata-notarial");
  if (!act) throw new Error("catálogo incompleto");
  const year = officeYear(new Date());
  await saveNumberingFloorWith(db, TENANT.slug, "REQ", year, 300, "u1");
  const created = await createServiceRequestWith(db, TENANT, act, {
    applicantName: "Ana Exemplo Pereira",
    contact: "ana@exemplo.com",
    accessKeyHash: hashAccessKey("CHAVE-EXEMPLO"),
  });
  assert.equal(created.protocolNumber, `REQ.${year}.000300`);
});

test("excluir uma guia libera o número, mesmo no meio do ano", async () => {
  const at = (day: number) => new Date(Date.UTC(2030, 2, day, 12));
  const one = await issueGuideWith(db, TENANT.slug, guide, "u1", at(1));
  const two = await issueGuideWith(db, TENANT.slug, guide, "u1", at(2));
  const three = await issueGuideWith(db, TENANT.slug, guide, "u1", at(3));
  assert.deepEqual([one.sequence, two.sequence, three.sequence], [1, 2, 3]);
  assert.equal(await deleteGuideWith(db, TENANT.slug, two.id, "u1"), true);
  const again = await issueGuideWith(db, TENANT.slug, guide, "u1", at(4));
  assert.equal(again.sequence, 2);
  assert.equal(await deleteGuideWith(db, TENANT.slug, three.id, "u1"), true);
  const last = await issueGuideWith(db, TENANT.slug, guide, "u1", at(5));
  assert.equal(last.sequence, 3);
});

test("declaração de ISS de teste excluída libera o número; voltar ao automático", async () => {
  const input = {
    competence: "2031-01",
    emolumentsCents: 1_000,
    rateBasisPoints: 500,
    damNumber: "",
    dueDate: "",
    paidOn: "",
    notes: "",
    issCents: null,
    signer: 0,
  };
  const at = new Date(Date.UTC(2031, 1, 5, 12));
  const one = await issueIssDeclarationWith(
    db,
    TENANT.slug,
    input,
    [],
    "u1",
    at,
  );
  const two = await issueIssDeclarationWith(
    db,
    TENANT.slug,
    input,
    [],
    "u1",
    at,
  );
  await issueIssDeclarationWith(db, TENANT.slug, input, [], "u1", at);
  await removeIssDeclarationWith(db, TENANT.slug, two.id, "u1");
  assert.equal(
    await nextNumberWith(db, TENANT.slug, "declaracao-iss", 2031),
    2,
  );
  // Renumber by hand; a number in use is refused.
  await renumberIssDeclarationWith(db, TENANT.slug, one.id, 2031, 7, "u1");
  await assert.rejects(
    renumberIssDeclarationWith(db, TENANT.slug, one.id, 2031, 3, "u1"),
    /003\/2031/,
  );
  await saveNumberingFloorWith(
    db,
    TENANT.slug,
    "declaracao-iss",
    2031,
    10,
    "u1",
  );
  assert.equal(
    await nextNumberWith(db, TENANT.slug, "declaracao-iss", 2031),
    10,
  );
  await clearNumberingFloorWith(db, TENANT.slug, "declaracao-iss", 2031, "u1");
  assert.equal(
    await nextNumberWith(db, TENANT.slug, "declaracao-iss", 2031),
    1,
  );
});
