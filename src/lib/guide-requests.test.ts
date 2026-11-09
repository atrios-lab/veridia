import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { sql } from "drizzle-orm";
import { getAct } from "@/core/acts/catalog.ts";
import { hashAccessKey } from "@/core/request/access-key.ts";
import { TENANTS } from "@/core/tenant/resolve.ts";
import type { Database } from "@/db/index.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  guideAlertSnapshotWith,
  listGuideRequestsWith,
  recordAlertSnapshotWith,
} from "./guide-requests.ts";
import {
  attachToRequestWith,
  createServiceRequestWith,
} from "./service-request.ts";

let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

const TENANT = TENANTS["cartorio-marinho"];
const GUIDE = getAct("notas-guia-recolhimento");
const OTHER = getAct("notas-ata-notarial");

// Fictitious people only (LGPD).
test("as guias pedidas pelo site ficam em Utilitários, com o aviso de novo e de atualizado", async () => {
  if (!GUIDE || !OTHER) throw new Error("catálogo incompleto");
  const guide = await createServiceRequestWith(db, TENANT, GUIDE, {
    applicantName: "Maria Exemplo da Silva",
    contact: "maria@exemplo.com",
    accessKeyHash: hashAccessKey("CHAVE-EXEMPLO"),
  });
  await createServiceRequestWith(db, TENANT, OTHER, {
    applicantName: "João Fictício de Souza",
    contact: "joao@exemplo.com",
    accessKeyHash: hashAccessKey("CHAVE-EXEMPLO-2"),
  });

  const rows = await listGuideRequestsWith(db, TENANT.slug);
  assert.deepEqual(
    rows.map((row) => row.protocolNumber),
    [guide.protocolNumber],
  );
  assert.equal(rows[0]?.citizenUpdatedAt, null);

  let alerts = await guideAlertSnapshotWith(db, TENANT.slug);
  assert.deepEqual(
    alerts.map((a) => a.kind),
    ["new"],
  );

  // The citizen sends a document later: the request reads as updated. The
  // file is dated in the past of "later" by pushing the request's own date back.
  await db.execute(
    sql`update service_requests set created_at = now() - interval '1 hour' where id = ${guide.id}`,
  );
  await attachToRequestWith(
    db,
    TENANT.slug,
    guide.id,
    [
      {
        storedName: "documento.pdf",
        displayName: "documento.pdf",
        path: "/tmp/documento.pdf",
        mimeType: "application/pdf",
        sizeBytes: 10,
      },
    ],
    "citizen",
  );
  alerts = await guideAlertSnapshotWith(db, TENANT.slug);
  assert.deepEqual(
    alerts.map((a) => a.kind),
    ["new", "update"],
  );
  assert.ok(
    (await listGuideRequestsWith(db, TENANT.slug))[0]?.citizenUpdatedAt,
  );
});

test("o aviso de pedido novo deixa de fora as guias e o que o balcão registrou", async () => {
  if (!GUIDE || !OTHER) throw new Error("catálogo incompleto");
  const online = await createServiceRequestWith(db, TENANT, OTHER, {
    applicantName: "Ana Exemplo Pereira",
    contact: "ana@exemplo.com",
    accessKeyHash: hashAccessKey("CHAVE-EXEMPLO-3"),
  });
  const counter = await createServiceRequestWith(db, TENANT, OTHER, {
    applicantName: "Carlos Fictício Lima",
    contact: "carlos@exemplo.com",
    accessKeyHash: hashAccessKey("CHAVE-EXEMPLO-4"),
  });
  await db.execute(
    sql`update service_requests set details = coalesce(details, '{}'::jsonb) || '{"channel":"counter"}'::jsonb where id = ${counter.id}`,
  );
  const guide = await createServiceRequestWith(db, TENANT, GUIDE, {
    applicantName: "Beatriz Exemplo Costa",
    contact: "beatriz@exemplo.com",
    accessKeyHash: hashAccessKey("CHAVE-EXEMPLO-5"),
  });

  const items = await recordAlertSnapshotWith(db, TENANT.slug, ["pedidos"]);
  const protocols = items.map((item) => item.protocolNumber);
  assert.ok(protocols.includes(online.protocolNumber));
  assert.ok(!protocols.includes(counter.protocolNumber));
  assert.ok(!protocols.includes(guide.protocolNumber));
  const mine = items.find((i) => i.protocolNumber === online.protocolNumber);
  assert.equal(mine?.channel, "pedidos");
  assert.equal(
    mine?.href,
    `/admin/pedidos/${encodeURIComponent(online.protocolNumber)}`,
  );

  // Who only works LGPD does not hear of the requests.
  assert.deepEqual(
    await recordAlertSnapshotWith(db, TENANT.slug, ["lgpd"]),
    [],
  );
  assert.deepEqual(await recordAlertSnapshotWith(db, TENANT.slug, []), []);
});
