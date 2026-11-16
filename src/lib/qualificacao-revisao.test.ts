import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { emptyMeta, toMarkdown } from "@/core/conhecimento/base.ts";
import type { ReviewResult } from "@/core/qualificacao/revisao.ts";
import { officialName } from "@/core/tenant/identification.ts";
import { TENANTS } from "@/core/tenant/resolve.ts";
import type { Database } from "@/db/index.ts";
import {
  qualificationLibrary,
  qualificationNotes,
  serviceRequestAttachments,
  serviceRequestRequirements,
} from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import { AiError } from "./ai.ts";
import { createSourceWith } from "./knowledge.ts";
import {
  learnFromReviewWith,
  learnNextExistingWith,
  linkReviewWith,
  pendingLearningCountWith,
  reviewDocumentWith,
  reviewsOfAttachmentsWith,
} from "./qualificacao-revisao.ts";
import { createRecordWith } from "./service-request.ts";

// Fictitious notes, norms and people only.
const TENANT = TENANTS["cartorio-marinho"];
let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
  await createSourceWith(
    db,
    TENANT.slug,
    {
      meta: {
        ...emptyMeta(),
        title: "Provimento nº 12/2001",
        reference: "Provimento nº 12/2001",
        kind: "provimento-cgj",
        status: "revogada",
        notes:
          "Revogada por Provimento nº 99/2020 (identificado no texto da base em 01/01/2026).",
      },
      markdown: toMarkdown(
        "PROVIMENTO Nº 12, DE 2001\nArt. 1º A certidão vale por trinta dias.",
        "Provimento nº 12/2001",
      ),
      origin: "colado",
    },
    "escrevente",
  );
});
after(async () => {
  await close();
});

