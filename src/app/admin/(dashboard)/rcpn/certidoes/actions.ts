"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import {
  type CertidaoForm,
  certidaoModel,
  isCertidaoForm,
} from "@/core/rcpn/certidao.ts";
import type { RcpnKind } from "@/core/rcpn/record.ts";
import { db } from "@/db/index.ts";
import { currentJustification, justify } from "@/lib/audit-reason.ts";
import {
  attachCertidaoWith,
  CertidaoError,
  type CertidaoInput,
  isRcpnKind,
  issueCertidaoWith,
  removeCertidaoWith,
  updateCertidaoWith,
} from "@/lib/rcpn-certidao.ts";
import { getSession } from "@/lib/session.ts";
import { getGuideSettings } from "@/lib/tax-guides.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AttachmentError, storeAttachments } from "@/lib/uploads.ts";

export type CertidaoState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

const NO_PERMISSION =
  "Você não tem permissão para emitir certidões do Registro Civil.";
const LIST = "/admin/rcpn/certidoes";

async function access() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "rcpn.certidao", session.user.permissions)
  ) {
    return undefined;
  }
  return { session, tenant: await getTenant() };
}

const text = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "");

/** The form's values in the library's terms; the signer from the guides' list. */
async function inputOf(
  formData: FormData,
  kind: RcpnKind,
  tenant: Awaited<ReturnType<typeof getTenant>>,
): Promise<Omit<CertidaoInput, "recordId">> {
  const via = text(formData, "via");
  const form: CertidaoForm = isCertidaoForm(via) ? via : "breve";
  const fields: Record<string, string> = {};
  for (const field of certidaoModel(kind, form).fields) {
    fields[field.key] = text(formData, `campo.${field.key}`);
  }
  let signerName = text(formData, "assinanteNome");
  let signerTitle = text(formData, "assinanteCargo");
  const chosen = text(formData, "assinante");
  if (chosen !== "" && chosen !== "outro") {
    const signer = (await getGuideSettings(tenant)).signers[Number(chosen)];
    if (signer) {
      signerName = signer.name;
      signerTitle = signer.title;
    }
  }
  return {
    kind,
    form,
    subtype: text(formData, "natimorto") === "1" ? "natimorto" : "",
    fields,
    seal: text(formData, "selo"),
    sealKind: text(formData, "seloTipo"),
    fees: text(formData, "emolumentos"),
    signerName,
    signerTitle,
    checked: text(formData, "conferida") === "1",
  };
}

export async function issueCertidaoAction(
  _previous: CertidaoState,
  formData: FormData,
): Promise<CertidaoState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const kind = text(formData, "tipo");
  if (!isRcpnKind(kind)) {
    return { status: "error", message: "Escolha o tipo de certidão." };
  }
  let id: string;
  try {
    id = await issueCertidaoWith(
      db,
      ok.tenant.slug,
      {
        ...(await inputOf(formData, kind, ok.tenant)),
        recordId: text(formData, "registro") || null,
      },
      ok.session.user.id,
    );
  } catch (error) {
    if (error instanceof CertidaoError) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: "Não foi possível emitir agora." };
  }
  revalidatePath(LIST);
  redirect(`${LIST}/${id}?emitida=1`);
}

export async function updateCertidaoAction(
  _previous: CertidaoState,
  formData: FormData,
): Promise<CertidaoState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const kind = text(formData, "tipo");
  if (!isRcpnKind(kind)) {
    return { status: "error", message: "Certidão não encontrada." };
  }
  const id = text(formData, "id");
  try {
    await updateCertidaoWith(
      db,
      ok.tenant.slug,
      id,
      await inputOf(formData, kind, ok.tenant),
      ok.session.user.id,
    );
  } catch (error) {
    if (error instanceof CertidaoError) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: "Não foi possível salvar agora." };
  }
  revalidatePath(`${LIST}/${id}`);
  redirect(`${LIST}/${id}?corrigida=1`);
}

export async function attachCertidaoAction(
  _previous: CertidaoState,
  formData: FormData,
): Promise<CertidaoState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const id = text(formData, "id");
  const file = formData.get("anexo");
  if (!(file instanceof File) || file.size === 0) {
    return {
      status: "error",
      message: "Escolha o arquivo da certidão assinada (PDF ou imagem).",
    };
  }
  try {
    const [stored] = await storeAttachments([file], {
      tenantSlug: ok.tenant.slug,
      kind: "Certidão assinada",
      limit: 1,
    });
    if (!stored) throw new CertidaoError("Não foi possível guardar o anexo.");
    await attachCertidaoWith(
      db,
      ok.tenant.slug,
      id,
      { path: stored.path, name: file.name || "certidao.pdf" },
      ok.session.user.id,
    );
  } catch (error) {
    if (error instanceof CertidaoError || error instanceof AttachmentError) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: "Não foi possível anexar agora." };
  }
  revalidatePath(`${LIST}/${id}`);
  return { status: "saved", message: "Certidão assinada anexada." };
}

export async function removeCertidaoAction(
  _previous: CertidaoState,
  formData: FormData,
): Promise<CertidaoState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  try {
    await removeCertidaoWith(
      db,
      ok.tenant.slug,
      text(formData, "id"),
      ok.session.user.id,
      currentJustification() ?? "",
    );
  } catch (error) {
    if (error instanceof CertidaoError) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: "Não foi possível excluir agora." };
  }
  revalidatePath(LIST);
  redirect(`${LIST}?excluida=1`);
}
