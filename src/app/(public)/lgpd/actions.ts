"use server";

import { headers } from "next/headers";
import { generateAccessKey, hashAccessKey } from "@/core/request/access-key.ts";
import {
  dataRightsDeadline,
  dataRightsSchema,
} from "@/core/request/channels.ts";
import { looksLikeBot } from "@/core/request/form.ts";
import type { DataRight } from "@/core/request/kinds.ts";
import { parseDetails } from "@/core/request/kinds.ts";
import { formatProtocolNumber } from "@/core/request/protocol.ts";
import { isSectionEnabled } from "@/core/tenant/gating.ts";
import { isRateLimited } from "@/lib/rate-limit.ts";
import { createRecord } from "@/lib/service-request.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { AttachmentError, collectAttachments } from "@/lib/uploads.ts";

export interface DataRightsSuccess {
  status: "success";
  protocolNumber: string;
  /** In the clear exactly once: never stored, never sent again. */
  accessKey: string;
  right: DataRight;
  /** The day the office has to answer by, already counted. */
  deadline: string;
}

export type DataRightsState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: Record<string, string> }
  | DataRightsSuccess;

const GENERIC_ERROR =
  "Não foi possível enviar o pedido agora. Tente novamente em instantes.";

function fail(
  message: string,
  fieldErrors: Record<string, string> = {},
): DataRightsState {
  return { status: "error", message, fieldErrors };
}

export async function submitDataRights(
  _previous: DataRightsState,
  formData: FormData,
): Promise<DataRightsState> {
  const tenant = await getTenant();
  if (!isSectionEnabled(tenant, "dpo-lgpd")) return fail(GENERIC_ERROR);

  // The invisible field: a script that filled it gets the screen a person
  // gets, and nothing is filed. No CAPTCHA in the way of a legal right.
  if (looksLikeBot(formData.get("website"))) {
    return {
      status: "success",
      protocolNumber: formatProtocolNumber(
        "SOL",
        new Date().getFullYear(),
        999_999,
      ),
      accessKey: generateAccessKey(),
      right: "access",
      deadline: dataRightsDeadline(today()),
    };
  }

  if (await isRateLimited(await headers())) {
    return fail(
      "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.",
    );
  }

  const parsed = dataRightsSchema.safeParse({
    right: formData.get("right") ?? "",
    applicantName: formData.get("applicantName") ?? "",
    email: formData.get("email") ?? "",
    cpf: formData.get("cpf") ?? "",
    description: formData.get("description") ?? "",
    holderDeclaration: formData.get("holderDeclaration") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "");
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return fail("Confira os campos destacados.", fieldErrors);
  }

  const { right, applicantName, email, cpf, description } = parsed.data;

  try {
    const stored = await collectAttachments(formData, "anexos");

    const accessKey = generateAccessKey();
    const { protocolNumber } = await createRecord(
      tenant,
      "data-rights",
      {
        applicantName,
        contact: email,
        cpf,
        description,
        accessKeyHash: hashAccessKey(accessKey),
        details: parseDetails("data-rights", { right }),
      },
      stored,
    );

    return {
      status: "success",
      protocolNumber,
      accessKey,
      right,
      deadline: dataRightsDeadline(today()),
    };
  } catch (error) {
    if (error instanceof AttachmentError) return fail(error.message);
    console.error("lgpd.submit", error);
    return fail(GENERIC_ERROR);
  }
}