async function notePdf(lines: string[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  lines.forEach((line, i) => {
    page.drawText(line, { x: 40, y: 800 - i * 16, size: 10, font });
  });
  return pdf.save();
}

const fakeAi =
  (calls: { n: number }, result: Partial<ReviewResult> = {}) =>
  async (): Promise<ReviewResult> => {
    calls.n += 1;
    return {
      recommendation: "manter",
      summary: "Nota conferida.",
      findings: [],
      learned: [
        {
          title: "Apresentar certidão de ônus atualizada",
          description: "Falta a certidão de ônus reais do imóvel, atualizada.",
          howToComply: "Junte a certidão expedida há menos de trinta dias.",
          basis: "Lei nº 6.015/1973, art. 225",
        },
        {
          title: "Corrigir o CPF do requerente",
          description: "O CPF 123.456.789-09 diverge da matrícula.",
          howToComply: "Apresente o documento com o CPF correto.",
          basis: "Lei nº 6.015/1973, art. 176",
        },
      ],
      style: ["Abre com o número da nota e o protocolo, em caixa alta."],
      ...result,
    };
  };

test("a nota é revisada uma vez: a base acha a revogada, o Assistente Virtual aprende sem dado pessoal", async () => {
  const bytes = await notePdf([
    "NOTA DEVOLUTIVA 01/2026",
    "1. Apresentar certidao atualizada, conforme o Provimento n 12/2001.",
  ]);
  const calls = { n: 0 };
  const view = await reviewDocumentWith(
    db,
    TENANT.slug,
    {
      bytes,
      name: "nota.pdf",
      mimeType: "application/pdf",
      attribution: "ri",
      aiBlocked: null,
    },
    fakeAi(calls),
  );
  assert.equal(calls.n, 1);
  assert.equal(view.result.recommendation, "alterar");
  assert.equal(view.result.findings[0]?.source, "base");
  assert.equal(view.result.learned.length, 1);
  assert.equal(
    view.result.learned[0]?.title,
    "Apresentar certidão de ônus atualizada",
  );

  const again = await reviewDocumentWith(
    db,
    TENANT.slug,
    {
      bytes,
      name: "nota.pdf",
      mimeType: "application/pdf",
      attribution: "ri",
      aiBlocked: null,
    },
    fakeAi(calls),
  );
  assert.equal(calls.n, 1, "o mesmo arquivo não volta ao Assistente Virtual");
  assert.equal(again.id, view.id);
});

test("o anexo leva a revisão; aprende uma vez só e marca como aprendida", async () => {
  const { id: requestId } = await createRecordWith(
    db,
    TENANT,
    "service-request",
    {
      applicantName: "Fulano Exemplo",
      contact: "fulano@exemplo.com",
      description: "Pedido de teste.",
    },
  );
  const [attachment] = await db
    .insert(serviceRequestAttachments)
    .values({
      tenantSlug: TENANT.slug,
      requestId,
      kind: "office",
      storedName: "nota-02.pdf",
      displayName: "Nota devolutiva",
      path: "/tmp/inexistente.pdf",
      mimeType: "application/pdf",
      sizeBytes: 10,
    })
    .returning({ id: serviceRequestAttachments.id });
  const bytes = await notePdf([
    "NOTA DEVOLUTIVA 02/2026",
    "1. Recolher o ITBI.",
  ]);
  const view = await reviewDocumentWith(
    db,
    TENANT.slug,
    {
      bytes,
      name: "nota-02.pdf",
      mimeType: "application/pdf",
      attribution: "ri",
      aiBlocked: null,
    },
    fakeAi(
      { n: 0 },
      {
        learned: [
          {
            title: "Recolher o ITBI da transmissão",
            description: "Falta a guia do imposto de transmissão paga.",
            howToComply: "Junte a guia quitada e o comprovante.",
            basis: "Código Tributário Nacional, art. 35",
          },
        ],
      },
    ),
  );
  await linkReviewWith(db, TENANT.slug, {
    reviewId: view.id,
    attachmentId: attachment?.id ?? "",
    requestId,
    decision: "manteve",
    actorId: "escrevente",
  });
  assert.equal(await learnFromReviewWith(db, TENANT.slug, view.id), 1);
  assert.equal(await learnFromReviewWith(db, TENANT.slug, view.id), 1);
  const learned = (await db.select().from(qualificationLibrary)).filter(
    (r) => r.origin === "aprendida",
  );
  assert.deepEqual(
    learned.map((r) => r.title),
    ["Recolher o ITBI da transmissão"],
  );
  const byAttachment = await reviewsOfAttachmentsWith(db, TENANT.slug, [
    attachment?.id ?? "",
  ]);
  assert.equal(byAttachment.get(attachment?.id ?? "")?.decision, "manteve");
  assert.equal(byAttachment.get(attachment?.id ?? "")?.learned, true);
});

test("Assistente Virtual fora do ar: fica a conferência da base, e a próxima vez tenta o Assistente Virtual de novo", async () => {
  const bytes = await notePdf([
    "NOTA DEVOLUTIVA 03/2026",
    "1. Juntar a planta.",
  ]);
  const input = {
    bytes,
    name: "nota-03.pdf",
    mimeType: "application/pdf",
    attribution: "ri" as const,
    aiBlocked: null,
  };
  const failed = await reviewDocumentWith(db, TENANT.slug, input, async () => {
    throw new AiError("O Assistente Virtual está ocupado agora.");
  });
  assert.equal(failed.aiError, "O Assistente Virtual está ocupado agora.");
  const calls = { n: 0 };
  const retried = await reviewDocumentWith(
    db,
    TENANT.slug,
    input,
    fakeAi(calls),
  );
  assert.equal(calls.n, 1);
  assert.equal(retried.aiError, undefined);
  assert.equal(retried.id, failed.id);
});

test("notas já anexadas: sem o Assistente Virtual aprende pelo texto, sem gastar crédito; falha passageira do Assistente Virtual tenta de novo", async () => {
  const { id: requestId } = await createRecordWith(
    db,
    TENANT,
    "service-request",
    {
      applicantName: "Beltrana Exemplo",
      contact: "beltrana@exemplo.com",
      description: "Outro pedido de teste.",
      attribution: "RI",
    },
  );
  const [requirement] = await db
    .insert(serviceRequestRequirements)
    .values({ tenantSlug: TENANT.slug, requestId, text: "Juntar documentos." })
    .returning({ id: serviceRequestRequirements.id });
  const dir = await mkdtemp(join(tmpdir(), "revisao-"));
  const attach = async (name: string, lines: string[]) => {
    const bytes = await notePdf(lines);
    const path = join(dir, name);
    await writeFile(path, bytes);
    await db.insert(serviceRequestAttachments).values({
      tenantSlug: TENANT.slug,
      requestId,
      requirementId: requirement?.id,
      kind: "office",
      storedName: name,
      displayName: name,
      path,
      mimeType: "application/pdf",
      sizeBytes: bytes.byteLength,
    });
  };
  await attach("nota-04.pdf", [
    "NOTA DEVOLUTIVA 04/2026",
    "1. Apresentar a certidao de onus reais atualizada (Lei n 6.015/1973, art. 225).",
    "2. Recolher as custas do registro.",
  ]);
  const before = await pendingLearningCountWith(db, TENANT.slug);
  assert.ok(before >= 1);

  // Office on the legal base alone: the AI is never called.
  const never = async (): Promise<ReviewResult> => {
    throw new Error("o Assistente Virtual não deveria ser chamada");
  };
  const first = await learnNextExistingWith(
    db,
    TENANT.slug,
    null,
    never,
    "base",
  );
  assert.equal(first?.review.result.via, "base");
  assert.equal(first?.learned, 1);
  assert.ok(
    first?.review.result.findings.some((f) => f.kind === "sem-fundamento"),
    "a exigência sem fundamento é apontada pela base",
  );
  const learned = (await db.select().from(qualificationLibrary)).filter(
    (r) => r.origin === "aprendida" && r.basis.includes("6.015/1973, art. 225"),
  );
  assert.equal(learned.length, 1);

  // With the AI on, a passing failure leaves the note to be read again.
  await attach("nota-05.pdf", [
    "NOTA DEVOLUTIVA 05/2026",
    "1. Juntar a planta do imovel.",
  ]);
  const pending = await pendingLearningCountWith(db, TENANT.slug);
  await assert.rejects(
    learnNextExistingWith(db, TENANT.slug, null, async () => {
      throw new AiError("O Assistente Virtual está ocupado agora.");
    }),
    AiError,
  );
  assert.equal(await pendingLearningCountWith(db, TENANT.slug), pending);
  const calls = { n: 0 };
  const next = await learnNextExistingWith(
    db,
    TENANT.slug,
    null,
    fakeAi(calls),
  );
  assert.equal(calls.n, 1);
  assert.equal(next?.review.result.via, "ia");
});

test("nota emitida pela qualificação da plataforma não é analisada de novo; a de outro sistema com o mesmo número é", async () => {
  await db.insert(qualificationNotes).values({
    tenantSlug: TENANT.slug,
    qualificationId: "00000000-0000-4000-8000-000000000001",
    kind: "devolutiva",
    year: 2026,
    sequence: 7,
    roundIndex: 0,
    snapshot: { protocol: "PED-2026-000777" },
    issuedOn: "2026-11-16",
    createdBy: "escrevente",
  });
  const footer = `${officialName(TENANT)} - Nota devolutiva n 7/2026 - Protocolo PED-2026-000777`;
  const never = async (): Promise<ReviewResult> => {
    throw new Error("o Assistente Virtual não deveria ser chamado");
  };
  const ours = await reviewDocumentWith(
    db,
    TENANT.slug,
    {
      bytes: await notePdf([
        "NOTA DEVOLUTIVA",
        "1. Juntar a certidao.",
        footer,
      ]),
      name: "nota-07.pdf",
      mimeType: "application/pdf",
      attribution: "ri",
      aiBlocked: null,
    },
    never,
  );
  assert.equal(ours.result.via, "plataforma");
  assert.equal(ours.headline, "Já conferida na qualificação");
  assert.equal(ours.learned, true, "nada a aprender do próprio texto");

  const calls = { n: 0 };
  const theirs = await reviewDocumentWith(
    db,
    TENANT.slug,
    {
      bytes: await notePdf([
        "NOTA DEVOLUTIVA n 7/2026",
        "Protocolo 99999 do sistema antigo",
        "1. Juntar a planta.",
      ]),
      name: "nota-antiga.pdf",
      mimeType: "application/pdf",
      attribution: "ri",
      aiBlocked: null,
    },
    fakeAi(calls),
  );
  assert.equal(calls.n, 1);
  assert.equal(theirs.result.via, "ia");
});
