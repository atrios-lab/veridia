"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { buildSignatureManifest } from "@/core/signature/manifest.ts";
import { officialName } from "@/core/tenant/identification.ts";
import { db } from "@/db/index.ts";
import { justify } from "@/lib/audit-reason.ts";
import { brandFor } from "@/lib/document-brand.ts";
import { renderDocument } from "@/lib/pdf.ts";
import { getSession } from "@/lib/session.ts";
import { CertificatePasswordError } from "@/lib/signature/certificate.ts";
import { requestOrigin, verifyUrlFor } from "@/lib/signature/documents.ts";
import { PdfNotSignableError } from "@/lib/signature/pades.ts";
import {
  coSignDocumentWith,
  findSignedDocumentWith,
  SigningError,
  setSignedDocumentRemovedWith,
  signNewDocumentWith,
} from "@/lib/signing.ts";
import { getTenant } from "@/lib/tenant.ts";

export type SignState =
  | { status: "idle" }
  | { status: "error"; message: string };

const KNOWN = [CertificatePasswordError, SigningError, PdfNotSignableError];

function failure(error: unknown, where: string): SignState {
  if (KNOWN.some((kind) => error instanceof kind)) {
    return { status: "error", message: (error as Error).message };
  }
  console.error(where, error);
  return {
    status: "error",
    message:
      "Não foi possível assinar este PDF. Confira se ele abre normalmente e tente de novo.",
  };
}

/** One PDF signed: the client signs a batch one file at a time. */
export type SignOneResult =
  | { status: "signed"; id: string; title: string }
  | { status: "error"; message: string; stop: boolean };

/**
 * Signs one PDF and answers, without redirecting: the form sends each
 * chosen file in its own request (a request carries up to ~4.5 MB on the
 * host), with the certificate and password typed once.
 */
export async function signOneDocument(
  formData: FormData,
): Promise<SignOneResult> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "desk.access", session.user.permissions)
  ) {
    return { status: "error", message: "Sem permissão.", stop: true };
  }
  const file = formData.get("pdf");
  if (!(file instanceof File) || file.size === 0) {
    return {
      status: "error",
      message: "Escolha o PDF a assinar.",
      stop: false,
    };
  }
  const tenant = await getTenant();
  const origin = await requestOrigin();
  const withManifest = formData.get("manifest") === "on";
  const location = `${tenant.location.city}/${tenant.location.state}`;
  const title =
    String(formData.get("title") ?? "").trim() ||
    file.name.replace(/\.pdf$/i, "");
  try {
    const { id } = await signNewDocumentWith(
      db,
      tenant.slug,
      {
        certificateId: String(formData.get("certificateId") ?? ""),
        password: String(formData.get("password") ?? ""),
        pdf: Buffer.from(await file.arrayBuffer()),
        title,
        originalName: file.name || "documento.pdf",
        verifyUrl: (code) => verifyUrlFor(tenant, origin, code),
        location,
        officeName: officialName(tenant),
        manifest: withManifest
          ? async (code, info, at, original) => {
              const verifyUrl = verifyUrlFor(tenant, origin, code);
              return renderDocument(
                buildSignatureManifest(tenant, {
                  code,
                  title,
                  originalName: file.name || "documento.pdf",
                  pageCount: original.pageCount,
                  originalSha256: original.sha256,
                  signatures: [{ ...info, signedAt: at }],
                  verifyUrl,
                }),
                await brandFor(tenant, verifyUrl),
              );
            }
          : undefined,
      },
      session.user.id,
    );
    revalidatePath("/admin/utilitarios/assinador");
    return { status: "signed", id, title };
  } catch (error) {
    const failed = failure(error, "assinador.sign");
    return {
      status: "error",
      message: failed.status === "error" ? failed.message : "Erro.",
      // A wrong password fails every file the same way: stop the batch.
      stop: error instanceof CertificatePasswordError,
    };
  }
}

/**
 * Takes a signed document off the list, or puts it back. The
 * Tabelião/Registrador or whoever signed it. Nothing is erased.
 */
export async function setDocumentRemoved(
  _previous: SignState,
  formData: FormData,
): Promise<SignState> {
  const session = await getSession();
  const role = session?.user.role ?? "";
  if (!session || !can(role, "desk.access", session.user.permissions)) {
    return { status: "error", message: "Sem permissão." };
  }
  const tenant = await getTenant();
  const id = String(formData.get("documentId") ?? "");
  const view = await findSignedDocumentWith(db, tenant.slug, { id });
  if (!view) return { status: "error", message: "Documento não encontrado." };
  if (
    view.createdBy !== session.user.id &&
    !can(role, "user.manage", session.user.permissions)
  ) {
    return {
      status: "error",
      message:
        "Só quem assinou ou o Tabelião/Registrador retira um documento da lista.",
    };
  }
  const removed = formData.get("removed") === "1";
  if (removed) {
    // Sensitive: says why, and the reason goes to the audit.
    const why = justify(formData);
    if (why) return { status: "error", message: why };
  }
  await setSignedDocumentRemovedWith(
    db,
    tenant.slug,
    id,
    removed,
    session.user.id,
  );
  revalidatePath("/admin/utilitarios/assinador");
  revalidatePath(`/admin/utilitarios/assinador/${id}`);
  if (removed) redirect("/admin/utilitarios/assinador?retirado=1");
  return { status: "idle" };
}

export async function coSignDocument(
  _previous: SignState,
  formData: FormData,
): Promise<SignState> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "desk.access", session.user.permissions)
  ) {
    return { status: "error", message: "Sem permissão." };
  }
  const tenant = await getTenant();
  const id = String(formData.get("documentId") ?? "");
  try {
    await coSignDocumentWith(
      db,
      tenant.slug,
      id,
      {
        certificateId: String(formData.get("certificateId") ?? ""),
        password: String(formData.get("password") ?? ""),
        location: `${tenant.location.city}/${tenant.location.state}`,
      },
      session.user.id,
    );
  } catch (error) {
    return failure(error, "assinador.cosign");
  }
  revalidatePath(`/admin/utilitarios/assinador/${id}`);
  redirect(`/admin/utilitarios/assinador/${id}?assinado=1`);
}
