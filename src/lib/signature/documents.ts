import "server-only";
import { headers } from "next/headers";
import { buildSignatureManifest } from "@/core/signature/manifest.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { officeSite } from "@/lib/attendance-declaration.ts";
import { brandFor } from "@/lib/document-brand.ts";
import { renderDocument } from "@/lib/pdf.ts";
import type { SignedDocumentView } from "@/lib/signing.ts";

/** The site this request came through, for the QR when the office has no domain. */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** "https://cartorio.exemplo/verificar/AB12CD34EF56": what the QR opens. */
export function verifyUrlFor(
  tenant: Tenant,
  origin: string,
  code: string,
): string {
  return `${officeSite(tenant, origin).origin}/verificar/${code}`;
}

/** The manifest of a signed document, with the office's letterhead. */
export async function renderManifestPdf(
  tenant: Tenant,
  view: SignedDocumentView,
  origin: string,
): Promise<Buffer> {
  const verifyUrl = verifyUrlFor(tenant, origin, view.code);
  const current = view.signatures.at(-1)?.resultSha256;
  return renderDocument(
    buildSignatureManifest(tenant, {
      code: view.code,
      title: view.title,
      originalName: view.originalName,
      pageCount: view.pageCount,
      originalSha256: view.originalSha256,
      currentSha256: current,
      signatures: view.signatures,
      verifyUrl,
    }),
    await brandFor(tenant, verifyUrl),
  );
}

/** A file name a browser saves without surprises. */
export function downloadName(title: string, suffix: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 60);
  return `${base || "documento"}-${suffix}.pdf`;
}

export function pdfResponse(
  bytes: Buffer,
  name: string,
  inline = false,
): Response {
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
