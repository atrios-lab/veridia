import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { DPO_COPY } from "@/core/dpo/copy.ts";
import { usageMonth } from "@/core/dpo/quota.ts";
import { user } from "@/db/auth-schema.ts";
import type { Database } from "@/db/index.ts";
import {
  dpoConversations,
  dpoMessages,
  dpoMonthlyUsage,
  dpoTenantSettings,
} from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  askDpoWith,
  type DpoEvent,
  type DpoModels,
  draftReplyWith,
} from "./assistant.ts";
import {
  countUsageWith,
  listMessagesWith,
  listOwnConversationsWith,
  monthUsageWith,
  purgeConversationsBeforeWith,
  setMonthlyLimitWith,
} from "./store.ts";

const TENANT = "cartorio-marinho";
const NOW = new Date("2026-11-15T15:00:00Z");
const MONTH = usageMonth(NOW);

const usage = {
  inputTokens: {
    total: 10,
    noCache: 10,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 10, text: 10, reasoning: undefined },
};

function triageModel(inScope: boolean) {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            inScope,
            searchQuery: inScope ? "eliminação dados titular" : "",
          }),
        },
      ],
      finishReason: { unified: "stop", raw: undefined },
      usage,
      warnings: [],
    }),
  });
}

function answerModel(text: string, opts: { fail?: boolean } = {}) {
  return new MockLanguageModelV4({
    doStream: async () => {
      if (opts.fail) throw new Error("provedor fora do ar");
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: "text-start", id: "t" },
            { type: "text-delta", id: "t", delta: text },
            { type: "text-end", id: "t" },
            {
              type: "finish",
              finishReason: { unified: "stop", raw: undefined },
              logprobs: undefined,
              usage,
            },
          ],
        }),
      };
    },
    doGenerate: async () => ({
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: undefined },
      usage,
      warnings: [],
    }),
  });
}

function models(
  inScope: boolean,
  text: string,
  opts?: { fail?: boolean },
): DpoModels & {
  triage: MockLanguageModelV4;
  answer: MockLanguageModelV4;
} {
  return { triage: triageModel(inScope), answer: answerModel(text, opts) };
}

async function collect(
  generator: AsyncGenerator<DpoEvent>,
): Promise<DpoEvent[]> {
  const events: DpoEvent[] = [];
  for await (const event of generator) events.push(event);
  return events;
}

function ask(
  database: Database,
  m: DpoModels,
  message: string,
  overrides: Partial<Parameters<typeof askDpoWith>[2]> = {},
) {
  return collect(
    askDpoWith(database, m, {
      tenantSlug: TENANT,
      userId: "escrevente-1",
      userRole: "staff",
      conversationId: null,
      message,
      officeContext: "Data de hoje: 15/11/2026.",
      now: NOW,
      ...overrides,
    }),
  );
}

/** Everything the mock models were sent, as one string. */
function sentToModels(m: {
  triage: MockLanguageModelV4;
  answer: MockLanguageModelV4;
}): string {
  return JSON.stringify([
    m.triage.doGenerateCalls,
    m.answer.doStreamCalls,
    m.answer.doGenerateCalls,
  ]);
}

let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
  for (const id of ["escrevente-1", "escrevente-2", "plataforma"]) {
    await db.insert(user).values({
      id,
      name: `Pessoa ${id}`,
      email: `${id}@exemplo.com`,
      tenantSlug: TENANT,
    });
  }
});
after(async () => {
  await close();
});
beforeEach(async () => {
  await db.delete(dpoMessages);
  await db.delete(dpoConversations);
  await db.delete(dpoMonthlyUsage);
  await db.delete(dpoTenantSettings);
});

test("an answer is masked before the models, stored masked, with its sources checked", async () => {
  const m = models(
    true,
    "A serventia conserva o registro [[fonte:lgpd-art-18]]. Prazo inventado [[fonte:lgpd-art-999]].",
  );
  const events = await ask(
    db,
    m,
    "O titular 123.456.789-09 (maria@exemplo.com) pediu a eliminação dos dados do registro.",
  );

  const start = events.find((e) => e.type === "start");
  assert.ok(start && start.type === "start");
  assert.equal(
    start.maskedText,
    "O titular [CPF] ([E-MAIL]) pediu a eliminação dos dados do registro.",
  );
  assert.equal(
    start.maskedNotice,
    "Ocultamos 1 e-mail e 1 CPF desta mensagem.",
  );

  const sent = sentToModels(m);
  assert.doesNotMatch(sent, /123\.456\.789-09|12345678909/);
  assert.doesNotMatch(sent, /maria@exemplo\.com/);

  const done = events.at(-1);
  assert.ok(done && done.type === "done");
  assert.equal(
    done.text,
    "A serventia conserva o registro [[fonte:lgpd-art-18]]. Prazo inventado.",
  );
  assert.deepEqual(
    done.sources.map((s) => s.id),
    ["lgpd-art-18"],
  );
  assert.equal(done.noSource, false);
  assert.deepEqual(done.usage, { answered: 1, limit: 300 });

  const [conversation] = await listOwnConversationsWith(db, {
    tenantSlug: TENANT,
    userId: "escrevente-1",
  });
  const stored = await listMessagesWith(db, conversation.id);
  assert.equal(stored.length, 2);
  assert.doesNotMatch(JSON.stringify(stored), /123\.456|maria@/);
  assert.deepEqual(stored[1].invalidCitations, ["lgpd-art-999"]);
  assert.deepEqual(await monthUsageWith(db, TENANT, MONTH), {
    answered: 1,
    refused: 0,
  });
});

