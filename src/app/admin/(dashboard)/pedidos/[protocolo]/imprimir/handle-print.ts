import { PDFDocument } from "pdf-lib";
import { verifyAccessKey } from "@/core/request/access-key.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import type { Database } from "@/db/index.ts";
import {
  renderAccessReceiptWith,
  renderProtocolProofWith,
} from "@/lib/access-receipt.ts";
import { recordAuditWith } from "@/lib/audit.ts";
import type { DocumentBrand } from "@/lib/document-brand.ts";
import { renderDocuments } from "@/lib/pdf.ts";
import { buildRequestDocuments } from "@/lib/request-documents.ts";
import type { findByProtocol } from "@/lib/service-request.ts";

type StoredRequest = NonNullable<Awaited<ReturnType<typeof findByProtocol>>>;

function pdf(
  bytes: Buffer,
  name: string,
  disposition: "inline" | "attachment",
): Response {
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${name}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/**
 * The body of `route.ts`'s GET, once session and permission are already
 * checked (that part stays in `route.ts`; Better Auth is not tested in
 * process, see design.md's non-goals). This is the part with a rule worth
 * proving: printing writes to the audit log, under the right action, and a
 * pedido without gratuidade never produces a declaração.
 */
export async function printRequerimentoWith(
  database: Database,
  tenant: Tenant,
  stored: StoredRequest,
  actorId: string,
  brand: DocumentBrand,
  documento: string | null,
): Promise<Response> {
  if (documento === "protocolo") {
    const proof = await renderProtocolProofWith(
      database,
      tenant,
      stored,
      brand,
    );
    if (!proof) return new Response("Não encontrado", { status: 404 });
    await recordAuditWith(database, {
      tenantSlug: tenant.slug,
      actorId,
      action: "service-request.print.protocolo",
      targetType: "service-request",
      targetId: stored.id,
    });
    return pdf(
      proof,
      `comprovante-de-protocolo-${stored.protocolNumber}`,
      "inline",
    );
  }
  const wantsDeclaracao =
    documento === "declaracao" || documento === "declaracao-em-branco";
  const documents = buildRequestDocuments(
    tenant,
    stored,
    wantsDeclaracao ? documento : "requerimento",
  );
  if (!documents) return new Response("Não encontrado", { status: 404 });

  const bytes = await renderDocuments(documents, brand);
  await recordAuditWith(database, {
    tenantSlug: tenant.slug,
    actorId,
    action: wantsDeclaracao
      ? "service-request.print.declaracao"
      : "service-request.print.requerimento",
    targetType: "service-request",
    targetId: stored.id,
  });
  return pdf(
    bytes,
    `${wantsDeclaracao ? "declaracao" : "requerimento"}-${stored.protocolNumber}`,
    "inline",
  );
}

/**
 * The body of `route.ts`'s POST: the access receipt, gated by the key
 * itself, not the session. A wrong key never writes to the audit log; a
 * live one always does, under `service-request.print.comprovante`.
 */
export async function printReceiptWith(
  database: Database,
  tenant: Tenant,
  stored: StoredRequest,
  actorId: string,
  brand: DocumentBrand,
  accessKey: string,
): Promise<Response> {
  if (
    !stored.accessKeyHash ||
    !verifyAccessKey(accessKey, stored.accessKeyHash)
  ) {
    return new Response("Não encontrado", { status: 404 });
  }

  const bytes = await renderAccessReceiptWith(
    database,
    tenant,
    stored,
    accessKey,
    brand,
  );
  await recordAuditWith(database, {
    tenantSlug: tenant.slug,
    actorId,
    action: "service-request.print.comprovante",
    targetType: "service-request",
    targetId: stored.id,
  });
  return pdf(bytes, `comprovante-${stored.protocolNumber}`, "attachment");
}

/** The documents the counter can emit together, in the order they come out
 * of the printer: the two sheets that stay in the office first, the receipt
 * that leaves with the citizen last. */
export const COUNTER_DOCUMENTS = [
  "requerimento",
  "declaracao",
  "comprovante",
  "protocolo",
] as const;
export type CounterDocument = (typeof COUNTER_DOCUMENTS)[number];

/** What the form sent, kept to the known documents, deduplicated and in
 * printing order. */
export function parseCounterSelection(
  values: readonly unknown[],
): CounterDocument[] {
  return COUNTER_DOCUMENTS.filter((document) => values.includes(document));
}

const AUDIT_ACTIONS: Record<CounterDocument, string> = {
  requerimento: "service-request.print.requerimento",
  declaracao: "service-request.print.declaracao",
  comprovante: "service-request.print.comprovante",
  protocolo: "service-request.print.protocolo",
};

/** Several finished PDFs as one file, page after page. Each part is drawn on
 * its own (the declaração revisits its pages and cannot share a pass with
 * the requerimento) and only then stitched together. */
async function mergePdfs(parts: Buffer[], title: string): Promise<Buffer> {
  const merged = await PDFDocument.create();
  merged.setTitle(title);
  for (const part of parts) {
    const source = await PDFDocument.load(part);
    const pages = await merged.copyPages(source, source.getPageIndices());
    for (const page of pages) merged.addPage(page);
  }
  return Buffer.from(await merged.save());
}

/**
 * The counter's "emitir" (decision of 19/11/2026): the documents the
 * operator ticked, in ONE PDF, from one submit. Two tabs from one click was
 * the old way, and the browser let the first through and blocked the
 * second, so only the receipt ever came out.
 *
 * `mode` is what the operator asked for: "imprimir" opens the file in a tab
 * (inline) to print, "baixar" saves it (attachment). Every document is
 * checked before anything is drawn or audited, so a refused key or a
 * declaração the pedido does not have writes nothing at all; then each
 * document emitted gets its own audit entry, under the same action it has
 * when printed alone.
 */
export async function printSelectionWith(
  database: Database,
  tenant: Tenant,
  stored: StoredRequest,
  actorId: string,
  brand: DocumentBrand,
  selection: {
    documents: readonly CounterDocument[];
    accessKey: string;
    mode: "imprimir" | "baixar";
  },
): Promise<Response> {
  const { documents, accessKey, mode } = selection;
  if (documents.length === 0) {
    return new Response("Nenhum documento escolhido.", { status: 400 });
  }
  if (
    documents.includes("comprovante") &&
    (!stored.accessKeyHash || !verifyAccessKey(accessKey, stored.accessKeyHash))
  ) {
    return new Response("Não encontrado", { status: 404 });
  }

  const built: { document: CounterDocument; draw: () => Promise<Buffer> }[] =
    [];
  for (const document of documents) {
    if (document === "comprovante") {
      built.push({
        document,
        draw: () =>
          renderAccessReceiptWith(database, tenant, stored, accessKey, brand),
      });
      continue;
    }
    if (document === "protocolo") {
      const proof = await renderProtocolProofWith(
        database,
        tenant,
        stored,
        brand,
      );
      if (!proof) return new Response("Não encontrado", { status: 404 });
      built.push({ document, draw: async () => proof });
      continue;
    }
    const parts = buildRequestDocuments(tenant, stored, document);
    if (!parts) return new Response("Não encontrado", { status: 404 });
    built.push({ document, draw: () => renderDocuments(parts, brand) });
  }

  const rendered = await Promise.all(built.map((part) => part.draw()));
  const single = documents.length === 1 ? documents[0] : null;
  const bytes = single
    ? rendered[0]
    : await mergePdfs(
        rendered,
        `Documentos do pedido ${stored.protocolNumber}`,
      );

  for (const document of documents) {
    await recordAuditWith(database, {
      tenantSlug: tenant.slug,
      actorId,
      action: AUDIT_ACTIONS[document],
      targetType: "service-request",
      targetId: stored.id,
    });
  }
  return pdf(
    bytes,
    `${single ?? "documentos"}-${stored.protocolNumber}`,
    mode === "baixar" ? "attachment" : "inline",
  );
}
