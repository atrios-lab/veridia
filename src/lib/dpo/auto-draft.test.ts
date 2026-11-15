import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { MockLanguageModelV4 } from "ai/test";
import { eq } from "drizzle-orm";
import { parseDetails } from "@/core/request/kinds.ts";
import { TENANTS } from "@/core/tenant/resolve.ts";
import type { Database } from "@/db/index.ts";
import { auditLog, serviceRequests } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import { createRecordWith, saveDraftReplyWith } from "../service-request.ts";
import { autoDraftDataRightsWith } from "./auto-draft.ts";

// Fictitious titular only (LGPD).
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
const model = (text: string) =>
  new MockLanguageModelV4({
    doGenerate: async (options) => {
      sent = JSON.stringify(options.prompt);
      return {
        content: [{ type: "text", text }],
        finishReason: { unified: "stop", raw: undefined },
        usage,
        warnings: [],
      };
    },
  });
const models = () => ({
  triage: model("{}"),
  answer: model(
    "Prezado(a) [TITULAR], quanto ao protocolo [PROTOCOLO], segue a resposta.",
  ),
});
const context = async () => "Serventia fictícia.";

let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

test("a resposta LGPD sai do que foi alinhado, sem o nome do titular ir ao modelo", async () => {
  const { id, protocolNumber } = await createRecordWith(
    db,
    TENANT,
    "data-rights",
    {
      applicantName: "Titular Fictícia",
      contact: "titular@exemplo.com",
      description: "Quero saber quais dados meus vocês têm.",
      details: parseDetails("data-rights", { right: "access" }),
    },
  );
  assert.equal(
    await autoDraftDataRightsWith(db, models(), TENANT, id, NOW, context),
    "drafted",
  );
  assert.doesNotMatch(sent, /Titular Fictícia|titular@exemplo/);
  const [row] = await db
    .select()
    .from(serviceRequests)
    .where(eq(serviceRequests.id, id));
  const details = parseDetails("data-rights", row?.details);
  assert.equal(details.draftAuto, true);
  assert.match(details.draftReply ?? "", /Prezado\(a\) Titular Fictícia/);
  assert.match(details.draftReply ?? "", new RegExp(protocolNumber));
  const trail = (await db.select().from(auditLog)).map((a) => a.action);
  assert.ok(trail.includes("data-rights.auto-draft"));

  // Asked again after more conversation, the Assistente Virtual's own
  // draft is redone with what was aligned.
  assert.equal(
    await autoDraftDataRightsWith(
      db,
      models(),
      TENANT,
      id,
      NOW,
      context,
      "Equipe: Só há o cadastro do pedido de certidão.",
    ),
    "drafted",
  );
  assert.match(sent, /pedido de certidão/);

  // A person's save clears the mark, and that draft is never replaced.
  await saveDraftReplyWith(
    db,
    TENANT.slug,
    id,
    "data-rights",
    "Texto revisado.",
    "encarregada",
  );
  const [saved] = await db
    .select()
    .from(serviceRequests)
    .where(eq(serviceRequests.id, id));
  assert.equal(parseDetails("data-rights", saved?.details).draftAuto, false);
  assert.equal(
    await autoDraftDataRightsWith(db, models(), TENANT, id, NOW, context),
    "skipped",
  );
});
