"use server";

import { revalidatePath } from "next/cache";
import { getActForTenant } from "@/core/acts/catalog.ts";
import { can } from "@/core/auth/roles.ts";
import { generateAccessKey, hashAccessKey } from "@/core/request/access-key.ts";
import { serviceRequestSchema } from "@/core/request/form.ts";
import { parseCentsInput } from "@/core/request/money.ts";
import { closeConversation } from "@/lib/chat.ts";
import { notifyCitizen } from "@/lib/email/service-request.ts";
import {
  createServiceRequest,
  setRequestAmount,
} from "@/lib/service-request.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export type ManualEntryState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: Record<string, string> }
  | { status: "success"; protocolNumber: string; accessKey: string };

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
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form");
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
    const { id, protocolNumber } = await createServiceRequest(tenant, act, {
      ...parsed.data,
      accessKeyHash: hashAccessKey(accessKey),
      details: { channel: fromConversationId ? "chat" : "counter" },
    });
    if (amountCents !== undefined) {
      await setRequestAmount(tenant.slug, id, amountCents, session.user.id);
    }

    // The counter already handed over the protocol and the key, on paper or
    // on the operator's screen. This is the copy that survives the walk home.
    // The key stays out of it, the same way it does on the public wizard.
    notifyCitizen({
      tenant,
      contact: parsed.data.contact,
      protocolNumber,
      subject: "Pedido recebido",
      body: "Recebemos o seu pedido. Guarde o número do protocolo e a chave de acesso entregues no atendimento.",
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
    return { status: "success", protocolNumber, accessKey };
  } catch (error) {
    console.error("pedidos.manual-entry", error);
    return fail(GENERIC_ERROR);
  }
}