test("off topic is refused without calling the answering model or spending the ceiling", async () => {
  const m = models(false, "nunca");
  const events = await ask(db, m, "Me passe uma receita de bolo de milho");
  assert.deepEqual(events.at(-1), { type: "refused", text: DPO_COPY.refusal });
  assert.equal(m.answer.doStreamCalls.length, 0);
  assert.deepEqual(await monthUsageWith(db, TENANT, MONTH), {
    answered: 0,
    refused: 1,
  });
});

test("a provider failure shows an error and spends nothing", async () => {
  const m = models(true, "", { fail: true });
  const events = await ask(db, m, "O que faz o encarregado?");
  assert.deepEqual(events.at(-1), { type: "error", message: DPO_COPY.failed });
  assert.deepEqual(await monthUsageWith(db, TENANT, MONTH), {
    answered: 0,
    refused: 0,
  });
});

test("at the ceiling no model is called, and the platform can raise it", async () => {
  await db
    .insert(dpoMonthlyUsage)
    .values({ tenantSlug: TENANT, month: MONTH, answered: 300 });
  const m = models(true, "x [[fonte:lgpd-art-41]]");
  const blocked = await ask(db, m, "O que faz o encarregado?");
  assert.equal(blocked[0].type, "blocked");
  assert.match(
    blocked[0].type === "blocked" ? blocked[0].message : "",
    /volta em 01\/12\/2026/,
  );
  assert.equal(m.triage.doGenerateCalls.length, 0);

  await setMonthlyLimitWith(db, {
    tenantSlug: TENANT,
    limit: 500,
    actorId: "plataforma",
  });
  const answered = await ask(db, m, "O que faz o encarregado?");
  assert.equal(answered.at(-1)?.type, "done");
});

test("a colleague's conversation cannot be continued", async () => {
  const first = await ask(
    db,
    models(true, "ok [[fonte:lgpd-art-41]]"),
    "O que faz o encarregado?",
  );
  const start = first.find((e) => e.type === "start");
  assert.ok(start && start.type === "start");
  const other = await ask(db, models(true, "x"), "e o prazo?", {
    userId: "escrevente-2",
    conversationId: start.conversationId,
  });
  assert.deepEqual(other, [
    { type: "error", message: "Conversa não encontrada." },
  ]);
  assert.deepEqual(
    await listOwnConversationsWith(db, {
      tenantSlug: TENANT,
      userId: "escrevente-2",
    }),
    [],
  );
});

test("the reply draft sends only the right and the masked note", async () => {
  const m = models(
    true,
    "Prezado(a) [TITULAR], quanto ao protocolo [PROTOCOLO]...",
  );
  const result = await draftReplyWith(db, m, {
    tenantSlug: TENANT,
    userId: "escrevente-1",
    userRole: "staff",
    right: "deletion",
    note: "o titular informou o telefone (84) 99876-5432",
    officeContext: "Data de hoje: 15/11/2026.",
    now: NOW,
  });
  assert.deepEqual(result, {
    status: "ok",
    draft: "Prezado(a) [TITULAR], quanto ao protocolo [PROTOCOLO]...",
  });
  const sent = sentToModels(m);
  assert.match(sent, /eliminação \(exclusão\) de dados/);
  assert.doesNotMatch(sent, /99876/);
  assert.deepEqual(await monthUsageWith(db, TENANT, MONTH), {
    answered: 1,
    refused: 0,
  });
});

test("conversations older than the cutoff are purged with their messages", async () => {
  await ask(
    db,
    models(true, "ok [[fonte:lgpd-art-41]]"),
    "O que faz o encarregado?",
  );
  assert.equal(
    await purgeConversationsBeforeWith(db, new Date("2026-11-01T00:00:00Z")),
    0,
  );
  assert.equal(
    await purgeConversationsBeforeWith(db, new Date("2027-12-01T00:00:00Z")),
    1,
  );
  assert.equal((await db.select().from(dpoMessages)).length, 0);
});

test("usage increments add up when they arrive together", async () => {
  await Promise.all(
    Array.from({ length: 5 }, () =>
      countUsageWith(db, TENANT, MONTH, "answered"),
    ),
  );
  await countUsageWith(db, "outra-serventia", MONTH, "answered");
  assert.deepEqual(await monthUsageWith(db, TENANT, MONTH), {
    answered: 5,
    refused: 0,
  });
});
