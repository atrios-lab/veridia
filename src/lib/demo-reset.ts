import "server-only";
import { and, eq, inArray, isNotNull, notLike, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { SUPERADMIN_TENANT_SLUG } from "@/core/auth/roles.ts";
import { TENANTS } from "@/core/tenant/resolve.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { user } from "@/db/auth-schema.ts";
import type { Database } from "@/db/index.ts";
import {
  appointmentAttachments,
  appointmentMessages,
  appointmentNotes,
  appointments,
  attributionFiles,
  auditLog,
  auditNotes,
  auditNotificationFiles,
  auditNotifications,
  auditReviews,
  cedulaAnalyses,
  cedulaLearnedCues,
  censecActs,
  censecClosings,
  certificates,
  chatConversations,
  chatMessages,
  complianceIntakes,
  dailyBookEntries,
  dailyBookImports,
  dailyBookReports,
  demoOutbox,
  dpoConversations,
  dpoMessages,
  dpoMonthlyUsage,
  dpoTenantSettings,
  emailBounces,
  issDeclarations,
  knowledgePassages,
  knowledgeRequests,
  knowledgeSources,
  messengerConversations,
  messengerMembers,
  messengerMessages,
  messengerProfiles,
  messengerReactions,
  officeNews,
  officeNewsFiles,
  officePublications,
  officeStaff,
  paperOrders,
  paperSuppliers,
  qualificationDocumentReviews,
  qualificationLibrary,
  qualificationNotes,
  qualifications,
  rcpnCertidoes,
  rcpnHabilitacaoChanges,
  rcpnHabilitacoes,
  rcpnImports,
  rcpnPeople,
  rcpnRecordChanges,
  rcpnRecords,
  riActParties,
  riActs,
  riBooks,
  riExports,
  riFiles,
  riGeometries,
  riOnrImages,
  riPeople,
  riProperties,
  riProtocols,
  riSettings,
  securityPaperLots,
  securityPaperMovements,
  securityPaperReports,
  serviceRequestAttachments,
  serviceRequestCitizenViews,
  serviceRequestPickups,
  serviceRequestRequirementMessages,
  serviceRequestRequirements,
  serviceRequestRoutings,
  serviceRequests,
  signedDocumentSignatures,
  signedDocuments,
  signingCertificateSigners,
  signingCertificates,
  signingStations,
  stationCertificatePolicies,
  stationSignJobs,
  taxGuides,
  tenantBranding,
  tenantContent,
  titleTransferFilings,
  titleTransfers,
  transparencyBulletins,
  transparencyDocuments,
} from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";
import type { TenantStoredFile } from "./uploads.ts";

// ⚠️ DELETES DATA. The cleaning of the demonstration office (change
// painel-livre-para-alunos, PR 2): what the course participants did on its
// shared desk goes, and the office is seeded again as it started. Only the
// platform account starts it, by hand, from the cohorts screen; nothing runs
// it on a schedule (decision of 16/11/2026).
//
// What it may touch is written out below, table by table, in the order the
// foreign keys need. What it never touches is written out too, each with its
// reason, and demo-reset.test.ts fails while any table of an office is in
// neither list: a table added later is never wiped, or kept, by accident.

/** Every table of the office that the cleaning empties, in delete order:
 * children before parents. Each is deleted by `tenant_slug`. */
export const DEMO_RESET_TABLES: readonly PgTable[] = [
  qualificationDocumentReviews,
  serviceRequestAttachments,
  serviceRequestRequirementMessages,
  serviceRequestRequirements,
  serviceRequestCitizenViews,
  chatMessages,
  chatConversations,
  taxGuides,
  serviceRequests,
  appointmentAttachments,
  appointmentMessages,
  appointmentNotes,
  appointments,
  officePublications,
  transparencyDocuments,
  transparencyBulletins,
  complianceIntakes,
  issDeclarations,
  securityPaperMovements,
  securityPaperLots,
  securityPaperReports,
  paperOrders,
  paperSuppliers,
  dailyBookEntries,
  dailyBookImports,
  dailyBookReports,
  messengerMessages,
  messengerConversations,
  messengerProfiles,
  rcpnRecordChanges,
  rcpnPeople,
  rcpnCertidoes,
  rcpnRecords,
  rcpnImports,
  rcpnHabilitacaoChanges,
  rcpnHabilitacoes,
  titleTransferFilings,
  titleTransfers,
  qualificationNotes,
  qualifications,
  qualificationLibrary,
  censecActs,
  censecClosings,
  demoOutbox,
  tenantBranding,
  // Without the platform's own keys (see PLATFORM_KEY_PREFIX).
  tenantContent,
];

/** Every table of an office the cleaning never touches, and why. */
export const DEMO_RESET_KEPT: readonly { table: PgTable; reason: string }[] = [
  { table: user, reason: "as contas dos participantes e da Átrios" },
  { table: auditLog, reason: "a prova do que cada participante fez" },
  { table: auditNotes, reason: "parte da auditoria" },
  { table: auditNotifications, reason: "parte da auditoria" },
  { table: auditNotificationFiles, reason: "parte da auditoria" },
  { table: auditReviews, reason: "parte da auditoria" },
  { table: certificates, reason: "certificados emitidos no curso" },
  { table: emailBounces, reason: "fala do endereço, não do cartório" },
  {
    table: signingCertificates,
    reason: "credencial real; fechada aos participantes",
  },
  { table: signingCertificateSigners, reason: "credencial real" },
  { table: signedDocuments, reason: "assinador, fechado aos participantes" },
  { table: signedDocumentSignatures, reason: "assinador" },
  {
    table: signingStations,
    reason: "estação de assinatura: credencial real do computador do token",
  },
  {
    table: stationCertificatePolicies,
    reason: "quem pode usar o A3 compartilhado",
  },
  { table: stationSignJobs, reason: "o registro de cada uso do A3" },
  {
    table: knowledgeSources,
    reason: "base jurídica, fechada aos participantes",
  },
  { table: knowledgePassages, reason: "base jurídica" },
  { table: knowledgeRequests, reason: "base jurídica" },
  // The Registro de Imóveis (change registro-de-imoveis-acervo): kept until
  // someone reviews cleaning it; a new deletion goes through human review
  // (CLAUDE.md).
  {
    table: riSettings,
    reason: "Registro de Imóveis: limpeza ainda não revisada",
  },
  {
    table: riFiles,
    reason: "Registro de Imóveis: limpeza ainda não revisada",
  },
  {
    table: riProtocols,
    reason: "Registro de Imóveis: limpeza ainda não revisada",
  },
  {
    table: riBooks,
    reason: "Registro de Imóveis: limpeza ainda não revisada",
  },
  {
    table: riOnrImages,
    reason: "Registro de Imóveis: limpeza ainda não revisada",
  },
  {
    table: riGeometries,
    reason: "Registro de Imóveis: limpeza ainda não revisada",
  },
  {
    table: riProperties,
    reason: "Registro de Imóveis: limpeza ainda não revisada",
  },
  {
    table: riPeople,
    reason: "Registro de Imóveis: limpeza ainda não revisada",
  },
  { table: riActs, reason: "Registro de Imóveis: limpeza ainda não revisada" },
  {
    table: riActParties,
    reason: "Registro de Imóveis: limpeza ainda não revisada",
  },
  {
    table: riExports,
    reason: "Registro de Imóveis: limpeza ainda não revisada",
  },
  {
    table: attributionFiles,
    reason: "arquivos das atribuições, fechados aos participantes",
  },
  {
    table: dpoConversations,
    reason: "Assistente Virtual, fechado no cartório de demonstração",
  },
  { table: dpoMessages, reason: "Assistente Virtual" },
  { table: dpoMonthlyUsage, reason: "contagem de uso da plataforma" },
  { table: dpoTenantSettings, reason: "limite definido pela Átrios" },
  {
    table: officeStaff,
    reason:
      "equipe do cartório, fechada aos participantes (só o Tabelião edita)",
  },
  {
    table: officeNews,
    reason: "notícias do cartório, fechadas aos participantes",
  },
  { table: officeNewsFiles, reason: "arquivos das notícias do cartório" },
  {
    table: messengerReactions,
    reason:
      "reações das mensagens internas: sem as mensagens, nunca mais aparecem",
  },
  {
    table: serviceRequestPickups,
    reason:
      "quem retirou o documento no balcão: prova da entrega, sem chave estrangeira",
  },
  {
    table: serviceRequestRoutings,
    reason:
      "direcionamentos internos dos pedidos: histórico de quem pegou, sem chave estrangeira",
  },
  {
    table: cedulaAnalyses,
    reason: "análises de cédulas: o trabalho do cartório, com histórico",
  },
  {
    table: cedulaLearnedCues,
    reason: "o que a análise de cédulas aprendeu, sem dados pessoais",
  },
];

/** The keys of `tenant_content` that belong to the platform, not to the
 * office (the access policy, the AI hold): kept. */
const PLATFORM_KEY_PREFIX = "platform-";

/** The stored files the kept tables still name: never deleted. */
const KEPT_FILE_COLUMNS = [
  { table: signedDocuments, column: signedDocuments.filePath },
  { table: auditNotificationFiles, column: auditNotificationFiles.path },
  { table: attributionFiles, column: attributionFiles.storedPath },
] as const;

export class DemoResetRefused extends Error {}

/** Whether this office may be cleaned at all: registered and fictional. */
export function isResettable(tenantSlug: string): boolean {
  return TENANTS[tenantSlug]?.demo === true;
}

export interface DemoResetDeps {
  /** Every file stored under the office's folders (uploads.ts). */
  listFiles: (tenantSlug: string) => Promise<TenantStoredFile[]>;
  /** Seeds the office again (lib/demo-seed.ts). */
  seed: (database: Database, tenant: Tenant) => Promise<void>;
}

export interface DemoResetResult {
  /** Rows deleted, by table name; tables with none are left out. */
  rows: Record<string, number>;
  files: number;
}

/**
 * Cleans the demonstration office: refuses any office that is not
 * registered with `demo` on; in one transaction deletes the rows of every
 * table in DEMO_RESET_TABLES for that office and records the counts in the
 * platform's audit; then deletes the stored files no kept row names, and
 * seeds the office again. Accounts, sessions, cohorts, course progress,
 * attempts, certificates, courses, videos and the audit stay as they were.
 */
export async function resetDemoOfficeWith(
  database: Database,
  tenantSlug: string,
  actorId: string,
  deps: DemoResetDeps,
): Promise<DemoResetResult> {
  const tenant = TENANTS[tenantSlug];
  if (!tenant || !isResettable(tenantSlug)) {
    throw new DemoResetRefused(
      `A serventia ${tenantSlug} não é de demonstração: nada foi apagado.`,
    );
  }

  const rows: Record<string, number> = {};
  await database.transaction(async (txRaw) => {
    const tx = txRaw as unknown as Database;
    // A requirement may point at the attachment that resolved it, and the
    // attachment at the requirement: unlink the one direction first.
    await tx
      .update(serviceRequestRequirements)
      .set({ resolutionAttachmentId: null })
      .where(eq(serviceRequestRequirements.tenantSlug, tenantSlug));
    // The members of a conversation carry no office of their own.
    const memberRows = await tx
      .delete(messengerMembers)
      .where(
        inArray(
          messengerMembers.conversationId,
          tx
            .select({ id: messengerConversations.id })
            .from(messengerConversations)
            .where(eq(messengerConversations.tenantSlug, tenantSlug)),
        ),
      )
      .returning({ id: messengerMembers.conversationId });
    if (memberRows.length) rows.messenger_members = memberRows.length;

    for (const table of DEMO_RESET_TABLES) {
      const slugColumn = tenantSlugOf(table);
      const where =
        table === tenantContent
          ? and(
              eq(slugColumn, tenantSlug),
              notLike(tenantContent.key, `${PLATFORM_KEY_PREFIX}%`),
            )
          : eq(slugColumn, tenantSlug);
      const deleted = await tx
        .delete(table)
        .where(where)
        .returning({ one: sql`1` });
      if (deleted.length) rows[tableName(table)] = deleted.length;
    }

    // Under the platform, like the cohorts it serves (lib/cohorts.ts).
    await recordAuditWith(tx, {
      tenantSlug: SUPERADMIN_TENANT_SLUG,
      actorId,
      action: "demo.reset",
      targetType: "tenant",
      targetId: tenantSlug,
      reason: Object.entries(rows)
        .map(([name, count]) => `${name}: ${count}`)
        .join("; ")
        .slice(0, 300),
    });
  });

  // The files go after the rows are gone: a file left behind by a failed
  // delete is an orphan, a row left pointing at a deleted file is a broken
  // screen.
  const kept = new Set<string>();
  for (const { table, column } of KEPT_FILE_COLUMNS) {
    const named = await database
      .select({ ref: column })
      .from(table)
      .where(and(eq(tenantSlugOf(table), tenantSlug), isNotNull(column)));
    for (const { ref } of named) if (ref) kept.add(ref);
  }
  let files = 0;
  for (const file of await deps.listFiles(tenantSlug)) {
    if (kept.has(file.ref)) continue;
    await file.remove();
    files++;
  }

  await deps.seed(database, tenant);
  return { rows, files };
}

function tenantSlugOf(table: PgTable) {
  const column = (table as unknown as Record<string, unknown>).tenantSlug;
  if (!column) throw new Error(`${tableName(table)} não tem tenant_slug.`);
  return column as typeof serviceRequests.tenantSlug;
}

function tableName(table: PgTable): string {
  return (table as unknown as Record<symbol, string>)[
    Symbol.for("drizzle:Name")
  ];
}
