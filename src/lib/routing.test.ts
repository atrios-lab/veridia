import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { and, eq } from "drizzle-orm";
import { getAct } from "@/core/acts/catalog.ts";
import { hashAccessKey } from "@/core/request/access-key.ts";
import { currentRouting, holderOf } from "@/core/routing/routing.ts";
import { TENANTS } from "@/core/tenant/resolve.ts";
import { user } from "@/db/auth-schema.ts";
import type { Database } from "@/db/index.ts";
import { auditLog, serviceRequestRoutings } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  assertMayConcludeWith,
  changeSectorsWith,
  editRoutingWith,
  holderAt,
  RoutingError,
  receiveWith,
  requestCitizenLineOn,
  routedToMeWith,
  routeWith,
  routingAlertsWith,
  routingsOfRequestWith,
  sectorsWith,
  setConclusionPolicyWith,
  setRequestCitizenLineWith,
  takeWith,
  waitingOnMe,
  withdrawRoutingWith,
} from "./routing.ts";
import { createServiceRequestWith, findByIdWith } from "./service-request.ts";

const TENANT = TENANTS["cartorio-marinho"];
const ATTRIBUTIONS = TENANT.attributions;
const FOUND = getAct("rcpn-certidao");
if (!FOUND) throw new Error("fixture: rcpn-certidao precisa existir");
const ACT = FOUND;

let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
  await db.insert(user).values([
    {
      id: "carlos",
      name: "Carlos Fictício",
      email: "carlos.direcionamento@exemplo.com",
      tenantSlug: TENANT.slug,
      role: "admin",
    },
    {
      id: "ana",
      name: "Ana Exemplo Moura",
      email: "ana.direcionamento@exemplo.com",
      tenantSlug: TENANT.slug,
      role: "substituto-legal",
      chatSector: "RCPN",
    },
    {
      id: "bruno",
      name: "Bruno Teste",
      email: "bruno.direcionamento@exemplo.com",
      tenantSlug: TENANT.slug,
      role: "staff",
      chatSector: "RCPN",
    },
    {
      id: "diego",
      name: "Diego Exemplar",
      email: "diego.direcionamento@exemplo.com",
      tenantSlug: TENANT.slug,
      role: "staff",
    },
  ]);
});
after(async () => close());

async function filed(name: string) {
  const { id } = await createServiceRequestWith(db, TENANT, ACT, {
    applicantName: name,
    contact: `${name.toLowerCase().replace(/\s/g, ".")}@exemplo.com`,
    accessKeyHash: hashAccessKey(`chave-${name}`),
  });
  return id;
}

const SIGN = {
  sectorId: "atribuicao-rcpn",
  purpose: "sign" as const,
  actId: null,
  priority: "attention" as const,
  dueAt: null,
  note: "Certidão pronta, falta assinar.",
};

test("pegar, direcionar e receber: com quem está muda e cada passo vai à auditoria", async () => {
  const requestId = await filed("Joana Exemplo");
  await takeWith(db, TENANT.slug, ATTRIBUTIONS, requestId, { id: "carlos" });
  let holder = holderOf(
    currentRouting(await routingsOfRequestWith(db, TENANT.slug, requestId)),
  );
  assert.equal(holder?.userId, "carlos");

  const sent = await routeWith(
    db,
    TENANT.slug,
    ATTRIBUTIONS,
    { requestId, toUserId: "ana", ...SIGN },
    "carlos",
  );
  assert.equal(sent.fromUserId, "carlos");
  assert.equal(sent.sectorLabel, "Registro Civil");
  // Ana sees it waiting on her; Carlos sees it as sent.
  const forAna = await routedToMeWith(db, TENANT.slug, ATTRIBUTIONS, {
    id: "ana",
    chatSector: "RCPN",
  });
  assert.equal(waitingOnMe(forAna), 1);
  const forCarlos = await routedToMeWith(db, TENANT.slug, ATTRIBUTIONS, {
    id: "carlos",
  });
  assert.equal(forCarlos[0]?.bucket, "sent");

  // Bruno, of the same sector, cannot receive what was sent to Ana.
  await assert.rejects(
    receiveWith(db, TENANT.slug, ATTRIBUTIONS, sent.id, {
      id: "bruno",
      chatSector: "RCPN",
    }),
    RoutingError,
  );
  await receiveWith(db, TENANT.slug, ATTRIBUTIONS, sent.id, {
    id: "ana",
    chatSector: "RCPN",
  });
  holder = holderOf(
    currentRouting(await routingsOfRequestWith(db, TENANT.slug, requestId)),
  );
  assert.deepEqual(holder, {
    userId: "ana",
    pending: false,
    sectorId: "atribuicao-rcpn",
  });

  const actions = (
    await db
      .select({ action: auditLog.action })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.tenantSlug, TENANT.slug),
          eq(auditLog.targetId, requestId),
        ),
      )
  ).map((r) => r.action);
  for (const action of [
    "service-request.routing-take",
    "service-request.routing",
    "service-request.routing-receive",
  ]) {
    assert.ok(actions.includes(action), action);
  }
});

