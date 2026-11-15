import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { MockLanguageModelV4 } from "ai/test";
import { eq } from "drizzle-orm";
import { parseDetails } from "@/core/request/kinds.ts";
import { TENANTS } from "@/core/tenant/resolve.ts";
import { user } from "@/db/auth-schema.ts";
import type { Database } from "@/db/index.ts";
import { auditLog, serviceRequests } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import { createRecordWith, saveDraftReplyWith } from "../service-request.ts";
import {
  alignDataRightsWith,
  alignmentMessagesWith,
  alignmentStoredWith,
  approveDataRightsReplyWith,
} from "./alignment.ts";
import { listOwnConversationsWith } from "./store.ts";

// Fictitious titular and staff only (LGPD).
const TENANT = TENANTS["cartorio-marinho"];
if (!TENANT) throw new Error("sem serventia de teste");
const NOW = new Date("2026-11-15T15:00:00Z");
const usage = {
  inputTokens: {
    total: 1,
    noCache: 1,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};
let sent = "";
let system = "";
const answer = new MockLanguageModelV4({
  doGenerate: async (options) => {
    sent = JSON.stringify(options.prompt);
    const first = options.prompt[0];
    system = first?.role === "system" ? String(first.content) : "";
    // Cites the first excerpt delivered, and one that was not.
    const id = /<trecho id="([^"]+)"/.exec(system)?.[1] ?? "nenhum";
    return {
      content: [
        {
          type: "text",
          text: `Os dados do livro ficam, por dever de conservação [[fonte:${id}]]. Onde mais aparecem? [[fonte:inventado-1]]`,
        },
      ],
      finishReason: { unified: "stop", raw: undefined },
      usage,
      warnings: [],
    };
  },
});
const models = { triage: answer, answer };

let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
  await db.insert(user).values({
    id: "funcionario-ficticio",
    name: "Funcionário Fictício",
    email: "funcionario@exemplo.com",
    tenantSlug: TENANT.slug,
  });
});
after(async () => {
  await close();
});

test("a conversa do requerimento pesquisa a lei, cita a fonte, oculta dados pessoais e fica no requerimento", async () => {
  const { id, protocolNumber } = await createRecordWith(
    db,
    TENANT,
    "data-rights",
    {
      applicantName: "Titular Fictícia",
      contact: "titular@exemplo.com",
      description: "Quero que apaguem meus dados.",
      details: parseDetails("data-rights", { right: "deletion" }),
    },
  );
  const turn = (message: string, fileText?: string) =>
    alignDataRightsWith(db, models, {
      tenant: TENANT,
      requestId: id,
      userId: "funcionario-ficticio",
      userRole: "staff",
      message,
      fileText,
      officeContext: "Serventia fictícia.",
      now: new Date(),
    });

  // Opening: the analysis, with the law's excerpts, nothing of the titular.
  assert.deepEqual(await turn(""), { status: "ok" });
  assert.match(system, /<trecho id=/);
  assert.match(system, /eliminação/);
  assert.doesNotMatch(sent, /Titular Fictícia|titular@exemplo|apaguem/);

  // The team answers, with a CPF and a document to read: both masked.
  assert.deepEqual(
    await turn(
      "Está no livro e no cadastro do site, CPF 123.456.789-09.",
      "Ficha de cadastro com e-mail outra@exemplo.com.",
    ),
    { status: "ok" },
  );
  assert.doesNotMatch(sent, /123\.456\.789-09|outra@exemplo/);

  const messages = await alignmentMessagesWith(db, TENANT.slug, id);
  // The opening prompt is not shown; two answers and the team's message.
  assert.deepEqual(
    messages.map((m) => m.role),
    ["assistant", "user", "assistant"],
  );
  assert.equal(messages[0]?.sources.length, 1);
  assert.doesNotMatch(messages[0]?.content ?? "", /inventado-1/);
  assert.match(messages[1]?.content ?? "", /\[CPF\]/);
  assert.equal((await alignmentStoredWith(db, TENANT.slug, id)).length, 4);

  // Shared by the team on the requerimento, not in anyone's own list.
  assert.equal(
    (
      await listOwnConversationsWith(db, {
        tenantSlug: TENANT.slug,
        userId: "funcionario-ficticio",
      })
    ).length,
    0,
  );
  const trail = (await db.select().from(auditLog)).filter(
    (a) => a.action === "data-rights.align",
  );
  assert.equal(trail.length, 2);
  assert.equal(trail[0]?.targetId, protocolNumber);
});

test("a decisão final aprova o texto salvo, palavra por palavra", async () => {
  const { id } = await createRecordWith(db, TENANT, "data-rights", {
    applicantName: "Outra Titular Fictícia",
    contact: "outra@exemplo.com",
    description: "Pedido fictício.",
    details: parseDetails("data-rights", { right: "access" }),
  });
  const approver = {
    id: "encarregada-ficticia",
    name: "Encarregada Fictícia",
    role: "staff",
  };
  const blank = await approveDataRightsReplyWith(db, TENANT.slug, id, approver);
  assert.equal(blank.status, "error");

  await saveDraftReplyWith(
    db,
    TENANT.slug,
    id,
    "data-rights",
    "Texto alinhado.",
    "funcionario-ficticio",
  );
  assert.deepEqual(
    await approveDataRightsReplyWith(db, TENANT.slug, id, approver, NOW),
    { status: "ok" },
  );
  const [row] = await db
    .select()
    .from(serviceRequests)
    .where(eq(serviceRequests.id, id));
  const { approval } = parseDetails("data-rights", row?.details);
  assert.equal(approval?.text, "Texto alinhado.");
  assert.equal(approval?.byName, "Encarregada Fictícia");
  assert.ok(
    (await db.select().from(auditLog)).some(
      (a) => a.action === "data-rights.approve",
    ),
  );
});
