import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { eq } from "drizzle-orm";
import {
  emptyQualification,
  emptyRequirement,
  type QualificationData,
} from "@/core/qualificacao/qualificacao.ts";
import type { Database } from "@/db/index.ts";
import {
  auditLog,
  qualificationLibrary,
  qualificationNotes,
  qualifications,
} from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  createLibraryItemWith,
  createQualificationWith,
  getQualificationWith,
  issueNoteWith,
  listLibraryWith,
  listNotesWith,
  markLibraryItemWith,
  markQualificationWith,
  QualificationError,
  reexamWith,
  removeNoteWith,
  renumberNoteWith,
  saveQualificationWith,
} from "./qualificacao.ts";

// Fictitious office, people and documents only (LGPD).
const OFFICE = "cartorio-qualifica";
const SIGNER = { name: "Escrevente Fictícia", role: "Escrevente" };
const NOW = new Date("2026-11-15T12:00:00Z");

function divorcio(): QualificationData {
  return {
    ...emptyQualification("rcpn", "2026-11-10"),
    act: "divorcio",
    presenter: { name: "Joana Fictícia", document: "", contact: "" },
    document: "Escritura pública de divórcio fictícia",
  };
}

const must = <T>(value: T | null | undefined): T => {
  if (value === null || value === undefined) throw new Error("ausente");
  return value;
};

let db: Database;
let close: () => Promise<void>;

before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

test("a biblioteca começa com as exigências do Registro Civil, uma vez só, e é editável", async () => {
  const first = await listLibraryWith(db, OFFICE, "rcpn");
  assert.ok(first.length >= 15);
  const again = await listLibraryWith(db, OFFICE, "rcpn");
  assert.equal(again.length, first.length);
  const forDivorce = await listLibraryWith(db, OFFICE, "rcpn", {
    act: "divorcio",
  });
  assert.ok(forDivorce.some((i) => i.seedKey === "rcpn-divorcio-titulo"));
  assert.ok(!forDivorce.some((i) => i.seedKey === "rcpn-obito-atestado"));

  const own = await createLibraryItemWith(
    db,
    OFFICE,
    {
      attribution: "rcpn",
      acts: ["divorcio"],
      title: "Exigência própria fictícia",
      description: "Falta um documento fictício.",
      howToComply: "Apresentar o documento fictício.",
      basis: "Norma fictícia, art. 1º.",
    },
    "escrevente",
  );
  await assert.rejects(
    markLibraryItemWith(db, OFFICE, own, "", "escrevente"),
    QualificationError,
  );
  await markLibraryItemWith(db, OFFICE, own, "Repetida", "escrevente");
  // An excluded seed is not inserted again.
  const seed = must(first.find((i) => i.seedKey === "rcpn-obito-atestado"));
  await markLibraryItemWith(db, OFFICE, seed.id, "Não usamos", "escrevente");
  const after = await listLibraryWith(db, OFFICE, "rcpn");
  assert.ok(!after.some((i) => i.id === own || i.id === seed.id));
  const removed = await listLibraryWith(db, OFFICE, "rcpn", { removed: true });
  assert.equal(removed.length, 2);
  await markLibraryItemWith(db, OFFICE, own, "Engano", "escrevente", true);
  assert.ok(
    (await listLibraryWith(db, OFFICE, "rcpn")).some((i) => i.id === own),
  );
});

