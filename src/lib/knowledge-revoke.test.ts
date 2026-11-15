import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import {
  emptyMeta,
  isRevokedPassage,
  revokedNorms,
  toMarkdown,
} from "@/core/conhecimento/base.ts";
import type { Database } from "@/db/index.ts";
import { auditLog } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  createSourceWith,
  getSourceWith,
  searchKnowledgeWith,
} from "./knowledge.ts";

// Fictitious norms only.
const OFFICE = "cartorio-revoga";
let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

const norm = (reference: string, lines: string[]) => ({
  meta: {
    ...emptyMeta(),
    title: reference,
    reference,
    kind: "provimento-cgj" as const,
  },
  markdown: toMarkdown(lines.join("\n"), reference),
  origin: "colado",
});

test("a regra lê a revogação inteira e ignora a parcial e as disposições em contrário", () => {
  assert.deepEqual(
    revokedNorms("Art. 9º Fica revogado o Provimento CGJ nº 7/2020."),
    [{ kind: "provimento", number: "7", year: "2020" }],
  );
  assert.deepEqual(
    revokedNorms(
      "Revogam-se a Resolução nº 5, de 2018, e o Provimento nº 10/2019.",
    ),
    [
      { kind: "resolucao", number: "5", year: "2018" },
      { kind: "provimento", number: "10", year: "2019" },
    ],
  );
  assert.deepEqual(
    revokedNorms("Ficam revogados os Provimentos nºs 1/2020 e 2/2021."),
    [
      { kind: "provimento", number: "1", year: "2020" },
      { kind: "provimento", number: "2", year: "2021" },
    ],
  );
  assert.deepEqual(
    revokedNorms("Fica revogado o art. 5º da Lei nº 6.015/1973."),
    [],
  );
  assert.deepEqual(revokedNorms("Revogam-se as disposições em contrário."), []);
  assert.equal(
    isRevokedPassage("## Art. 5º\nArt. 5º (Revogado pela Lei nº 1/2020)."),
    true,
  );
  assert.equal(
    isRevokedPassage("## Art. 6º\nArt. 6º O título será registrado."),
    false,
  );
});

test("quando um provimento revoga outro, a base sabe sozinha, nos dois sentidos", async () => {
  const velho = await createSourceWith(
    db,
    OFFICE,
    norm("Provimento nº 7/2020", [
      "PROVIMENTO Nº 7, DE 2020",
      "Art. 1º O prazo de qualificação do título é de dez dias.",
      "Art. 2º Este provimento entra em vigor na data da publicação.",
      "Art. 3º O apresentante será avisado por escrito.",
    ]),
    "escrevente",
  );
  const novo = await createSourceWith(
    db,
    OFFICE,
    norm("Provimento nº 12/2026", [
      "PROVIMENTO Nº 12, DE 2026",
      "Art. 1º O prazo de qualificação do título é de cinco dias.",
      "Art. 2º O apresentante será avisado pelo protocolo.",
      "Art. 3º Fica revogado o Provimento nº 7/2020.",
    ]),
    "escrevente",
  );
  assert.deepEqual(novo.revoked, ["Provimento nº 7/2020"]);
  const old = await getSourceWith(db, OFFICE, velho.id);
  assert.equal(old?.meta.status, "revogada");
  assert.match(old?.meta.notes ?? "", /Revogada por Provimento nº 12\/2026/);
  // The search answers with the new text only.
  const hits = await searchKnowledgeWith(
    db,
    OFFICE,
    "prazo de qualificação do título",
  );
  assert.ok(hits.length > 0);
  assert.ok(hits.every((h) => h.reference === "Provimento nº 12/2026"));
  assert.ok(
    (await db.select().from(auditLog)).some(
      (a) => a.action === "knowledge.revoke-auto",
    ),
  );

  // An older norm sent after the one that revoked it comes in revoked.
  const tarde = await createSourceWith(
    db,
    OFFICE,
    {
      ...norm("Provimento nº 7/2020", [
        "PROVIMENTO Nº 7, DE 2020 (cópia enviada depois)",
        "Art. 1º O prazo de qualificação do título é de dez dias.",
        "Art. 2º Este provimento entra em vigor na data da publicação.",
        "Art. 3º O apresentante será avisado por escrito.",
      ]),
      meta: {
        ...emptyMeta(),
        title: "Provimento antigo",
        reference: "Provimento nº 7, de 2020",
        kind: "provimento-cgj" as const,
      },
    },
    "escrevente",
  );
  assert.equal(tarde.revokedBy, "Provimento nº 12/2026");
  assert.equal(
    (await getSourceWith(db, OFFICE, tarde.id))?.meta.status,
    "revogada",
  );
});

test("artigo marcado como revogado dentro de uma lei não volta na pesquisa", async () => {
  await createSourceWith(
    db,
    OFFICE,
    norm("Lei nº 9.999/2026", [
      "LEI Nº 9.999, DE 2026",
      "Art. 1º A certidão fictícia é expedida em cinco dias.",
      "Art. 2º (Revogado pela Lei nº 10.000/2026).",
      "Art. 3º A certidão fictícia pode ser digital.",
    ]),
    "escrevente",
  );
  const hits = await searchKnowledgeWith(
    db,
    OFFICE,
    "revogado certidão fictícia",
  );
  assert.ok(hits.length > 0);
  assert.ok(!hits.some((h) => /Art\. 2º/.test(h.heading)));
});
