"use server";

import { headers } from "next/headers";
import { generateAccessKey, hashAccessKey } from "@/core/request/access-key.ts";
import { isAnonymous, ombudsmanSchema } from "@/core/request/channels.ts";
import { looksLikeBot } from "@/core/request/form.ts";
import type { ManifestationType } from "@/core/request/kinds.ts";
import { parseDetails } from "@/core/request/kinds.ts";
import { formatProtocolNumber } from "@/core/request/protocol.ts";
import { isSectionEnabled } from "@/core/tenant/gating.ts";
import { notifyCitizen } from "@/lib/email/service-request.ts";
import { isRateLimited } from "@/lib/rate-limit.ts";
import { createRecord } from "@/lib/service-request.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AttachmentError, collectAttachments } from "@/lib/uploads.ts";

export interface OmbudsmanSuccess {
  status: "success";
  protocolNumber: string;
  /** Absent when the manifestation is anonymous: there is no key to give. */
  accessKey?: string;
  manifestationType: ManifestationType;
  anonymous: boolean;
  confidential: boolean;
}

export type OmbudsmanState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: Record<string, string> }
  | OmbudsmanSuccess;

const GENERIC_ERROR =
  "Não foi possível registrar a manifestação agora. Tente novamente em instantes.";

function fail(
  message: string,
  fieldErrors: Record<string, string> = {},
): OmbudsmanState {
  return { status: "error", message, fieldErrors };
}

export async function submitManifestation(
  _previous: OmbudsmanState,
  formData: FormData,
): Promise<OmbudsmanState> {
  const tenant = await getTenant();
  if (!isSectionEnabled(tenant, "ouvidoria")) return fail(GENERIC_ERROR);

  if (looksLikeBot(formData.get("website"))) {
    return {
      status: "success",
      protocolNumber: formatProtocolNumber(
        "OUV",
        new Date().getFullYear(),
        999_999,
      ),
      manifestationType: "complaint",
      anonymous: true,
      confidential: false,
    };
  }

  if (await isRateLimited(await headers())) {
    return fail(
      "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.",
    );
  }

  const parsed = ombudsmanSchema.safeParse({
    manifestationType: formData.get("manifestationType") ?? "",
    message: formData.get("message") ?? "",
    applicantName: formData.get("applicantName") ?? "",
    contact: formData.get("contact") ?? "",
    confidential: formData.get("confidential") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "");
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return fail("Confira os campos destacados.", fieldErrors);
  }

  const { manifestationType, message, applicantName, contact } = parsed.data;
  const anonymous = isAnonymous(parsed.data);
  // Secrecy only means something when there is a name to keep out of the file.
  const confidential = anonymous ? false : parsed.data.confidential;

  try {
    const stored = await collectAttachments(formData, "anexos", {
      tenantSlug: tenant.slug,
    });

    /*
     * No key for an anonymous manifestation: there is no personal data to
     * protect and no one to answer, so a key would promise a channel that
     * does not exist. The record still goes to the ombudsman.
     */
    const accessKey = anonymous ? undefined : generateAccessKey();

    const { protocolNumber } = await createRecord(
      tenant,
      "ombudsman",
      {
        applicantName,
        contact,
        description: message,
        accessKeyHash: accessKey ? hashAccessKey(accessKey) : undefined,
        details: parseDetails("ombudsman", {
          manifestationType,
          anonymous,
          confidential,
        }),
      },
      stored,
    );

    // No check for anonymity here on purpose: an anonymous manifestation has
    // no contact, and `notifyCitizen` gives up on one. The key is never in
    // the e-mail, the same way it is never in the one the wizard sends.
    notifyCitizen({
      tenant,
      contact: contact ?? null,
      protocolNumber,
      subject: "Manifestação recebida",
      body: "Recebemos a sua manifestação. Guarde o número do registro e a chave de acesso mostrados na tela de envio.",
    });

    return {
      status: "success",
      protocolNumber,
      accessKey,
      manifestationType,
      anonymous,
      confidential,
    };
  } catch (error) {
    if (error instanceof AttachmentError) return fail(error.message);
    console.error("ouvidoria.submit", error);
    return fail(GENERIC_ERROR);
  }
}
