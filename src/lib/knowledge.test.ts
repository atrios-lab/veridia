import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { eq } from "drizzle-orm";
import { emptyMeta, toMarkdown } from "@/core/conhecimento/base.ts";
import type { Database } from "@/db/index.ts";
import { auditLog, knowledgePassages, knowledgeSources } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  confirmSourceWith,
  createSourceWith,
  getSourceWith,
  KnowledgeError,
  listRequestsWith,
  listSourcesWith,
  recordCheckWith,
  removeSourceWith,
  resolveRequestWith,
  restoreSourceWith,
  searchKnowledgeWith,
  sourceMarkdown,
  updateSourceMetaWith,
} from "./knowledge.ts";

// Fictitious office and fictitious wording only.
const OFFICE = "cartorio-base";

const LEI = toMarkdown(
  [
    "LEI FICTÍCIA Nº 1, DE 2026",
    "Art. 1º Esta lei trata dos registros fictícios.",
    "Art. 2º O título será registrado em até vinte dias.",
    "Art. 3º As exigências serão formuladas de uma só vez, por escrito.",
    "Parágrafo único. Cabe dúvida ao juízo competente.",
  ].join("\n"),
  "Lei fictícia",
);

const MODELO = toMarkdown(
  "Nota devolutiva fictícia. Formule as exigências de uma só vez e indique o fundamento de cada uma. ".repeat(
    3,
  ),
  "Modelo fictício",
);

const NOVO =
  "Art. 1º Prazo novo de quinze dias corridos para todos.\nArt. 2º O oficial registra.\nArt. 3º Vale para todos.";

let db: Database;
let close: () => Promise<void>;

before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

test("guarda a fonte dividida por artigo e acha pela hierarquia, sem acento", async () => {
  const { id: lei, pending: leiPending } = await createSourceWith(
    db,
    OFFICE,
    {
      meta: {
        ...emptyMeta(),
        title: "Lei fictícia",
        reference: "Lei fictícia nº 1/2026",
        areas: ["ri"],
      },
      markdown: LEI,
      origin: "lei.pdf",
    },
    "escrevente",
  );
  await createSourceWith(
    db,
    OFFICE,
    {
      meta: {
        ...emptyMeta(),
        kind: "modelo-externo",
        title: "Modelo fictício",
      },
      markdown: MODELO,
      origin: "colado",
    },
    "escrevente",
  );
  assert.deepEqual(leiPending, []);
  const detail = await getSourceWith(db, OFFICE, lei);
  assert.deepEqual(
    detail?.sections.map((s) => s.heading),
    ["Preâmbulo", "Art. 1º", "Art. 2º", "Art. 3º"],
  );
  assert.match(
    sourceMarkdown(detail ?? assert.fail("sem fonte")),
    /## Art\. 3º/,
  );

  const hits = await searchKnowledgeWith(
    db,
    OFFICE,
    "exigencias de uma so vez",
  );
  assert.equal(hits[0]?.sourceId, lei);
  assert.equal(hits[0]?.heading, "Art. 3º");
  assert.equal(hits.length, 2);
  // By article.
  const art = await searchKnowledgeWith(db, OFFICE, "art. 2");
  assert.equal(art[0]?.heading, "Art. 2º");
  // Another attribution: the law marked for RI stays out; the model (all) stays.
  const rcpn = await searchKnowledgeWith(db, OFFICE, "exigências", {
    area: "rcpn",
  });
  assert.equal(
    rcpn.some((h) => h.sourceId === lei),
    false,
  );
  // Another office sees nothing.
  assert.deepEqual(await searchKnowledgeWith(db, "outro", "exigências"), []);
});

