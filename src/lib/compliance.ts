import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { effectiveAnswers, prefillAnswers } from "@/core/compliance/answers.ts";
import {
  type Answers,
  findSection,
  type Value,
} from "@/core/compliance/sections.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { type Database, db } from "@/db/index.ts";
import { complianceIntakes, tenantContent } from "@/db/schema.ts";
import { recordAudit, recordAuditWith } from "./audit.ts";
import type { StoredAttachment } from "./uploads.ts";

export interface IntakeAttachment extends StoredAttachment {
  id: string;
  createdAt: string;
}

export interface Intake {
  answers: Answers;
  /** ISO instant per section id: when the office last saved in it. */
  sectionUpdatedAt: Record<string, string>;
  attachments: IntakeAttachment[];
  submittedAt: Date | null;
  submittedVersion: number;
  submittedBy: string | null;
}

const EMPTY: Intake = {
  answers: {},
  sectionUpdatedAt: {},
  attachments: [],
  submittedAt: null,
  submittedVersion: 0,
  submittedBy: null,
};

/** The office's intake, or an empty one: "never opened" is a valid state. */
export async function getIntake(tenantSlug: string): Promise<Intake> {
  const [row] = await db
    .select()
    .from(complianceIntakes)
    .where(eq(complianceIntakes.tenantSlug, tenantSlug));
  if (!row) return EMPTY;
  return {
    answers: (row.answers ?? {}) as Answers,
    sectionUpdatedAt: (row.sectionUpdatedAt ?? {}) as Record<string, string>,
    attachments: (row.attachments ?? []) as IntakeAttachment[],
    submittedAt: row.submittedAt,
    submittedVersion: row.submittedVersion,
    submittedBy: row.submittedBy,
  };
}

/**
 * What Configurações already knows, in the intake's shape. The municipality
 * is stored upper case and without accents for the Pix payload, so it is
 * title-cased here; the office corrects the spelling if it needs to.
 */
export function prefillFor(tenant: Tenant): Answers {
  const city = tenant.municipality
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  return prefillAnswers({
    officialName: tenant.subtitle,
    tradeName: tenant.name,
    cns: tenant.cns,
    address: tenant.address ?? "",
    city: `${city} / RN`,
    phone: tenant.contacts.phone,
    email: tenant.contacts.email,
    attributions: tenant.attributions,
    ownerName: tenant.owner.name,
    dpoName: tenant.dpo.name,
    dpoEmail: tenant.dpo.email,
    revenue: tenant.revenue,
  });
}

/** The intake plus the answers as the screens show them. */
export async function loadIntake(
  tenant: Tenant,
): Promise<{ intake: Intake; answers: Answers }> {
  const intake = await getIntake(tenant.slug);
  return {
    intake,
    answers: effectiveAnswers(intake.answers, prefillFor(tenant)),
  };
}

function assertSection(sectionId: string): void {
  // `sectionId` is spliced raw into a jsonb path below, so it has to be one
  // of ours, not whatever the request carried.
  if (!findSection(sectionId))
    throw new Error(`seção desconhecida: ${sectionId}`);
}

/**
 * Saves one answer without reading the row first: two fields blurred in
 * quick succession each merge their own key into the section's object in
 * the database, so neither overwrites the other's save.
 */
export async function saveAnswer(
  tenantSlug: string,
  sectionId: string,
  name: string,
  value: Value,
  actorId: string,
): Promise<void> {
  assertSection(sectionId);
  const now = new Date();
  const patch = JSON.stringify({ [name]: value });
  const touched = JSON.stringify({ [sectionId]: now.toISOString() });
  await db
    .insert(complianceIntakes)
    .values({
      tenantSlug,
      answers: { [sectionId]: { [name]: value } },
      sectionUpdatedAt: { [sectionId]: now.toISOString() },
      updatedAt: now,
      updatedBy: actorId,
    })
    .onConflictDoUpdate({
      target: complianceIntakes.tenantSlug,
      set: {
        answers: sql`jsonb_set(${complianceIntakes.answers}, ${sql.raw(`'{${sectionId}}'`)}, coalesce(${complianceIntakes.answers} -> ${sectionId}, '{}'::jsonb) || ${patch}::jsonb)`,
        sectionUpdatedAt: sql`${complianceIntakes.sectionUpdatedAt} || ${touched}::jsonb`,
        updatedAt: now,
        updatedBy: actorId,
      },
    });
}

