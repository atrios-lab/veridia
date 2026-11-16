import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { and, count, eq, getTableColumns, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { SUPERADMIN_TENANT_SLUG } from "@/core/auth/roles.ts";
import { COURSES_TENANT_SLUG } from "@/core/tenant/courses-tenant.ts";
import { TENANTS } from "@/core/tenant/resolve.ts";
import { user } from "@/db/auth-schema.ts";
import { type Database, fullSchema } from "@/db/index.ts";
import {
  appointments,
  auditLog,
  demoOutbox,
  messengerConversations,
  messengerMembers,
  officePublications,
  serviceRequestAttachments,
  serviceRequestRequirementMessages,
  serviceRequestRequirements,
  serviceRequests,
  signedDocuments,
  tenantContent,
  transparencyBulletins,
} from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  DEMO_RESET_KEPT,
  DEMO_RESET_TABLES,
  DemoResetRefused,
  resetDemoOfficeWith,
} from "@/lib/demo-reset.ts";
import { seedDemoOfficeWith, seedDeskRecordsWith } from "@/lib/demo-seed.ts";
import type { TenantStoredFile } from "@/lib/uploads.ts";

// ⚠️ The cleaning of the demonstration office deletes data (change
// painel-livre-para-alunos, PR 2). Against Postgres in process, with two
// offices in the same database: the courses office loses what the
// participants did and is seeded again; the other office, the accounts, the
// audit and what the kept tables hold do not change.

const DEMO = COURSES_TENANT_SLUG;
const OTHER = "cartorio-marinho";
const DAY = "2026-11-16" as const;
const ATRIOS = "atrios-platform";
const PARTICIPANT = "participant-1";

let db: Database;
let close: () => Promise<void>;

before(async () => {
  ({ db, close } = await createTestDb());
  await db.insert(user).values([
    {
      id: ATRIOS,
      name: "Átrios",
      email: "p@atrios.test",
      role: "superadmin",
      tenantSlug: SUPERADMIN_TENANT_SLUG,
    },
    {
      id: PARTICIPANT,
      name: "Ana Participante",
      email: "ana@example.com",
      role: "learner",
      tenantSlug: DEMO,
    },
  ]);
});

after(async () => {
  await close();
});

const tenantOf = (slug: string) => {
  const tenant = TENANTS[slug];
  if (!tenant) throw new Error(slug);
  return tenant;
};

async function rowsOf(table: PgTable, slug: string): Promise<number> {
  const column = (
    table as unknown as { tenantSlug: typeof serviceRequests.tenantSlug }
  ).tenantSlug;
  const [row] = await db
    .select({ n: count() })
    .from(table)
    .where(eq(column, slug));
  return row?.n ?? 0;
}

/** What participants leave behind on top of the seed: a requirement whose
 * resolution is an attachment that came with one of its messages (the two
 * tables point at each other), a held e-mail, a messenger conversation with
 * a member, an office setting and the platform's own key. */
