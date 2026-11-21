import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { and, eq } from "drizzle-orm";
import { emptyCedula } from "@/core/cedulas/analise.ts";
import type { Database } from "@/db/index.ts";
import { auditLog, cedulaAnalyses } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  CedulaError,
  changeLearnedWith,
  createAnalysisWith,
  feeTableReferenceWith,
  getAnalysisWith,
  getChargeNotesWith,
  listAnalysesWith,
  listLearnedWith,
  readCedulaDocumentsWith,
  removeAnalysisWith,
  restoreAnalysisWith,
  saveChargeNotesWith,
  saveModelWith,
  updateDataWith,
} from "./cedulas.ts";

// Fictitious office, people and documents only (LGPD).
const OFFICE = "cartorio-cedulas";
const ACTOR = "escrevente-ficticia";

let db: Database;
let close: () => Promise<void>;

before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

const text = (value: string) => ({
  name: "cedula.txt",
  bytes: new TextEncoder().encode(value),
  mediaType: "text/plain",
});

test("a leitura sem o assistente reconhece a espécie, as garantias e o aditivo; nada do arquivo fica", async () => {
  const reading = await readCedulaDocumentsWith(
    db,
    OFFICE,
    [
      text(
        "CÉDULA RURAL HIPOTECÁRIA Nº 40/00123-7\nEmitente: Fulano Fictício, CPF 123.456.789-09, agricultor\nCredor: Banco Exemplo S.A.\nValor: R$ 600.000,00. Vencimento: 15/09/2030\nem hipoteca cedular de primeiro grau o imóvel da matrícula nº 9.999",
      ),
      {
        ...text(
          "1º TERMO ADITIVO\nfica prorrogado o vencimento de 15/09/2030 para 15/09/2031",
        ),
        name: "aditivo.txt",
      },
    ],
    null,
  );
  assert.equal(reading.data.kind, "rural-hipotecaria");
  assert.equal(reading.data.number, "40/00123-7");
  assert.equal(reading.data.amount, "R$ 600.000,00");
  assert.deepEqual(
    reading.data.guarantees.map((g) => g.kind),
    ["hipoteca"],
  );
  assert.deepEqual(reading.data.addenda[0]?.changes, ["prazo"]);
  assert.equal(reading.data.addenda[0]?.previousDue, "15/09/2030");
  assert.equal(reading.data.addenda[0]?.newDue, "15/09/2031");
  assert.equal(reading.data.dueOn, "15/09/2030");
  assert.deepEqual(
    reading.data.people.map((p) => [p.role, p.name, p.taxId, p.qualification]),
    [
      ["emitente", "Fulano Fictício", "123.456.789-09", "agricultor"],
      ["credor", "Banco Exemplo S.A.", "", ""],
    ],
  );
  assert.deepEqual(reading.files, ["cedula.txt", "aditivo.txt"]);
  // The test office has no assistente: it says why.
  assert.ok(reading.aiNote);

  const id = await createAnalysisWith(
    db,
    OFFICE,
    { reading, requestId: null },
    ACTOR,
  );
  const [row] = await db
    .select()
    .from(cedulaAnalyses)
    .where(eq(cedulaAnalyses.id, id));
  // Only the names of the files, never their content.
  assert.deepEqual(row?.files, ["cedula.txt", "aditivo.txt"]);
  assert.doesNotMatch(JSON.stringify(row), /fica prorrogado o vencimento/);
});

