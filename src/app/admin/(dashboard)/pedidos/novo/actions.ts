"use server";

import { revalidatePath } from "next/cache";
import {
  ATTRIBUTION_SHORT_NAMES,
  getActForTenant,
} from "@/core/acts/catalog.ts";
import { can } from "@/core/auth/roles.ts";
import { generateAccessKey, hashAccessKey } from "@/core/request/access-key.ts";
import { deadlineDate } from "@/core/request/deadline.ts";
import {
  buildExemptionDetails,
  formatCpf,
  readExemptionForm,
  serviceRequestSchema,
} from "@/core/request/form.ts";
import { formatCents, parseCentsInput } from "@/core/request/money.ts";
import { formatDate } from "@/core/scheduling/calendar.ts";
import { closeConversation } from "@/lib/chat.ts";
import { sendAccessKey } from "@/lib/email/service-request.ts";
import {
  createServiceRequest,
  setRequestAmount,
} from "@/lib/service-request.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, officeNow, today } from "@/lib/tenant.ts";

export type ManualEntryState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: Record<string, string> }
  | {
      status: "success";
      protocolNumber: string;
      accessKey: string;
      applicantName: string;
      actName: string;
      /** Already formatted here: the office's wall clock, not the server's. */
      filedAtLabel: string;
      contact: string;
      /** Set when that address is known not to take mail: the operator is
       * still at the counter with the person, which is the one moment a
       * wrong e-mail can be fixed by asking. */
      emailWarning?: string | null;
      /** In full, not masked: the operator typed it seconds ago and the whole
          point of this block is confirming the right pedido was filed. */
      cpfLabel?: string;
      attributionLabel: string;
      amountLabel?: string;
      /** The date the office expects to have analysed it by, "DD/MM/AAAA". */
      deadlineLabel: string;
      /** Whether the SuccessScreen also offers printing the declaração de
       * hipossuficiência (Provimento CGJ/TJRN n. 7/2026, Anexo I). */
      hasExemption: boolean;
    };

const GENERIC_ERROR =
  "Não foi possível registrar o pedido agora. Tente novamente em instantes.";

function fail(
  message: string,
  fieldErrors: Record<string, string> = {},
): ManualEntryState {
  return { status: "error", message, fieldErrors };
}

/**
 * The counter's own version of `submitServiceRequest`: same schema, same
 * protocol and key generation, no honeypot and no rate limit: this route is
 * already behind an authenticated session with `requests.manage`, so the
 * defenses built for an anonymous form do not apply here.
 */
export async function createManualServiceRequest(
  _previous: ManualEntryState,
  formData: FormData,
): Promise<ManualEntryState> {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "requests.manage")) {
    return fail("Você não tem permissão para lançar pedidos.");
  }

  const tenant = await getTenant();
  const act = getActForTenant(tenant, String(formData.get("actId") ?? ""));
  if (!act) return fail("Escolha um ato disponível nesta serventia.");

  const parsed = serviceRequestSchema(act).safeParse({
    applicantName: formData.get("applicantName") ?? "",
    contact: formData.get("contact") ?? "",
    cpf: formData.get("cpf") ?? "",
    description: formData.get("description") ?? "",
    purpose: formData.get("purpose") ?? "",
    parameterValue: "",
    // Filed in person: the physical process at the counter is the consent,
    // there is no screen here for the citizen to tick these themselves, the
    // way there is in the public wizard.
    lgpdConsent: "on",
    truthDeclaration: "on",
    ...readExemptionForm(formData),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      // Mesmo caminho pontuado que `manual-entry-form.tsx` usa para os campos
      // da gratuidade (ver `errorFor` em `request-form.tsx`, reaproveitado
      // aqui): "beneficiaries.0.signer.name", não só "beneficiaries".
      const field = issue.path.length > 0 ? issue.path.join(".") : "form";
      fieldErrors[field] ??= issue.message;
    }
    return fail("Confira os campos destacados.", fieldErrors);
  }

  const accessKey = generateAccessKey();
  const amountCents = parseCentsInput(String(formData.get("amount") ?? ""));
  // Present only when this form was opened from "Lançar um pedido novo a
  // partir desta conversa" at closing time (see
  // atendimento/[id]/_components/close-dialog.tsx).
  const fromConversationId =
    String(formData.get("fromConversationId") ?? "").trim() || undefined;

  try {
    const { exemptionActId, certificateType, beneficiaries, ...data } =
      parsed.data;
    const exemption = buildExemptionDetails(
      { exemptionActId, certificateType, beneficiaries },
      new Date().toISOString(),
    );
    // O ato da gratuidade não tem prazo próprio: o prazo é o do ato que ele
    // pede, o mesmo cálculo que o site público faz (ver `solicitar/actions.ts`).
    const requestedAct = act.exemptionTargets?.find(
      (target) => target.id === exemptionActId,
    );
    const deadlineDays =
      requestedAct?.legalDeadlineDays ??
      act.legalDeadlineDays ??
      tenant.requestDeadlineDays;
    const { id, protocolNumber } = await createServiceRequest(tenant, act, {
      ...data,
      accessKeyHash: hashAccessKey(accessKey),
      details: {
        channel: fromConversationId ? "chat" : "counter",
        ...(exemption
          ? { exemption, deadline: { startedOn: today(), days: deadlineDays } }
          : {}),
      },
    });
    if (amountCents !== undefined) {
      await setRequestAmount(tenant.slug, id, amountCents, session.user.id);
    }

    // The counter already handed over the protocol and the key, on paper or
    // on the operator's screen. This is the copy that survives the walk
    // home, and it carries the key too, same as the public wizard's own
    // receipt: a phone number as contact still gets nothing tried (see
    // `sendAccessKey`), which is the one difference the balcão keeps: a
    // citizen without an e-mail here still has the screen and the printed
    // comprovante.
    const emailWarning = await sendAccessKey({
      tenant,
      contact: parsed.data.contact,
      protocolNumber,
      accessKey,
      reason: "received",
    });

    if (fromConversationId) {
      await closeConversation(
        tenant.slug,
        fromConversationId,
        { kind: "staff", userId: session.user.id },
        { linkedRequestId: id },
      );
      revalidatePath("/admin/atendimento");
    }
    revalidatePath("/admin", "layout");
    return {
      status: "success",
      emailWarning,
      protocolNumber,
      accessKey,
      applicantName: parsed.data.applicantName,
      actName: act.name,
      // The office's wall clock: Vercel runs in UTC, and from nine at night a
      // plain new Date() would stamp this "hoje" with tomorrow's hour, on the
      // screen of an office that is closed.
      filedAtLabel: `hoje às ${officeNow().time.replace(":", "h")}`,
      contact: parsed.data.contact,
      cpfLabel: parsed.data.cpf ? formatCpf(parsed.data.cpf) : undefined,
      attributionLabel: ATTRIBUTION_SHORT_NAMES[act.attribution],
      amountLabel:
        amountCents !== undefined ? formatCents(amountCents) : undefined,
      // Same as the online filing: the act's legal term counted from today,
      // since a request just filed carries no term of its own.
      deadlineLabel: formatDate(deadlineDate(today(), deadlineDays)),
      hasExemption: Boolean(exemption),
    };
  } catch (error) {
    console.error("pedidos.manual-entry", error);
    return fail(GENERIC_ERROR);
  }
}