/**
 * Marks a section as visited: what turns a prefilled section from "não
 * iniciada" into "concluída" once the office confirms it, and what completes
 * Anexos, which has no field to save.
 */
export async function touchSection(
  tenantSlug: string,
  sectionId: string,
  actorId: string,
): Promise<void> {
  assertSection(sectionId);
  const now = new Date();
  const touched = JSON.stringify({ [sectionId]: now.toISOString() });
  await db
    .insert(complianceIntakes)
    .values({
      tenantSlug,
      sectionUpdatedAt: { [sectionId]: now.toISOString() },
      updatedAt: now,
      updatedBy: actorId,
    })
    .onConflictDoUpdate({
      target: complianceIntakes.tenantSlug,
      set: {
        sectionUpdatedAt: sql`${complianceIntakes.sectionUpdatedAt} || ${touched}::jsonb`,
        updatedAt: now,
        updatedBy: actorId,
      },
    });
}

/** Stamps the submission and bumps the version. The answers stay editable. */
export async function submitIntake(
  tenantSlug: string,
  actorId: string,
): Promise<{ version: number; submittedAt: Date }> {
  const now = new Date();
  const [row] = await db
    .update(complianceIntakes)
    .set({
      submittedAt: now,
      submittedVersion: sql`${complianceIntakes.submittedVersion} + 1`,
      submittedBy: actorId,
      updatedAt: now,
      updatedBy: actorId,
    })
    .where(eq(complianceIntakes.tenantSlug, tenantSlug))
    .returning({ version: complianceIntakes.submittedVersion });
  if (!row) throw new Error("intake inexistente");
  await recordAudit({
    tenantSlug,
    actorId,
    action: "compliance-intake.submit",
    targetType: "compliance-intake",
    targetId: String(row.version),
  });
  return { version: row.version, submittedAt: now };
}

export async function addAttachments(
  tenantSlug: string,
  stored: StoredAttachment[],
  actorId: string,
): Promise<void> {
  if (stored.length === 0) return;
  const now = new Date();
  const items: IntakeAttachment[] = stored.map((file) => ({
    ...file,
    id: randomUUID(),
    createdAt: now.toISOString(),
  }));
  await db
    .insert(complianceIntakes)
    .values({
      tenantSlug,
      attachments: items,
      sectionUpdatedAt: { anexos: now.toISOString() },
      updatedAt: now,
      updatedBy: actorId,
    })
    .onConflictDoUpdate({
      target: complianceIntakes.tenantSlug,
      set: {
        attachments: sql`${complianceIntakes.attachments} || ${JSON.stringify(items)}::jsonb`,
        sectionUpdatedAt: sql`${complianceIntakes.sectionUpdatedAt} || ${JSON.stringify({ anexos: now.toISOString() })}::jsonb`,
        updatedAt: now,
        updatedBy: actorId,
      },
    });
  await recordAudit({
    tenantSlug,
    actorId,
    action: "compliance-intake.attach",
    targetType: "compliance-intake",
  });
}

/** Removes the row's reference; the caller deletes the bytes afterwards. */
export async function removeAttachment(
  tenantSlug: string,
  id: string,
  actorId: string,
): Promise<IntakeAttachment | undefined> {
  const intake = await getIntake(tenantSlug);
  const removed = intake.attachments.find((a) => a.id === id);
  if (!removed) return undefined;
  await db
    .update(complianceIntakes)
    .set({
      attachments: intake.attachments.filter((a) => a.id !== id),
      updatedAt: new Date(),
      updatedBy: actorId,
    })
    .where(eq(complianceIntakes.tenantSlug, tenantSlug));
  await recordAudit({
    tenantSlug,
    actorId,
    action: "compliance-intake.detach",
    targetType: "compliance-intake",
    targetId: id,
  });
  return removed;
}