test("editar guarda o anterior; corrigir a espécie ensina só as palavras do título", async () => {
  const id = await createAnalysisWith(
    db,
    OFFICE,
    {
      reading: {
        data: {
          ...emptyCedula("credito-bancario"),
          title: "CÉDULA DE CRÉDITO RURAL PRONAF Nº 77",
        },
        source: "manual",
        notes: [],
        aiNote: null,
        detection: null,
        files: [],
      },
      requestId: null,
    },
    ACTOR,
  );
  const before = await getAnalysisWith(db, OFFICE, id);
  assert.ok(before);
  const { learned } = await updateDataWith(
    db,
    OFFICE,
    id,
    { ...before.data, kind: "rural-pignoraticia" },
    ACTOR,
  );
  assert.equal(learned, "cedula de credito rural pronaf");
  const after = await getAnalysisWith(db, OFFICE, id);
  assert.equal(after?.kind, "rural-pignoraticia");
  assert.equal(after?.history.length, 1);
  assert.equal(
    (after?.history[0]?.previous as { kind: string }).kind,
    "credito-bancario",
  );
  const cues = await listLearnedWith(db, OFFICE);
  assert.deepEqual(
    cues.map((c) => [c.cue, c.kind]),
    [["cedula de credito rural pronaf", "rural-pignoraticia"]],
  );
  // Next time, the taught kind wins over the title's words.
  const next = await readCedulaDocumentsWith(
    db,
    OFFICE,
    [text("CÉDULA DE CRÉDITO RURAL PRONAF Nº 88\nCÉDULA DE CRÉDITO BANCÁRIO")],
    null,
  );
  assert.equal(next.data.kind, "rural-pignoraticia");
  assert.equal(next.detection?.by, "aprendido");

  // What was learned is edited, removed (a mark) and restored.
  const [cue] = cues;
  assert.ok(cue);
  await changeLearnedWith(db, OFFICE, cue.id, { removed: true }, ACTOR);
  assert.equal((await listLearnedWith(db, OFFICE)).length, 0);
  assert.equal((await listLearnedWith(db, OFFICE, { all: true })).length, 1);
  await changeLearnedWith(db, OFFICE, cue.id, { removed: false }, ACTOR);
  await changeLearnedWith(
    db,
    OFFICE,
    cue.id,
    { kind: "credito-bancario" },
    ACTOR,
  );
  assert.equal(
    (await listLearnedWith(db, OFFICE))[0]?.kind,
    "credito-bancario",
  );
});

test("modelo editado e de volta ao gerado; apagar e restaurar sem tirar do banco", async () => {
  const [first] = await listAnalysesWith(db, OFFICE);
  assert.ok(first);
  await saveModelWith(
    db,
    OFFICE,
    first.id,
    "certidao",
    "CERTIDÃO editada",
    ACTOR,
  );
  assert.equal(
    (await getAnalysisWith(db, OFFICE, first.id))?.models.certidao,
    "CERTIDÃO editada",
  );
  await saveModelWith(db, OFFICE, first.id, "certidao", null, ACTOR);
  const reset = await getAnalysisWith(db, OFFICE, first.id);
  assert.equal(reset?.models.certidao, undefined);
  assert.ok(
    reset?.history.some(
      (h) => h.what === "modelo:certidao" && h.previous === "CERTIDÃO editada",
    ),
  );

  await removeAnalysisWith(db, OFFICE, first.id, "aberta por engano", ACTOR);
  assert.ok(
    !(await listAnalysesWith(db, OFFICE)).some((a) => a.id === first.id),
  );
  assert.ok(
    (await listAnalysesWith(db, OFFICE, { removed: true })).some(
      (a) => a.id === first.id && a.removedReason === "aberta por engano",
    ),
  );
  await assert.rejects(
    updateDataWith(db, OFFICE, first.id, first.data, ACTOR),
    CedulaError,
  );
  await restoreAnalysisWith(db, OFFICE, first.id, ACTOR);
  assert.ok(
    (await listAnalysesWith(db, OFFICE)).some((a) => a.id === first.id),
  );
  const actions = await db
    .select({ action: auditLog.action })
    .from(auditLog)
    .where(
      and(eq(auditLog.tenantSlug, OFFICE), eq(auditLog.targetId, first.id)),
    );
  for (const action of [
    "cedula.create",
    "cedula.model",
    "cedula.model-reset",
    "cedula.remove",
    "cedula.restore",
  ]) {
    assert.ok(
      actions.some((a) => a.action === action),
      action,
    );
  }
});

test("as notas de cobrança da serventia são salvas e lidas", async () => {
  // No fee table in force yet: the screen asks to publish one.
  assert.equal(await feeTableReferenceWith(db, OFFICE), null);
  assert.deepEqual(await getChargeNotesWith(db, OFFICE), {});
  await saveChargeNotesWith(
    db,
    OFFICE,
    {
      "sem-conteudo": "Tabela do Estado, item fictício 1.2",
      inventada: "x",
    } as never,
    ACTOR,
  );
  assert.deepEqual(await getChargeNotesWith(db, OFFICE), {
    "sem-conteudo": "Tabela do Estado, item fictício 1.2",
  });
});
