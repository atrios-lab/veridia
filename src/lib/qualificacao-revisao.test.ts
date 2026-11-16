import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { emptyMeta, toMarkdown } from "@/core/conhecimento/base.ts";
import type { ReviewResult } from "@/core/qualificacao/revisao.ts";
import { TENANTS } from "@/core/tenant/resolve.ts";
import type { Database } from "@/db/index.ts";
import {
  qualificationLibrary,
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

test("a nota é revisada uma vez: a base acha a revogada, a IA aprende sem dado pessoal", async () => {
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
  assert.equal(calls.n, 1, "o mesmo arquivo não volta à IA");
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

test("IA fora do ar: fica a conferência da base, e a próxima vez tenta a IA de novo", async () => {
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

test("as notas já anexadas são lidas uma a uma, e a lida sem IA volta para aprender", async () => {
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
  const path = join(dir, "nota-04.pdf");
  const bytes = await notePdf([
    "NOTA DEVOLUTIVA 04/2026",
    "1. Juntar a certidao de casamento.",
  ]);
  await writeFile(path, bytes);
  const [attachment] = await db
    .insert(serviceRequestAttachments)
    .values({
      tenantSlug: TENANT.slug,
      requestId,
      requirementId: requirement?.id,
      kind: "office",
      storedName: "nota-04.pdf",
      displayName: "Nota devolutiva 04",
      path,
      mimeType: "application/pdf",
      sizeBytes: bytes.byteLength,
    })
    .returning({ id: serviceRequestAttachments.id });

  // Attached while the AI was off: reviewed by the base only, not learned.
  const offline = await reviewDocumentWith(db, TENANT.slug, {
    bytes,
    name: "nota-04.pdf",
    mimeType: "application/pdf",
    attribution: "ri",
    aiBlocked: "O Assistente Virtual está desligado.",
  });
  await linkReviewWith(db, TENANT.slug, {
    reviewId: offline.id,
    attachmentId: attachment?.id ?? "",
    requestId,
    actorId: "escrevente",
  });
  assert.equal(await learnFromReviewWith(db, TENANT.slug, offline.id), 0);
  assert.equal(await pendingLearningCountWith(db, TENANT.slug), 1);

  const calls = { n: 0 };
  const next = await learnNextExistingWith(
    db,
    TENANT.slug,
    null,
    fakeAi(calls, {
      learned: [
        {
          title: "Juntar a certidão de casamento atualizada",
          description:
            "Falta a certidão de casamento atualizada do requerente.",
          howToComply: "Junte a certidão expedida há menos de noventa dias.",
          basis: "Lei nº 6.015/1973, art. 167, II, 14",
        },
      ],
    }),
  );
  assert.equal(calls.n, 1);
  assert.equal(next?.learned, 1);
  assert.equal(await pendingLearningCountWith(db, TENANT.slug), 0);
  assert.equal(
    await learnNextExistingWith(db, TENANT.slug, null, fakeAi(calls)),
    null,
  );
});
