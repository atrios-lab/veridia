import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { type Database, db } from "@/db/index.ts";
import { demoOutbox } from "@/db/schema.ts";

// What the demonstration office would have sent (see `demo_outbox` and
// `sendEmailWith`): read by the screen that shows one message and by the
// history of each record. Always scoped by office: the rows of one office
// are never read from another's panel.

export type DemoEmail = typeof demoOutbox.$inferSelect;

/** The office's held messages, newest first. */
export async function listDemoEmailsWith(
  database: Database,
  tenantSlug: string,
  limit = 100,
): Promise<DemoEmail[]> {
  return database
    .select()
    .from(demoOutbox)
    .where(eq(demoOutbox.tenantSlug, tenantSlug))
    .orderBy(desc(demoOutbox.createdAt))
    .limit(limit);
}

/** One held message, if it belongs to this office. */
export async function findDemoEmailWith(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<DemoEmail | undefined> {
  const [row] = await database
    .select()
    .from(demoOutbox)
    .where(and(eq(demoOutbox.tenantSlug, tenantSlug), eq(demoOutbox.id, id)));
  return row;
}

/** The messages held about one record, oldest first, for its history. */
export async function demoEmailsAboutWith(
  database: Database,
  tenantSlug: string,
  related: { kind: "request" | "appointment"; protocol: string },
): Promise<DemoEmail[]> {
  return database
    .select()
    .from(demoOutbox)
    .where(
      and(
        eq(demoOutbox.tenantSlug, tenantSlug),
        eq(demoOutbox.relatedKind, related.kind),
        eq(demoOutbox.relatedProtocol, related.protocol),
      ),
    )
    .orderBy(demoOutbox.createdAt);
}

export const listDemoEmails = (tenantSlug: string, limit?: number) =>
  listDemoEmailsWith(db, tenantSlug, limit);
export const findDemoEmail = (tenantSlug: string, id: string) =>
  findDemoEmailWith(db, tenantSlug, id);
export const demoEmailsAbout = (
  tenantSlug: string,
  related: { kind: "request" | "appointment"; protocol: string },
) => demoEmailsAboutWith(db, tenantSlug, related);
