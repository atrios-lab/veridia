import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import JSZip from "jszip";
import { getAct } from "@/core/acts/catalog.ts";
import { hashAccessKey } from "@/core/request/access-key.ts";
import { TENANTS } from "@/core/tenant/resolve.ts";
import type { Database } from "@/db/index.ts";
import {
  auditLog,
  serviceRequestAttachments,
  serviceRequests,
} from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  listRequestFilesDueWith,
  markRequestFilesSavedWith,
  undoRequestFilesSavedWith,
  zipRequestFilesWith,
} from "./request-files-due.ts";
import {
  attachToRequestWith,
  createServiceRequestWith,
} from "./service-request.ts";

const TENANT = TENANTS["cartorio-marinho"];
const FOUND = getAct("rcpn-certidao");
if (!FOUND)
  throw new Error("fixture: rcpn-certidao precisa existir no catálogo");
const ACT = FOUND;

let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

const TODAY = "2026-11-22";

async function closedRequest(
  name: string,
  closedAt: string,
  files: string[],
): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "veridia-due-"));
  const request = await createServiceRequestWith(db, TENANT, ACT, {
    applicantName: name,
    contact: `${name.toLowerCase()}@exemplo.com`,
    accessKeyHash: hashAccessKey(`chave-${name}`),
  });
  const stored = [];
  for (const file of files) {
    const path = join(dir, file);
    await writeFile(path, `%PDF-1.4 ${file}`);
    stored.push({
      storedName: file,
      displayName: file.replace(/\.pdf$/, ""),
      path,
      mimeType: "application/pdf",
      sizeBytes: 12,
    });
  }
  await attachToRequestWith(db, TENANT.slug, request.id, stored, "office");
  await db
    .update(serviceRequests)
    .set({ status: "done", closedAt: new Date(closedAt) })
    .where(eq(serviceRequests.id, request.id));
  // Sent before the closing: the 90 days count from the closing.
  await db
    .update(serviceRequestAttachments)
    .set({ createdAt: new Date(Date.parse(closedAt) - 86_400_000) })
    .where(eq(serviceRequestAttachments.requestId, request.id));
  return request.id;
}

test("lembra todo dia nos últimos 10 dias, até baixar ou clicar em Já salvei", async () => {
  // Closed 85 days ago, files sent before: 5 days left of the 90.
  const soon = await closedRequest("Iara", "2026-08-29T15:00:00Z", [
    "requerimento.pdf",
    "comprovante.pdf",
  ]);
  // Closed 40 days ago: 50 days left, no reminder yet.
  await closedRequest("Jonas", "2026-10-13T15:00:00Z", ["certidao.pdf"]);

  const due = await listRequestFilesDueWith(db, TENANT.slug, TODAY, [
    "service-request",
  ]);
  assert.deepEqual(
    due.map((d) => [d.requestId, d.daysLeft, d.fileCount]),
    [[soon, 5, 2]],
  );
  assert.equal(due[0]?.until, "2026-11-27");

  // The next day it is still there: it is computed when the panel opens.
  assert.equal(
    (
      await listRequestFilesDueWith(db, TENANT.slug, "2026-11-23", [
        "service-request",
      ])
    ).length,
    1,
  );
  // A role without the requests sees nothing of them.
  assert.deepEqual(
    await listRequestFilesDueWith(db, TENANT.slug, TODAY, ["data-rights"]),
    [],
  );

  // "Já salvei" stops it; undoing brings it back; both stay in the audit.
  await markRequestFilesSavedWith(db, TENANT.slug, soon, "staff-1", "button");
  assert.deepEqual(
    await listRequestFilesDueWith(db, TENANT.slug, TODAY, ["service-request"]),
    [],
  );
  await undoRequestFilesSavedWith(db, TENANT.slug, soon, "staff-1");
  assert.equal(
    (await listRequestFilesDueWith(db, TENANT.slug, TODAY, ["service-request"]))
      .length,
    1,
  );
  const trail = await db
    .select({ action: auditLog.action, reason: auditLog.reason })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.targetId, soon),
        inArray(auditLog.action, [
          "service-request.files-saved",
          "service-request.files-saved-undone",
        ]),
      ),
    );
  assert.equal(trail.length, 2);
});

test("baixar tudo entrega um ZIP com cada arquivo e conta como salvo", async () => {
  const id = await closedRequest("Lia", "2026-08-30T15:00:00Z", [
    "contrato.pdf",
    "contrato.pdf",
  ]);
  const zip = await zipRequestFilesWith(db, TENANT.slug, id, TODAY);
  assert.ok(zip);
  const names = Object.keys((await JSZip.loadAsync(zip.bytes)).files).sort();
  assert.deepEqual(names, ["contrato (2).pdf", "contrato.pdf"]);

  await markRequestFilesSavedWith(db, TENANT.slug, id, "staff-1", "download");
  const due = await listRequestFilesDueWith(db, TENANT.slug, TODAY, [
    "service-request",
  ]);
  assert.equal(
    due.some((d) => d.requestId === id),
    false,
  );
  // Past the 90 days there is nothing left to download.
  assert.equal(
    await zipRequestFilesWith(db, TENANT.slug, id, "2027-01-30"),
    undefined,
  );
});
