import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { AI_SUSPENDED } from "@/core/qualificacao/revisao-base.ts";
import type { Database } from "@/db/index.ts";
import { createTestDb } from "@/db/test-db.ts";
import { aiBlockedWith, setAiPolicyWith } from "./ai.ts";
import { getAiPlatformWith, setAiPlatformWith } from "./ai-platform.ts";

const OFFICE = "cartorio-ia-teste";
let db: Database;
let close: () => Promise<void>;
const savedKey = process.env.ANTHROPIC_API_KEY;
before(async () => {
  ({ db, close } = await createTestDb());
  // Only for the check of the switches: no call is made in this test.
  process.env.ANTHROPIC_API_KEY = "chave-de-teste";
});
after(async () => {
  if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = savedKey;
  await close();
});

test("a suspensão da plataforma vale acima do botão do Tabelião e pode voltar a qualquer momento", async () => {
  assert.deepEqual(
    { ...(await getAiPlatformWith(db, OFFICE)) },
    { aiAllowed: true, noteReview: "ia" },
  );
  await setAiPolicyWith(db, OFFICE, true, "", "tabeliao");
  assert.equal(await aiBlockedWith(db, OFFICE), null);

  await setAiPlatformWith(
    db,
    OFFICE,
    { aiAllowed: false, noteReview: "base", reason: "teto do mês" },
    "conta-mestre",
  );
  assert.equal(await aiBlockedWith(db, OFFICE), AI_SUSPENDED);
  assert.equal((await getAiPlatformWith(db, OFFICE)).noteReview, "base");

  await setAiPlatformWith(
    db,
    OFFICE,
    { aiAllowed: true, noteReview: "desligada", reason: "" },
    "conta-mestre",
  );
  assert.equal(await aiBlockedWith(db, OFFICE), null);
  assert.equal((await getAiPlatformWith(db, OFFICE)).noteReview, "desligada");
});

test("mudar só a análise das notas mantém a IA como estava", async () => {
  const office = "cartorio-ia-parcial";
  await setAiPlatformWith(
    db,
    office,
    { aiAllowed: false, reason: "teto" },
    "conta-mestre",
  );
  await setAiPlatformWith(
    db,
    office,
    { noteReview: "base", reason: "" },
    "conta-mestre",
  );
  const policy = await getAiPlatformWith(db, office);
  assert.equal(policy.aiAllowed, false);
  assert.equal(policy.noteReview, "base");
});