test("pegar para mim é livre e avisa quem estava com o pedido", async () => {
  const requestId = await filed("Pedro Exemplo");
  const sent = await routeWith(
    db,
    TENANT.slug,
    ATTRIBUTIONS,
    { requestId, toUserId: "ana", ...SIGN },
    "carlos",
  );
  await receiveWith(db, TENANT.slug, ATTRIBUTIONS, sent.id, { id: "ana" });
  await takeWith(db, TENANT.slug, ATTRIBUTIONS, requestId, {
    id: "bruno",
    chatSector: "RCPN",
  });
  const alerts = await routingAlertsWith(
    db,
    TENANT.slug,
    ATTRIBUTIONS,
    { id: "ana" },
    false,
  );
  assert.ok(alerts.some((a) => a.kind === "taken" && a.who === "Bruno Teste"));
  await assert.rejects(
    takeWith(db, TENANT.slug, ATTRIBUTIONS, requestId, { id: "bruno" }),
    /já está com você/,
  );
});

test("fila do setor: o primeiro que recebe fica com o pedido", async () => {
  const requestId = await filed("Lia Exemplo");
  const queued = await routeWith(
    db,
    TENANT.slug,
    ATTRIBUTIONS,
    { requestId, toUserId: null, ...SIGN },
    "carlos",
  );
  const forBruno = await routedToMeWith(db, TENANT.slug, ATTRIBUTIONS, {
    id: "bruno",
    chatSector: "RCPN",
  });
  assert.ok(forBruno.some((i) => i.bucket === "queue"));
  // Diego is not of the sector, and the sector has people.
  const forDiego = await routedToMeWith(db, TENANT.slug, ATTRIBUTIONS, {
    id: "diego",
  });
  assert.ok(!forDiego.some((i) => i.requestId === requestId));
  await receiveWith(db, TENANT.slug, ATTRIBUTIONS, queued.id, {
    id: "bruno",
    chatSector: "RCPN",
  });
  await assert.rejects(
    receiveWith(db, TENANT.slug, ATTRIBUTIONS, queued.id, {
      id: "ana",
      chatSector: "RCPN",
    }),
    /já recebeu/,
  );
});

test("alterar guarda o anterior; desfazer não apaga e devolve o pedido", async () => {
  const requestId = await filed("Rita Exemplo");
  await takeWith(db, TENANT.slug, ATTRIBUTIONS, requestId, { id: "carlos" });
  const sent = await routeWith(
    db,
    TENANT.slug,
    ATTRIBUTIONS,
    { requestId, toUserId: "ana", ...SIGN, purpose: "review" },
    "carlos",
  );
  await assert.rejects(
    editRoutingWith(
      db,
      TENANT.slug,
      ATTRIBUTIONS,
      sent.id,
      { toUserId: "ana", ...SIGN },
      "ana",
    ),
    RoutingError,
  );
  await editRoutingWith(
    db,
    TENANT.slug,
    ATTRIBUTIONS,
    sent.id,
    { toUserId: "ana", ...SIGN },
    "carlos",
  );
  const [edited] = await db
    .select()
    .from(serviceRequestRoutings)
    .where(eq(serviceRequestRoutings.id, sent.id));
  assert.equal(edited?.purpose, "sign");
  assert.equal(
    (edited?.history as { before: { purpose: string } }[])[0]?.before.purpose,
    "review",
  );
  await withdrawRoutingWith(db, TENANT.slug, sent.id, "carlos");
  const rows = await routingsOfRequestWith(db, TENANT.slug, requestId);
  assert.equal(rows.length, 2);
  assert.equal(holderOf(currentRouting(rows))?.userId, "carlos");
});

