"use server";

import { headers } from "next/headers";
import { ATTRIBUTION_NAMES, getActForTenant } from "@/core/acts/catalog.ts";
import {
  generateAccessKey,
  hashAccessKey,
  verifyAccessKey,
} from "@/core/request/access-key.ts";
import {
  isSignedFormDocument,
  SIGNED_FORM_NAMES,
} from "@/core/request/attachment.ts";
import { deadlineDate } from "@/core/request/deadline.ts";
import {
  buildExemptionDetails,
  looksLikeBot,
  publicServiceRequestSchema,
  readExemptionForm,
} from "@/core/request/form.ts";
import { readExemption } from "@/core/request/kinds.ts";
import { formatProtocolNumber } from "@/core/request/protocol.ts";
import { formatDate } from "@/core/scheduling/calendar.ts";
import { isSectionEnabled } from "@/core/tenant/gating.ts";
import { clientIp } from "@/lib/client-ip.ts";
import { sendAccessKey } from "@/lib/email/service-request.ts";
import { isRateLimited } from "@/lib/rate-limit.ts";
import {
  attachToRequest,
  createServiceRequest,
  findByProtocol,
  findOpenServiceRequestDuplicate,
} from "@/lib/service-request.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { AttachmentError, collectAttachments } from "@/lib/uploads.ts";

export interface SubmitSuccess {
  status: "success";
  protocolNumber: string;
  /** In the clear on this screen; also sent once by e-mail, below. */
  accessKey: string;
  /** The address the key was also sent to: this is the citizen's own
   * mailbox, so the screen can name it back without asking a second time. */
  email: string;
  actName: string;
  attributionName: string;
  /** The date the office expects to have analysed it by, in "DD/MM/AAAA". */
  deadlineLabel: string;
  /** Whether the download screen also offers the declaração de
   * hipossuficiência (Provimento CGJ/TJRN n. 7/2026, Anexo I): only a
   * gratuidade pedido has one. */
  hasExemption: boolean;
}

export interface SubmitDuplicate {
  status: "duplicate";
  protocolNumber: string;
}

