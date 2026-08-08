"use server";

import { headers } from "next/headers";
import {
  ATTRIBUTION_NAMES,
  getActForTenant,
  PROCESSING_MODE_LABELS,
} from "@/core/acts/catalog.ts";
import {
  generateAccessKey,
  hashAccessKey,
  verifyAccessKey,
} from "@/core/request/access-key.ts";
import { looksLikeBot, serviceRequestSchema } from "@/core/request/form.ts";
import { formatProtocolNumber } from "@/core/request/protocol.ts";
import { isSectionEnabled } from "@/core/tenant/gating.ts";
import { isRateLimited } from "@/lib/rate-limit.ts";
import {
  attachToRequest,
  createServiceRequest,
  findByProtocol,
} from "@/lib/service-request.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AttachmentError, storeAttachments } from "@/lib/uploads.ts";

export interface SubmitSuccess {
  status: "success";
  protocolNumber: string;
  /** In the clear exactly once: never stored, never sent again. */
  accessKey: string;
  actName: string;
  attributionName: string;
  processingLabel: string;
}

export type SubmitState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: Record<string, string> }
  | SubmitSuccess;

const GENERIC_ERROR =
  "Não foi possível enviar o pedido agora. Tente novamente em instantes.";

function fail(
  message: string,
  fieldErrors: Record<string, string> = {},
): SubmitState {
  return { status: "error", message, fieldErrors };
}

export async function submitServiceRequest(
  _previous: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const tenant = await getTenant();
  if (!isSectionEnabled(tenant, "pedidos")) return fail(GENERIC_ERROR);

  const act = getActForTenant(tenant, String(formData.get("actId") ?? ""));
  if (!act) return fail("Escolha um ato disponível nesta serventia.");

  /*
   * The invisible field, checked before anything is written. A script that
   * filled it gets the same screen a person gets, so the run reads as
   * successful and nothing is filed. No CAPTCHA: making a citizen solve a
   * puzzle to ask for a birth certificate is a toll on the people least able
   * to pay it.
   */
  if (looksLikeBot(formData.get("website"))) {
    return {
      status: "success",
      protocolNumber: formatProtocolNumber(
        "REQ",
        new Date().getFullYear(),
        999_999,
      ),
      accessKey: generateAccessKey(),
      actName: act.name,
      attributionName: ATTRIBUTION_NAMES[act.attribution],
      processingLabel: PROCESSING_MODE_LABELS[act.processingMode],
    };
  }

  if (await isRateLimited(await headers())) {
    return fail(
      "Muitos envios seguidos deste acesso. Aguarde um minuto e tente de novo.",
    );
  }

  const parsed = serviceRequestSchema(act).safeParse({
    applicantName: formData.get("applicantName") ?? "",
    contact: formData.get("contact") ?? "",
    cpf: formData.get("cpf") ?? "",
    description: formData.get("description") ?? "",
    purpose: formData.get("purpose") ?? "",
    parameterValue: formData.get("parameterValue") ?? "",
    lgpdConsent: formData.get("lgpdConsent") ?? "",
    truthDeclaration: formData.get("truthDeclaration") ?? "",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form");
      fieldErrors[field] ??= issue.message;
    }
    return fail(
      "Confira os campos destacados para enviar o pedido.",
      fieldErrors,
    );
  }

  const accessKey = generateAccessKey();

  try {
    const files = formData
      .getAll("anexos")
      .filter((f): f is File => f instanceof File);
    const attachments = await storeAttachments(files);

    const { protocolNumber } = await createServiceRequest(
      tenant,
      act,
      { ...parsed.data, accessKeyHash: hashAccessKey(accessKey) },
      attachments,
    );

    return {
      status: "success",
      protocolNumber,
      accessKey,
      actName: act.name,
      attributionName: ATTRIBUTION_NAMES[act.attribution],
      processingLabel: PROCESSING_MODE_LABELS[act.processingMode],
    };
  } catch (error) {
    if (error instanceof AttachmentError) return fail(error.message);
    console.error("service-request.create", error);
    return fail(GENERIC_ERROR);
  }
}

export type AttachState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

/**
 * The signed form, sent from the success screen. Authorised by the same pair
 * the citizen was just handed: no session to keep, nothing to remember.
 */
export async function attachSignedForm(
  _previous: AttachState,
  formData: FormData,
): Promise<AttachState> {
  const tenant = await getTenant();
  const protocolNumber = String(formData.get("protocolNumber") ?? "");
  const accessKey = String(formData.get("accessKey") ?? "");

  const request = await findByProtocol(tenant.slug, protocolNumber);
  // The same message for "no such request" and for "wrong key": telling them
  // apart would confirm a protocol exists to someone guessing numbers.
  if (
    !request?.accessKeyHash ||
    !verifyAccessKey(accessKey, request.accessKeyHash)
  ) {
    return {
      status: "error",
      message: "Protocolo ou chave de acesso inválidos.",
    };
  }

  if (await isRateLimited(await headers())) {
    return {
      status: "error",
      message: "Muitos envios seguidos. Aguarde um minuto.",
    };
  }

  try {
    const files = formData
      .getAll("requerimento")
      .filter((f): f is File => f instanceof File);
    const stored = await storeAttachments(files, {
      kind: "requerimento-assinado",
    });
    if (stored.length === 0) {
      return {
        status: "error",
        message: "Escolha o arquivo do requerimento assinado.",
      };
    }
    await attachToRequest(tenant.slug, request.id, stored, "signed-form");
    return {
      status: "success",
      message:
        "Requerimento assinado recebido. A serventia já pode dar andamento.",
    };
  } catch (error) {
    if (error instanceof AttachmentError) {
      return { status: "error", message: error.message };
    }
    console.error("service-request.attach", error);
    return { status: "error", message: GENERIC_ERROR };
  }
}