// ------------------------------------------------- "Já cumpri"

/** Where the office says it already complied (decision of 22/11/2026). */
export const COMPLIANCE_DONE_KEY = "compliance-done";

const doneEntrySchema = z.object({
  /** ISO day the office complied. */
  doneOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Whether it was entered in the Justiça Aberta, and when. */
  justicaAberta: z.boolean(),
  justicaAbertaOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .or(z.literal(""))
    .default(""),
  note: z.string().max(1000).default(""),
});
export type ComplianceDoneInput = z.infer<typeof doneEntrySchema>;

const doneStoredSchema = z.object({
  current: doneEntrySchema
    .extend({ at: z.string(), by: z.string() })
    .nullable(),
  /** Every previous version, kept when it is edited or withdrawn. */
  history: z
    .array(
      doneEntrySchema.extend({
        at: z.string(),
        by: z.string(),
        change: z.enum(["edited", "withdrawn"]),
      }),
    )
    .max(200)
    .default([]),
});
export type ComplianceDone = z.infer<typeof doneStoredSchema>;

export function parseComplianceDone(input: unknown): ComplianceDoneInput {
  return doneEntrySchema.parse(input);
}

export async function getComplianceDoneWith(
  database: Database,
  tenantSlug: string,
): Promise<ComplianceDone> {
  const [row] = await database
    .select({ published: tenantContent.published })
    .from(tenantContent)
    .where(
      and(
        eq(tenantContent.tenantSlug, tenantSlug),
        eq(tenantContent.key, COMPLIANCE_DONE_KEY),
      ),
    )
    .limit(1);
  const parsed = doneStoredSchema.safeParse(row?.published ?? {});
  return parsed.success ? parsed.data : { current: null, history: [] };
}

async function writeDone(
  database: Database,
  tenantSlug: string,
  value: ComplianceDone,
  actorId: string,
): Promise<void> {
  await database
    .insert(tenantContent)
    .values({
      tenantSlug,
      key: COMPLIANCE_DONE_KEY,
      published: value,
      updatedBy: actorId,
    })
    .onConflictDoUpdate({
      target: [tenantContent.tenantSlug, tenantContent.key],
      set: { published: value, updatedAt: new Date(), updatedBy: actorId },
    });
}

/**
 * Marks (or corrects) that the office complied, with the day and the
 * Justiça Aberta. A correction keeps the previous version in the history
 * and in the audit.
 */
export async function setComplianceDoneWith(
  database: Database,
  tenantSlug: string,
  input: ComplianceDoneInput,
  actorId: string,
): Promise<void> {
  const stored = await getComplianceDoneWith(database, tenantSlug);
  const now = new Date().toISOString();
  const history = stored.current
    ? [
        ...stored.history,
        { ...stored.current, change: "edited" as const },
      ].slice(-200)
    : stored.history;
  await writeDone(
    database,
    tenantSlug,
    { current: { ...input, at: now, by: actorId }, history },
    actorId,
  );
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: stored.current
      ? "compliance-intake.done-edited"
      : "compliance-intake.done",
    targetType: "compliance-intake",
    targetId: input.doneOn,
    reason: stored.current
      ? `antes: cumprido em ${stored.current.doneOn}, Justiça Aberta ${stored.current.justicaAberta ? "sim" : "não"}`
      : undefined,
  });
}

/** Withdraws the mark: the intake is pending again; the mark stays in the
 * history and in the audit. */
export async function withdrawComplianceDoneWith(
  database: Database,
  tenantSlug: string,
  actorId: string,
): Promise<void> {
  const stored = await getComplianceDoneWith(database, tenantSlug);
  if (!stored.current) return;
  await writeDone(
    database,
    tenantSlug,
    {
      current: null,
      history: [
        ...stored.history,
        { ...stored.current, change: "withdrawn" as const },
      ].slice(-200),
    },
    actorId,
  );
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "compliance-intake.done-withdrawn",
    targetType: "compliance-intake",
    targetId: stored.current.doneOn,
  });
}