export type SubmitState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: Record<string, string> }
  | SubmitDuplicate
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
      email: String(formData.get("email") ?? ""),
      actName: act.name,
      attributionName: ATTRIBUTION_NAMES[act.attribution],
      // Born from the act's own legal term, counted from today: a request
      // just filed carries no term of its own yet. Where the law fixes none,
      // the office's default stands in.
      deadlineLabel: formatDate(
        deadlineDate(
          today(),
          act.legalDeadlineDays ?? tenant.requestDeadlineDays,
        ),
      ),
      hasExemption: false,
    };
  }

  const requestHeaders = await headers();
  if (await isRateLimited(requestHeaders)) {
    return fail(
      "Muitos envios seguidos deste acesso. Aguarde um minuto e tente de novo.",
    );
  }

  const parsed = publicServiceRequestSchema(act).safeParse({
    applicantName: formData.get("applicantName") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    cpf: formData.get("cpf") ?? "",
    description: formData.get("description") ?? "",
    purpose: formData.get("purpose") ?? "",
    parameterValue: formData.get("parameterValue") ?? "",
    lgpdConsent: formData.get("lgpdConsent") ?? "",
    truthDeclaration: formData.get("truthDeclaration") ?? "",
    ...readExemptionForm(formData),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      // Um caminho aninhado ("beneficiaries.0.signer.name") vira a mesma
      // chave que o formulário usa para registrar o campo: é assim que
      // `errorFor` em `request-form.tsx` reencontra o erro certo dentro da
      // árvore de beneficiários da gratuidade.
      const field = issue.path.length > 0 ? issue.path.join(".") : "form";
      fieldErrors[field] ??= issue.message;
    }
    return fail(
      "Confira os campos destacados para enviar o pedido.",
      fieldErrors,
    );
  }

  const duplicateProtocol = await findOpenServiceRequestDuplicate(
    tenant.slug,
    act.id,
    { cpf: parsed.data.cpf, email: parsed.data.email },
  );
  if (duplicateProtocol) {
    return { status: "duplicate", protocolNumber: duplicateProtocol };
  }

  const accessKey = generateAccessKey();

  try {
    const attachments = await collectAttachments(formData, "anexos", {
      tenantSlug: tenant.slug,
    });

    // The consent is stamped at the moment it is given, into the record it
    // belongs to: the proof of consent is the controller's to keep (LGPD
    // art. 8 §2), and the schema above only checks the boxes were ticked.
    const consentedAt = new Date().toISOString();

    // The e-mail is what the `contact` column holds for a request filed here:
    // the telephone is the office's own way of reaching the citizen and rides
    // in `details`, next to the rest of what belongs to this kind alone.
    const {
      email,
      phone,
      exemptionActId,
      certificateType,
      beneficiaries,
      ...data
    } = parsed.data;

    // O ato da gratuidade não tem prazo próprio: o prazo é o do ato que ele
    // pede, senão a certidão isenta nasceria com prazo diferente da paga. Fica
    // gravado no pedido porque o ato sintético não tem onde carregá-lo.
    const requestedAct = act.exemptionTargets?.find(
      (target) => target.id === exemptionActId,
    );
    const deadlineDays =
      requestedAct?.legalDeadlineDays ??
      act.legalDeadlineDays ??
      tenant.requestDeadlineDays;

    const exemption = buildExemptionDetails(
      { exemptionActId, certificateType, beneficiaries },
      consentedAt,
      { ip: clientIp(requestHeaders) },
    );

    const { protocolNumber } = await createServiceRequest(
      tenant,
      act,
      {
        ...data,
        contact: email,
        accessKeyHash: hashAccessKey(accessKey),
        details: {
          consents: { lgpd: consentedAt, truth: consentedAt },
          phone,
          // Pedida, nunca concedida: quem confere o benefício e decide é a
          // serventia, e `amountCents` segue sendo do operador.
          ...(exemption
            ? {
                exemption,
                deadline: { startedOn: today(), days: deadlineDays },
              }
            : {}),
        },
      },
      attachments,
    );

    // The key goes to the citizen's own mailbox now: the tela de sucesso is
    // the first via, this e-mail the second, so losing the tab does not
    // strand the citizen without a way to reach the pedido again. Awaited,
    // not surfaced: on the public side the address belongs to the person
    // filling the form, and a bounce warning here is a different screen and
    // a different decision than warning an atendente mid-atendimento; the
    // tela de sucesso keeps showing the key either way. Awaiting still
    // matters: the check has to finish inside the request.
    await sendAccessKey({
      tenant,
      contact: email,
      protocolNumber,
      accessKey,
      reason: "received",
    });

    return {
      status: "success",
      protocolNumber,
      accessKey,
      email,
      actName: act.name,
      attributionName: ATTRIBUTION_NAMES[act.attribution],
      // Born from the act's own legal term, counted from today: a request
      // just filed carries no term of its own yet. Where the law fixes none,
      // the office's default stands in.
      deadlineLabel: formatDate(deadlineDate(today(), deadlineDays)),
      hasExemption: Boolean(exemption),
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
 * The signed form, sent from the success screen or the consult. Authorised
 * by the same pair the citizen was just handed: no session to keep, nothing
 * to remember.
 *
 * `documento` says which paper was signed: the requerimento (the default,
 * and what every send before the declaração could be sent apart was), or
 * the declaração de hipossuficiência, accepted only on a pedido that has
 * one. The file is stored under the document's own name
 * (`SIGNED_FORM_NAMES`), which is how the panel and the consult tell the
 * two signed copies apart; both stay `signed-form` attachments.
 */
export async function attachSignedForm(
  _previous: AttachState,
  formData: FormData,
): Promise<AttachState> {
  const tenant = await getTenant();
  const protocolNumber = String(formData.get("protocolNumber") ?? "");
  const accessKey = String(formData.get("accessKey") ?? "");
  const rawDocumento = formData.get("documento") ?? "requerimento";
  const documento = isSignedFormDocument(rawDocumento)
    ? rawDocumento
    : undefined;
  if (!documento) {
    return { status: "error", message: "Documento desconhecido." };
  }

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

  if (documento === "declaracao" && !readExemption(request.details)) {
    // No declaração to sign on this pedido: a client that sends one anyway
    // is not the form this system rendered.
    return { status: "error", message: "Este pedido não tem declaração." };
  }

  if (await isRateLimited(await headers())) {
    return {
      status: "error",
      message: "Muitos envios seguidos. Aguarde um minuto e tente de novo.",
    };
  }

  try {
    const stored = await collectAttachments(formData, documento, {
      tenantSlug: tenant.slug,
      kind: SIGNED_FORM_NAMES[documento],
      limit: 1,
    });
    if (stored.length === 0) {
      return {
        status: "error",
        message:
          documento === "declaracao"
            ? "Escolha o arquivo da declaração assinada."
            : "Escolha o arquivo do requerimento assinado.",
      };
    }
    await attachToRequest(tenant.slug, request.id, stored, "signed-form");
    return {
      status: "success",
      message:
        documento === "declaracao"
          ? "Declaração enviada. A serventia vai analisar em seguida."
          : "Requerimento enviado. A serventia vai analisar em seguida.",
    };
  } catch (error) {
    if (error instanceof AttachmentError) {
      return { status: "error", message: error.message };
    }
    console.error("service-request.attach", error);
    return { status: "error", message: GENERIC_ERROR };
  }
}
