import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { and, eq } from "drizzle-orm";
import PDFDocument from "pdfkit";
import { emptyCedula } from "@/core/cedulas/analise.ts";
import type { Database } from "@/db/index.ts";
import {
  auditLog,
  cedulaAnalyses,
  transparencyDocuments,
} from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  CedulaError,
  cedulaInRequestWith,
  changeLearnedWith,
  createAnalysisWith,
  feeTableReferenceWith,
  getAnalysisWith,
  getChargeNotesWith,
  linkNoteWith,
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

test("a nota de exigência fica ligada à análise e não se perde ao editar os dados", async () => {
  const [analysis] = await listAnalysesWith(db, OFFICE);
  assert.ok(analysis);
  const noteId = "0b1c2d3e-4f50-4a61-8b72-93a4b5c6d7e8";
  await linkNoteWith(db, OFFICE, analysis.id, noteId, ACTOR);
  const linked = await getAnalysisWith(db, OFFICE, analysis.id);
  assert.deepEqual(linked?.data.noteIds, [noteId]);
  // The data form sends no notes: they stay.
  await updateDataWith(
    db,
    OFFICE,
    analysis.id,
    { ...(linked?.data ?? analysis.data), noteIds: [] },
    ACTOR,
  );
  assert.deepEqual(
    (await getAnalysisWith(db, OFFICE, analysis.id))?.data.noteIds,
    [noteId],
  );
});

function pdfOf(text: string): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.text(text);
    doc.end();
  });
}

test("o pedido mostra a cédula só quando há cédula: pelo ato, pelo nome ou pelo texto do arquivo", async () => {
  const file = (
    over: Partial<Parameters<typeof cedulaInRequestWith>[2]["files"][number]>,
  ) => ({
    id: "f1",
    displayName: "documento.pdf",
    path: null,
    mimeType: "application/pdf",
    sizeBytes: 1000,
    purgedAt: null,
    ...over,
  });
  const ask = (
    actName: string,
    files: ReturnType<typeof file>[],
    details: unknown = {},
  ) =>
    cedulaInRequestWith(db, OFFICE, {
      requestId: "00000000-0000-4000-8000-000000000001",
      details,
      actName,
      files,
    });
  assert.equal(await ask("Certidão de inteiro teor", []), null);
  assert.equal((await ask("Registro de cédula de crédito", []))?.from, "ato");
  assert.equal(
    (
      await ask("Registro", [
        file({ displayName: "CCB banco fictício.pdf", path: "/x" }),
      ])
    )?.from,
    "nome",
  );
  // A person chose "Registro" and sent "contrato.pdf": the text says CPR.
  const dir = await mkdtemp(join(tmpdir(), "cedula-"));
  try {
    const path = join(dir, "contrato.pdf");
    await writeFile(
      path,
      await pdfOf("CÉDULA DE PRODUTO RURAL Nº 9 (fictícia)"),
    );
    const seen = await ask("Registro", [
      file({ id: "f9", displayName: "contrato.pdf", path }),
    ]);
    assert.deepEqual(seen, {
      kind: "produto-rural",
      from: "texto",
      file: "contrato.pdf",
    });
    // Read once: the same files are not read again (the cache answers).
    const cached = await ask(
      "Registro",
      [
        file({
          id: "f9",
          displayName: "contrato.pdf",
          path: join(dir, "sumiu.pdf"),
        }),
      ],
      {
        cedulaScan: { key: "f9", kind: "produto-rural", file: "contrato.pdf" },
      },
    );
    assert.equal(cached?.kind, "produto-rural");
    // An ordinary file is read and gives nothing.
    await writeFile(path, await pdfOf("Requerimento de certidão fictícia"));
    assert.equal(
      await ask("Registro", [
        file({ id: "f10", displayName: "contrato.pdf", path }),
      ]),
      null,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a referência é a tabela de emolumentos vigente publicada em Transparência", async () => {
  const OTHER = "cartorio-tabela";
  assert.equal(await feeTableReferenceWith(db, OTHER), null);
  const doc = {
    tenantSlug: OTHER,
    category: "Tabela de emolumentos",
    yearLabel: "2026",
    fileStoredName: "t.pdf",
    fileDisplayName: "t.pdf",
    filePath: "/tmp/t.pdf",
    fileMimeType: "application/pdf",
    fileSizeBytes: 1,
  };
  // A draft is not in force; the first published, in the panel's order, is.
  await db.insert(transparencyDocuments).values([
    { ...doc, title: "Tabela rascunho", status: "draft", position: 0 },
    {
      ...doc,
      title: "Tabela 2026 (fictícia)",
      status: "published",
      position: 1,
    },
    {
      ...doc,
      title: "Tabela 2025 (fictícia)",
      status: "published",
      position: 2,
      yearLabel: "2025",
    },
  ]);
  const ref = await feeTableReferenceWith(db, OTHER);
  assert.equal(ref?.title, "Tabela 2026 (fictícia)");
  assert.equal(ref?.year, "2026");
});
