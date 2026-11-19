import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { and, eq } from "drizzle-orm";
import { getAct } from "@/core/acts/catalog.ts";
import { hashAccessKey } from "@/core/request/access-key.ts";
import { TENANTS } from "@/core/tenant/resolve.ts";
import type { Database } from "@/db/index.ts";
import { auditLog, serviceRequests } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  latestPickupWith,
  PickupError,
  registerPickupWith,
} from "./request-pickup.ts";
import {
  createServiceRequestWith,
  updateRequestStatusWith,
} from "./service-request.ts";

// Fictitious office and people only.
const TENANT = Object.values(TENANTS)[0] as NonNullable<
  (typeof TENANTS)[string]
>;
const ACTOR = "atendente";
let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

const input = (over: Record<string, string> = {}) => ({
  personName: "Marta Exemplo Souza",
  relation: "authorized",
  documentType: "cpf",
  documentNumber: "529.982.247-25",
  note: "Apresentou o original.",
  ...over,
});

async function newRequest() {
  const act = getAct("rcpn-certidao");
  if (!act) throw new Error("fixture: rcpn-certidao precisa existir");
  const created = await createServiceRequestWith(db, TENANT, act, {
    applicantName: "Rosa Almeida Fontes",
    contact: "rosa@exemplo.com",
    accessKeyHash: hashAccessKey(`chave-${Math.random()}`),
  });
  const [row] = await db
    .select({ id: serviceRequests.id })
    .from(serviceRequests)
    .where(eq(serviceRequests.protocolNumber, created.protocolNumber));
  return (row as { id: string }).id;
}

test("a retirada só se registra com o pedido aguardando retirada, e conclui o pedido", async () => {
  const id = await newRequest();
  await assert.rejects(
    registerPickupWith(db, TENANT.slug, id, input(), ACTOR),
    /aguardando retirada/,
  );
  assert.equal(await latestPickupWith(db, TENANT.slug, id), null);

  await updateRequestStatusWith(db, TENANT.slug, id, "ready-for-pickup", ACTOR);
  const saved = await registerPickupWith(db, TENANT.slug, id, input(), ACTOR);
  assert.equal(saved.personName, "Marta Exemplo Souza");
  // The full CPF is kept, as digits: it is the proof of who took it.
  assert.equal(saved.documentNumber, "52998224725");

  const [row] = await db
    .select({
      status: serviceRequests.status,
      closedAt: serviceRequests.closedAt,
    })
    .from(serviceRequests)
    .where(eq(serviceRequests.id, id));
  assert.equal(row?.status, "done");
  assert.ok(row?.closedAt);
  const read = await latestPickupWith(db, TENANT.slug, id);
  assert.equal(read?.relation, "authorized");
  assert.equal(read?.registeredBy, ACTOR);

  const trail = await db
    .select({ action: auditLog.action })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.targetId, id),
        eq(auditLog.action, "service-request.pickup"),
      ),
    );
  assert.equal(trail.length, 1);

  // Already closed: it cannot be registered again.
  await assert.rejects(
    registerPickupWith(db, TENANT.slug, id, input(), ACTOR),
    PickupError,
  );
});

test("dados errados são recusados e nada muda; outro cartório não alcança o pedido", async () => {
  const id = await newRequest();
  await updateRequestStatusWith(db, TENANT.slug, id, "ready-for-pickup", ACTOR);
  await assert.rejects(
    registerPickupWith(
      db,
      TENANT.slug,
      id,
      input({ documentNumber: "111.111.111-11" }),
      ACTOR,
    ),
    /CPF inválido/,
  );
  await assert.rejects(
    registerPickupWith(
      db,
      TENANT.slug,
      id,
      input({ personName: "Ana" }),
      ACTOR,
    ),
    /nome completo/,
  );
  await assert.rejects(
    registerPickupWith(db, "cartorio-vizinho", id, input(), ACTOR),
    /não encontrado/,
  );
  const [row] = await db
    .select({ status: serviceRequests.status })
    .from(serviceRequests)
    .where(eq(serviceRequests.id, id));
  assert.equal(row?.status, "ready-for-pickup");
  assert.equal(await latestPickupWith(db, TENANT.slug, id), null);
});