test("qualifica, emite a nota numerada, reexamina e emite a positiva, sem apagar nada", async () => {
  await assert.rejects(
    createQualificationWith(
      db,
      OFFICE,
      emptyQualification("rcpn", "2026-11-10"),
      "escrevente",
    ),
    QualificationError,
  );
  const id = await createQualificationWith(
    db,
    OFFICE,
    divorcio(),
    "escrevente",
  );
  const library = await listLibraryWith(db, OFFICE, "rcpn", {
    act: "divorcio",
  });
  const titulo = must(
    library.find((i) => i.seedKey === "rcpn-divorcio-titulo"),
  );

  const stored = must(await getQualificationWith(db, OFFICE, id));
  const data = stored.data;
  data.rounds[0] = {
    ...must(data.rounds[0]),
    requirements: [
      {
        ...emptyRequirement("r1"),
        libraryId: titulo.id,
        title: titulo.title,
        description: titulo.description,
        howToComply: titulo.howToComply,
        basis: titulo.basis,
      },
    ],
  };
  await saveQualificationWith(db, OFFICE, id, data, "escrevente");
  await assert.rejects(
    issueNoteWith(
      db,
      OFFICE,
      id,
      "positiva",
      { issuedOn: "2026-11-12", signer: SIGNER },
      "escrevente",
      NOW,
    ),
    /exigência pendente/,
  );
  const noteId = await issueNoteWith(
    db,
    OFFICE,
    id,
    "devolutiva",
    { issuedOn: "2026-11-12", signer: SIGNER },
    "escrevente",
    NOW,
  );
  let q = must(await getQualificationWith(db, OFFICE, id));
  assert.equal(q.status, "exigencia");
  let notes = await listNotesWith(db, OFFICE, id);
  assert.equal(notes[0]?.number, "1/2026");
  assert.equal(notes[0]?.signer.name, "Escrevente Fictícia");
  // The library item used counts once more.
  const [used] = await db
    .select()
    .from(qualificationLibrary)
    .where(eq(qualificationLibrary.id, titulo.id));
  assert.equal(used?.uses, 1);

  // An answered round does not change.
  const changed = structuredClone(q.data);
  must(changed.rounds[0]).requirements[0] = {
    ...must(must(changed.rounds[0]).requirements[0]),
    title: "Outra",
  };
  await assert.rejects(
    saveQualificationWith(db, OFFICE, id, changed, "escrevente", "Correção"),
    /nota emitida/,
  );

  // Issued by mistake: excluded, the round opens again, a new number.
  await removeNoteWith(db, OFFICE, noteId, "Data errada", "tabeliao");
  q = must(await getQualificationWith(db, OFFICE, id));
  assert.equal(q.status, "em-analise");
  await issueNoteWith(
    db,
    OFFICE,
    id,
    "devolutiva",
    { issuedOn: "2026-11-13", signer: SIGNER },
    "escrevente",
    NOW,
  );
  notes = await listNotesWith(db, OFFICE, id);
  assert.deepEqual(
    notes.map((n) => [n.number, Boolean(n.removedAt)]),
    [
      ["1/2026", true],
      ["2/2026", false],
    ],
  );
  await renumberNoteWith(
    db,
    OFFICE,
    must(notes[1]).id,
    7,
    "Numeração do livro",
    "tabeliao",
  );
  await assert.rejects(
    renumberNoteWith(
      db,
      OFFICE,
      must(notes[1]).id,
      1,
      "Número usado",
      "tabeliao",
    ),
    /já foi usado/,
  );

  // Back with the document: the reexame, then the positiva.
  await reexamWith(
    db,
    OFFICE,
    id,
    "Traslado da escritura",
    "2026-11-20",
    "escrevente",
  );
  q = must(await getQualificationWith(db, OFFICE, id));
  assert.equal(q.status, "reapresentado");
  const met = structuredClone(q.data);
  must(must(met.rounds[1]).requirements[0]).status = "cumprida";
  await saveQualificationWith(db, OFFICE, id, met, "escrevente", "Reexame");
  await issueNoteWith(
    db,
    OFFICE,
    id,
    "positiva",
    { issuedOn: "2026-11-21", signer: SIGNER },
    "escrevente",
    NOW,
  );
  q = must(await getQualificationWith(db, OFFICE, id));
  assert.equal(q.status, "positiva");
  notes = await listNotesWith(db, OFFICE, id);
  assert.equal(notes.at(-1)?.kind, "positiva");
  assert.equal(notes.at(-1)?.number, "1/2026");

  await markQualificationWith(
    db,
    OFFICE,
    id,
    "Lançada em duplicidade",
    "tabeliao",
  );
  assert.ok(must(await getQualificationWith(db, OFFICE, id)).removedAt);

  // Nothing deleted.
  assert.equal(
    (
      await db
        .select()
        .from(qualifications)
        .where(eq(qualifications.tenantSlug, OFFICE))
    ).length,
    1,
  );
  assert.equal(
    (
      await db
        .select()
        .from(qualificationNotes)
        .where(eq(qualificationNotes.tenantSlug, OFFICE))
    ).length,
    3,
  );
  const actions = (
    await db.select().from(auditLog).where(eq(auditLog.tenantSlug, OFFICE))
  ).map((a) => a.action);
  for (const action of [
    "qualificacao.create",
    "qualificacao.edit",
    "qualificacao.note",
    "qualificacao.note-remove",
    "qualificacao.note-renumber",
    "qualificacao.reexam",
    "qualificacao.positive",
    "qualificacao.remove",
    "qualificacao.library-create",
    "qualificacao.library-remove",
    "qualificacao.library-restore",
  ]) {
    assert.ok(actions.includes(action), action);
  }
});

test("a qualificação aberta pelo pedido do balcão online fica ligada ao protocolo", async () => {
  const { qualificationFromRequest } = await import(
    "@/core/qualificacao/qualificacao.ts"
  );
  const { qualificationsOfProtocolWith } = await import("./qualificacao.ts");
  const data = qualificationFromRequest({
    protocol: "REQ-2026-000099",
    applicantName: "Pedro Fictício",
    contact: "pedro@exemplo.com",
    receivedOn: "2026-11-14",
    attribution: "RI",
    actName: "Registro de escritura",
  });
  assert.equal(data.attribution, "ri");
  assert.equal(data.presenter.name, "Pedro Fictício");
  const id = await createQualificationWith(
    db,
    OFFICE,
    { ...data, act: "registro" },
    "escrevente",
  );
  const linked = await qualificationsOfProtocolWith(
    db,
    OFFICE,
    "REQ-2026-000099",
  );
  assert.deepEqual(
    linked.map((q) => q.id),
    [id],
  );
  assert.deepEqual(
    await qualificationsOfProtocolWith(db, OFFICE, "REQ-2026-000098"),
    [],
  );
});

