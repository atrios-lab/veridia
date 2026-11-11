"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { getSession } from "@/lib/session.ts";
import {
  CertificateFileError,
  CertificatePasswordError,
} from "@/lib/signature/certificate.ts";
import {
  addCertificateWith,
  disableCertificateWith,
  SigningError,
  setCertificateSignersWith,
} from "@/lib/signing.ts";
import { getTenant } from "@/lib/tenant.ts";

export type CertificateState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

const NO_PERMISSION = "Só o administrador da serventia cuida dos certificados.";
const PATH = "/admin/configuracoes/certificados";

async function admin() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "user.manage", session.user.permissions)
  )
    return null;
  return session;
}

/** Takes an A1 in. The password only opens it here, and is then dropped. */
export async function addCertificate(
  _previous: CertificateState,
  formData: FormData,
): Promise<CertificateState> {
  const session = await admin();
  if (!session) return { status: "error", message: NO_PERMISSION };
  const file = formData.get("pfx");
  if (!(file instanceof File) || file.size === 0) {
    return {
      status: "error",
      message: "Escolha o arquivo do certificado (.pfx ou .p12).",
    };
  }
  if (file.size > 200_000) {
    return {
      status: "error",
      message: "Arquivo grande demais para um certificado A1.",
    };
  }
  const tenant = await getTenant();
  try {
    const info = await addCertificateWith(
      db,
      tenant.slug,
      {
        label: String(formData.get("label") ?? ""),
        pfx: Buffer.from(await file.arrayBuffer()),
        password: String(formData.get("password") ?? ""),
      },
      session.user.id,
    );
    revalidatePath(PATH);
    return {
      status: "saved",
      message: `Certificado de ${info.holderName} cadastrado. Agora escolha quem pode assinar com ele.`,
    };
  } catch (error) {
    if (
      error instanceof CertificatePasswordError ||
      error instanceof CertificateFileError ||
      error instanceof SigningError
    ) {
      return { status: "error", message: error.message };
    }
    console.error("certificados.add", error);
    return { status: "error", message: "Não foi possível cadastrar agora." };
  }
}

export async function saveSigners(
  _previous: CertificateState,
  formData: FormData,
): Promise<CertificateState> {
  const session = await admin();
  if (!session) return { status: "error", message: NO_PERMISSION };
  const tenant = await getTenant();
  try {
    await setCertificateSignersWith(
      db,
      tenant.slug,
      String(formData.get("certificateId") ?? ""),
      formData.getAll("signer").map(String),
      session.user.id,
    );
  } catch (error) {
    if (error instanceof SigningError) {
      return { status: "error", message: error.message };
    }
    console.error("certificados.signers", error);
    return { status: "error", message: "Não foi possível salvar agora." };
  }
  revalidatePath(PATH);
  return { status: "saved", message: "Autorizações salvas." };
}

export async function disableCertificate(
  _previous: CertificateState,
  formData: FormData,
): Promise<CertificateState> {
  const session = await admin();
  if (!session) return { status: "error", message: NO_PERMISSION };
  const tenant = await getTenant();
  const done = await disableCertificateWith(
    db,
    tenant.slug,
    String(formData.get("certificateId") ?? ""),
    session.user.id,
  ).catch(() => false);
  if (!done) return { status: "error", message: "Não foi possível desativar." };
  revalidatePath(PATH);
  return { status: "saved", message: "Certificado desativado." };
}