async function participantsWork(slug: string) {
  const [request] = await db
    .select({ id: serviceRequests.id })
    .from(serviceRequests)
    .where(eq(serviceRequests.tenantSlug, slug))
    .limit(1);
  assert.ok(request);
  const [requirement] = await db
    .insert(serviceRequestRequirements)
    .values({ tenantSlug: slug, requestId: request.id, text: "Trazer RG" })
    .returning({ id: serviceRequestRequirements.id });
  const [message] = await db
    .insert(serviceRequestRequirementMessages)
    .values({
      tenantSlug: slug,
      requirementId: requirement.id,
      author: "citizen",
      body: "Segue o RG",
    })
    .returning({ id: serviceRequestRequirementMessages.id });
  const [attachment] = await db
    .insert(serviceRequestAttachments)
    .values({
      tenantSlug: slug,
      requestId: request.id,
      requirementId: requirement.id,
      requirementMessageId: message.id,
      storedName: "rg.pdf",
      displayName: "anexo-1",
      path: `anexos/${slug}/rg.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 10,
    })
    .returning({ id: serviceRequestAttachments.id });
  await db
    .update(serviceRequestRequirements)
    .set({ resolutionAttachmentId: attachment.id })
    .where(eq(serviceRequestRequirements.id, requirement.id));
  await db.insert(demoOutbox).values({
    tenantSlug: slug,
    to: "fulano@example.com",
    subject: "Exigência registrada",
    text: "Trazer RG",
  });
  const [conversation] = await db
    .insert(messengerConversations)
    .values({ tenantSlug: slug, createdBy: PARTICIPANT })
    .returning({ id: messengerConversations.id });
  await db
    .insert(messengerMembers)
    .values({ conversationId: conversation.id, userId: PARTICIPANT });
  await db.insert(tenantContent).values([
    { tenantSlug: slug, key: "office-contact", published: { phone: "1" } },
    {
      tenantSlug: slug,
      key: "platform-ai-policy",
      published: { aiAllowed: false },
    },
  ]);
}

test("every table of an office is either cleaned or kept, never both and never neither", () => {
  const cleaned = new Set<PgTable>(DEMO_RESET_TABLES);
  const kept = new Set<PgTable>(DEMO_RESET_KEPT.map((entry) => entry.table));
  for (const [name, table] of Object.entries(fullSchema)) {
    if (!is(table, PgTable)) continue;
    const columns = getTableColumns(table);
    const hasOffice = Object.values(columns).some(
      (column) => column.name === "tenant_slug",
    );
    if (!hasOffice) continue;
    const decided =
      Number(cleaned.has(table as PgTable)) +
      Number(kept.has(table as PgTable));
    assert.equal(
      decided,
      1,
      `${name}: put it in DEMO_RESET_TABLES or DEMO_RESET_KEPT (lib/demo-reset.ts), exactly one`,
    );
  }
});

test("a real office and Serra Verde are refused, and nothing is deleted", async () => {
  await seedDeskRecordsWith(db, tenantOf(OTHER), DAY);
  const before = await rowsOf(serviceRequests, OTHER);
  const deps = {
    listFiles: async () => {
      throw new Error("must not list");
    },
    seed: async () => {
      throw new Error("must not seed");
    },
  };
  for (const slug of [OTHER, "cartorio-demonstracao", "nao-existe", ""]) {
    await assert.rejects(
      resetDemoOfficeWith(db, slug, ATRIOS, deps),
      DemoResetRefused,
      slug,
    );
  }
  assert.equal(await rowsOf(serviceRequests, OTHER), before);
});

test("the demonstration office is emptied and seeded again; the rest stays", async () => {
  await seedDemoOfficeWith(db, tenantOf(DEMO), ATRIOS, DAY);
  await participantsWork(DEMO);
  await participantsWork(OTHER);
  // A signed document the cleaning keeps, and its file.
  await db.insert(signedDocuments).values({
    tenantSlug: DEMO,
    code: "OFICIO-1",
    title: "Ofício",
    originalName: "oficio.pdf",
    originalSha256: "0".repeat(64),
    pageCount: 1,
    filePath: `anexos/${DEMO}/assinados/oficio.pdf`,
    fileExpiresAt: new Date("2027-01-01T00:00:00Z"),
    createdBy: ATRIOS,
  });

  const otherBefore = {
    requests: await rowsOf(serviceRequests, OTHER),
    requirements: await rowsOf(serviceRequestRequirements, OTHER),
    outbox: await rowsOf(demoOutbox, OTHER),
    content: await rowsOf(tenantContent, OTHER),
  };
  const auditBefore =
    (await db.select({ n: count() }).from(auditLog))[0]?.n ?? 0;
  assert.ok((await rowsOf(serviceRequests, DEMO)) > 0);

  const removed: string[] = [];
  const file = (ref: string): TenantStoredFile => ({
    ref,
    remove: async () => {
      removed.push(ref);
    },
  });
  let seeded = 0;
  const result = await resetDemoOfficeWith(db, DEMO, ATRIOS, {
    listFiles: async (slug) => {
      assert.equal(slug, DEMO);
      return [
        file(`anexos/${DEMO}/rg.pdf`),
        file(`marca/${DEMO}/logo.png`),
        file(`anexos/${DEMO}/assinados/oficio.pdf`),
      ];
    },
    seed: async (database, tenant) => {
      assert.equal(tenant.slug, DEMO);
      // Right after the cleaning, before the seed: nothing of the office.
      for (const table of DEMO_RESET_TABLES) {
        if (table === tenantContent) continue;
        assert.equal(await rowsOf(table, DEMO), 0);
      }
      seeded++;
      await seedDemoOfficeWith(database, tenant, ATRIOS, DAY);
    },
  });

  // The office: the participants' work is gone, the seed is back.
  assert.equal(seeded, 1);
  assert.ok(result.rows.service_requests > 0);
  assert.equal(result.rows.messenger_members, 1);
  assert.equal(await rowsOf(serviceRequestRequirements, DEMO), 0);
  assert.equal(await rowsOf(serviceRequestRequirementMessages, DEMO), 0);
  assert.equal(await rowsOf(demoOutbox, DEMO), 0);
  assert.equal(await rowsOf(messengerConversations, DEMO), 0);
  assert.ok((await rowsOf(serviceRequests, DEMO)) > 0);
  assert.ok((await rowsOf(appointments, DEMO)) > 0);
  assert.ok((await rowsOf(officePublications, DEMO)) > 0);
  assert.ok((await rowsOf(transparencyBulletins, DEMO)) > 0);

  // Its settings go, the platform's key stays.
  const keys = (
    await db
      .select({ key: tenantContent.key })
      .from(tenantContent)
      .where(eq(tenantContent.tenantSlug, DEMO))
  ).map((row) => row.key);
  assert.deepEqual(keys, ["platform-ai-policy"]);

  // Kept tables and their files stay.
  assert.equal(await rowsOf(signedDocuments, DEMO), 1);
  assert.deepEqual(removed.sort(), [
    `anexos/${DEMO}/rg.pdf`,
    `marca/${DEMO}/logo.png`,
  ]);
  assert.equal(result.files, 2);

  // The other office is untouched.
  assert.deepEqual(
    {
      requests: await rowsOf(serviceRequests, OTHER),
      requirements: await rowsOf(serviceRequestRequirements, OTHER),
      outbox: await rowsOf(demoOutbox, OTHER),
      content: await rowsOf(tenantContent, OTHER),
    },
    otherBefore,
  );

  // Accounts stay; the audit only grows, with the cleaning on record.
  const people = await db.select({ id: user.id }).from(user);
  assert.deepEqual(
    people.map((p) => p.id).sort(),
    [ATRIOS, PARTICIPANT].sort(),
  );
  const auditAfter =
    (await db.select({ n: count() }).from(auditLog))[0]?.n ?? 0;
  assert.ok(auditAfter > auditBefore);
  const [entry] = await db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.action, "demo.reset"), eq(auditLog.targetId, DEMO)));
  assert.ok(entry);
  assert.equal(entry.actorId, ATRIOS);
  assert.equal(entry.tenantSlug, SUPERADMIN_TENANT_SLUG);
  assert.match(entry.reason ?? "", /service_requests: \d+/);
});