test("quem deu andamento sem ser o responsável é reconhecido pelo histórico", async () => {
  const requestId = await filed("Caio Exemplo");
  const taken = await takeWith(db, TENANT.slug, ATTRIBUTIONS, requestId, {
    id: "carlos",
  });
  const rows = await routingsOfRequestWith(db, TENANT.slug, requestId);
  assert.equal(
    holderAt(rows, new Date(taken.createdAt.getTime() + 1000)),
    "carlos",
  );
  assert.equal(
    holderAt(rows, new Date(taken.createdAt.getTime() - 1000)),
    null,
  );
});

test("setores: criar, renomear, apagar sem perder o nome antigo e escolher quem está", async () => {
  await changeSectorsWith(
    db,
    TENANT.slug,
    ATTRIBUTIONS,
    { op: "create", label: "Conferência" },
    "carlos",
  );
  await changeSectorsWith(
    db,
    TENANT.slug,
    ATTRIBUTIONS,
    { op: "rename", id: "caixa", label: "Tesouraria" },
    "carlos",
  );
  await changeSectorsWith(
    db,
    TENANT.slug,
    ATTRIBUTIONS,
    { op: "hide", id: "balcao" },
    "carlos",
  );
  await changeSectorsWith(
    db,
    TENANT.slug,
    ATTRIBUTIONS,
    { op: "members", userId: "diego", sectorIds: ["conferencia"] },
    "carlos",
  );
  const { sectors, stored } = await sectorsWith(db, TENANT.slug, ATTRIBUTIONS);
  assert.ok(sectors.some((s) => s.id === "conferencia" && !s.hiddenAt));
  assert.equal(sectors.find((s) => s.id === "caixa")?.label, "Tesouraria");
  assert.ok(sectors.find((s) => s.id === "balcao")?.hiddenAt);
  assert.deepEqual(stored?.members?.diego, ["conferencia"]);
  await assert.rejects(
    changeSectorsWith(
      db,
      TENANT.slug,
      ATTRIBUTIONS,
      { op: "create", label: "conferência" },
      "carlos",
    ),
    /Já existe/,
  );
});

test("quem assina e conclui: lista com o Tabelião sempre dentro", async () => {
  await assertMayConcludeWith(db, TENANT.slug, { id: "diego", role: "staff" });
  const policy = await setConclusionPolicyWith(
    db,
    TENANT.slug,
    { mode: "selected", userIds: ["ana"] },
    "carlos",
  );
  assert.deepEqual(policy, { mode: "selected", userIds: ["carlos", "ana"] });
  await assert.rejects(
    assertMayConcludeWith(db, TENANT.slug, { id: "diego", role: "staff" }),
    /Carlos Fictício, Ana Exemplo Moura/,
  );
  await assertMayConcludeWith(db, TENANT.slug, {
    id: "ana",
    role: "substituto-legal",
  });
  await setConclusionPolicyWith(db, TENANT.slug, { mode: "all" }, "carlos");
});

test("a linha do cidadão desliga no pedido", async () => {
  const requestId = await filed("Beto Exemplo");
  await setRequestCitizenLineWith(db, TENANT.slug, requestId, false, "carlos");
  const request = await findByIdWith(db, TENANT.slug, requestId);
  assert.equal(requestCitizenLineOn(request?.details), false);
});
