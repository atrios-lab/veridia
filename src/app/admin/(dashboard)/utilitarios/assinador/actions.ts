"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { buildSignatureManifest } from "@/core/signature/manifest.ts";
import { db } from "@/db/index.ts";
import { brandFor } from "@/lib/document-brand.ts";
import { renderDocument } from "@/lib/pdf.ts";
import { getSession } from "@/lib/session.ts";
import { CertificatePasswordError } from "@/lib/signature/certificate.ts";
import { requestOrigin, verifyUrlFor } from "@/lib/signature/documents.ts";
import { PdfNotSignableError } from "@/lib/signature/pades.ts";
import {
  coSignDocumentWith,
  SigningError,
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

export async function signDocument(
  _previous: SignState,
  formData: FormData,
): Promise<SignState> {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "desk.access")) {
    return { status: "error", message: "Sem permissão." };
  }
  const file = formData.get("pdf");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Escolha o PDF a assinar." };
  }
  const tenant = await getTenant();
  const origin = await requestOrigin();
  const withManifest = formData.get("manifest") === "on";
  const location = `${tenant.location.city}/${tenant.location.state}`;
  let id: string;
  try {
    ({ id } = await signNewDocumentWith(
      db,
      tenant.slug,
      {
        certificateId: String(formData.get("certificateId") ?? ""),
        password: String(formData.get("password") ?? ""),
        pdf: Buffer.from(await file.arrayBuffer()),
        title: String(formData.get("title") ?? ""),
        originalName: file.name || "documento.pdf",
        verifyUrl: (code) => verifyUrlFor(tenant, origin, code),
        location,
        manifest: withManifest
          ? async (code, info, at, original) => {
              const verifyUrl = verifyUrlFor(tenant, origin, code);
              return renderDocument(
                buildSignatureManifest(tenant, {
                  code,
                  title: String(formData.get("title") ?? "") || file.name,
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
    ));
  } catch (error) {
    return failure(error, "assinador.sign");
  }
  revalidatePath("/admin/utilitarios/assinador");
  redirect(`/admin/utilitarios/assinador/${id}?assinado=1`);
}

export async function coSignDocument(
  _previous: SignState,
  formData: FormData,
): Promise<SignState> {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "desk.access")) {
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