test("a proposta do Assistente Virtual entra como rascunho e trava a nota até a pessoa conferir", async () => {
  const { applyAiProposalWith } = await import("./qualificacao.ts");
  const { noteProblems } = await import("@/core/qualificacao/qualificacao.ts");
  const id = await createQualificationWith(
    db,
    OFFICE,
    divorcio(),
    "escrevente",
  );
  const library = await listLibraryWith(db, OFFICE, "rcpn", {
    act: "divorcio",
  });
  const titulo = must(
    library.find((i) => i.seedKey === "rcpn-divorcio-titulo"),
  );
  let count = 0;
  const added = await applyAiProposalWith(
    db,
    OFFICE,
    id,
    {
      summary: "Falta o título hábil.",
      requirements: [
        {
          libraryId: titulo.id,
          title: titulo.title,
          description: titulo.description,
          howToComply: titulo.howToComply,
          basis: titulo.basis,
          reference: "Escritura",
          excerpt: "Trecho fictício do título.",
        },
        {
          libraryId: "inexistente",
          title: "Exigência redigida pelo Assistente Virtual",
          description: "Falta algo fictício.",
          howToComply: "Apresentar algo fictício.",
          basis: "Lei nº 6.015/1973, art. 29, § 1º.",
          reference: "",
          excerpt: "",
        },
      ],
    },
    "escrevente",
    () => `ia-${++count}`,
  );
  assert.equal(added, 2);
  const q = must(await getQualificationWith(db, OFFICE, id));
  const round = must(q.data.rounds[0]);
  assert.equal(round.aiNote, "Falta o título hábil.");
  assert.equal(round.requirements[0]?.libraryId, titulo.id);
  assert.equal(round.requirements[1]?.libraryId, undefined);
  assert.ok(round.requirements.every((r) => r.fromAi && !r.reviewed));
  assert.match(noteProblems(round).join(" "), /ainda não foram conferidas/);
  await assert.rejects(
    issueNoteWith(
      db,
      OFFICE,
      id,
      "devolutiva",
      { issuedOn: "2026-11-12", signer: SIGNER },
      "escrevente",
      NOW,
    ),
    /conferidas/,
  );
  const checked = structuredClone(q.data);
  for (const r of must(checked.rounds[0]).requirements) r.reviewed = true;
  await saveQualificationWith(db, OFFICE, id, checked, "escrevente");
  await issueNoteWith(
    db,
    OFFICE,
    id,
    "devolutiva",
    { issuedOn: "2026-11-12", signer: SIGNER },
    "escrevente",
    NOW,
  );
  assert.equal(
    must(await getQualificationWith(db, OFFICE, id)).status,
    "exigencia",
  );
});

test("no reexame o Assistente Virtual sugere a situação de cada exigência anterior, e a pessoa confere", async () => {
  const { applyAiProposalWith } = await import("./qualificacao.ts");
  const { noteProblems, positiveProblems } = await import(
    "@/core/qualificacao/qualificacao.ts"
  );
  const id = await createQualificationWith(
    db,
    OFFICE,
    divorcio(),
    "escrevente",
  );
  const q0 = must(await getQualificationWith(db, OFFICE, id));
  const data = structuredClone(q0.data);
  must(data.rounds[0]).requirements = [
    {
      ...emptyRequirement("antiga"),
      title: "Título hábil",
      description: "Falta a escritura.",
      howToComply: "Apresentar a escritura.",
      basis: "Lei nº 6.015/1973, art. 29, § 1º.",
    },
  ];
  await saveQualificationWith(db, OFFICE, id, data, "escrevente");
  await issueNoteWith(
    db,
    OFFICE,
    id,
    "devolutiva",
    { issuedOn: "2026-11-12", signer: SIGNER },
    "escrevente",
    NOW,
  );
  await reexamWith(
    db,
    OFFICE,
    id,
    "Escritura fictícia",
    "2026-11-20",
    "escrevente",
  );
  await applyAiProposalWith(
    db,
    OFFICE,
    id,
    {
      summary: "A escritura veio.",
      previous: [
        {
          id: "antiga",
          status: "cumprida",
          reason: "A escritura foi juntada.",
        },
      ],
      requirements: [],
    },
    "escrevente",
  );
  const q = must(await getQualificationWith(db, OFFICE, id));
  const old = must(must(q.data.rounds[1]).requirements[0]);
  assert.equal(old.status, "cumprida");
  assert.match(old.note, /Sugestão do Assistente Virtual/);
  assert.ok(old.fromAi && !old.reviewed);
  // Met, but not checked: neither note nor positiva goes out.
  assert.match(positiveProblems(must(q.data.rounds[1])).join(" "), /conferid/);
  assert.match(noteProblems(must(q.data.rounds[1])).join(" "), /positiva/);
});