test("nova versão marca a anterior; corrige, exclui e estorna com justificativa, sem apagar", async () => {
  const { id: first } = await createSourceWith(
    db,
    OFFICE,
    {
      meta: { ...emptyMeta(), title: "Provimento fictício" },
      markdown: toMarkdown(
        "Art. 1º Prazo antigo de trinta dias.\nArt. 2º Outro.\nArt. 3º Mais um.",
      ),
      origin: "prov.docx",
    },
    "escrevente",
  );
  await assert.rejects(
    createSourceWith(
      db,
      OFFICE,
      {
        meta: { ...emptyMeta(), title: "Provimento fictício" },
        markdown: NOVO,
        origin: "prov.docx",
        replaces: first,
      },
      "escrevente",
    ),
    KnowledgeError,
  );
  const { id: second } = await createSourceWith(
    db,
    OFFICE,
    {
      meta: { ...emptyMeta(), title: "Provimento fictício" },
      markdown: NOVO,
      origin: "prov.docx",
      replaces: first,
      reason: "Texto atualizado",
    },
    "escrevente",
  );
  const old = await getSourceWith(db, OFFICE, first);
  assert.equal(old?.meta.replacedBy, second);
  assert.equal((await getSourceWith(db, OFFICE, second))?.meta.replaces, first);
  // Only the new version answers.
  const hits = await searchKnowledgeWith(db, OFFICE, "prazo dias");
  assert.ok(hits.some((h) => h.sourceId === second));
  assert.ok(!hits.some((h) => h.sourceId === first));

  await updateSourceMetaWith(
    db,
    OFFICE,
    second,
    { ...emptyMeta(), title: "Provimento fictício nº 2", status: "revogada" },
    "Revogado por outro",
    "tabeliao",
  );
  const edited = await getSourceWith(db, OFFICE, second);
  assert.equal(edited?.meta.title, "Provimento fictício nº 2");
  assert.equal(edited?.meta.replaces, first);
  // Revoked: left out of the search, kept in the base.
  assert.ok(
    !(await searchKnowledgeWith(db, OFFICE, "prazo dias")).some(
      (h) => h.sourceId === second,
    ),
  );

  await assert.rejects(
    removeSourceWith(db, OFFICE, second, "", "tabeliao"),
    KnowledgeError,
  );
  await removeSourceWith(db, OFFICE, second, "Enviado errado", "tabeliao");
  assert.ok(!(await listSourcesWith(db, OFFICE)).some((s) => s.id === second));
  const removed = await listSourcesWith(db, OFFICE, { removed: true });
  assert.equal(removed[0]?.removedReason, "Enviado errado");
  await restoreSourceWith(db, OFFICE, second, "Engano", "tabeliao");
  assert.ok((await listSourcesWith(db, OFFICE)).some((s) => s.id === second));

  // Nothing deleted: every row is still there.
  const sources = await db
    .select()
    .from(knowledgeSources)
    .where(eq(knowledgeSources.tenantSlug, OFFICE));
  assert.equal(sources.length, 4);
  const passages = await db
    .select()
    .from(knowledgePassages)
    .where(eq(knowledgePassages.sourceId, first));
  assert.equal(passages.length, 3);
  const actions = (
    await db.select().from(auditLog).where(eq(auditLog.tenantSlug, OFFICE))
  ).map((a) => a.action);
  for (const action of [
    "knowledge.create",
    "knowledge.version",
    "knowledge.edit",
    "knowledge.remove",
    "knowledge.restore",
  ]) {
    assert.ok(actions.includes(action), action);
  }
});

test("documento com cara de errado fica em conferência, fora da pesquisa, até alguém confirmar", async () => {
  const { id, pending } = await createSourceWith(
    db,
    OFFICE,
    {
      meta: {
        ...emptyMeta(),
        title: "Provimento fictício 77",
        reference: "Provimento fictício nº 77/2026",
      },
      // The wrong file: a client's letter, with a CPF, not the provimento.
      markdown:
        "Prezada senhora, segue o orçamento da reforma da cozinha conforme combinado, CPF 529.982.247-25, pagamento em três parcelas iguais.",
      origin: "errado.pdf",
    },
    "escrevente",
  );
  assert.ok(pending.some((p) => /não parece documento jurídico/.test(p)));
  assert.ok(pending.some((p) => /77/.test(p)));
  assert.ok(pending.some((p) => /CPF/.test(p)));
  assert.deepEqual(
    (await searchKnowledgeWith(db, OFFICE, "orçamento reforma cozinha")).map(
      (h) => h.sourceId,
    ),
    [],
  );
  await confirmSourceWith(db, OFFICE, id, "Conferido", "tabeliao");
  assert.equal((await getSourceWith(db, OFFICE, id))?.meta.pending, undefined);
  assert.equal(
    (await searchKnowledgeWith(db, OFFICE, "orçamento reforma cozinha"))[0]
      ?.sourceId,
    id,
  );
});

test("conferência na fonte oficial: alterada abre pedido ao cartório, respondido por botão", async () => {
  const { id } = await createSourceWith(
    db,
    OFFICE,
    {
      meta: { ...emptyMeta(), title: "Lei fictícia 9", reference: "" },
      markdown: NOVO,
      origin: "colado",
    },
    "escrevente",
  );
  const quiet = await recordCheckWith(
    db,
    OFFICE,
    id,
    { on: "2026-11-15T10:00:00Z", result: "em-dia", summary: "", url: "" },
    "escrevente",
  );
  assert.equal(quiet.requestId, null);
  const { requestId } = await recordCheckWith(
    db,
    OFFICE,
    id,
    {
      on: "2026-11-15T11:00:00Z",
      result: "alterada",
      summary: "O art. 1º foi alterado por lei fictícia posterior.",
      url: "https://www.planalto.gov.br/ccivil_03/leis/ficticia.htm",
    },
    "escrevente",
  );
  assert.ok(requestId);
  assert.equal(
    (await getSourceWith(db, OFFICE, id))?.meta.check?.result,
    "alterada",
  );
  const open = await listRequestsWith(db, OFFICE, { open: true });
  assert.match(open[0]?.topic ?? "", /Deseja inserir o texto atualizado/);
  await assert.rejects(
    resolveRequestWith(
      db,
      OFFICE,
      String(requestId),
      "dismissed",
      "",
      "tabeliao",
    ),
    KnowledgeError,
  );
  await resolveRequestWith(
    db,
    OFFICE,
    String(requestId),
    "dismissed",
    "Já conferido",
    "tabeliao",
  );
  assert.deepEqual(await listRequestsWith(db, OFFICE, { open: true }), []);
  assert.equal((await listRequestsWith(db, OFFICE))[0]?.status, "dismissed");
});
