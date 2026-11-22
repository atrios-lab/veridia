"use server";

import { headers } from "next/headers";
import {
  isFullName,
  LOOKUP_PURPOSES,
  type LookupAnswer,
} from "@/core/rcpn/public-lookup.ts";
import { isValidCpf } from "@/core/request/form.ts";
import { clientIp } from "@/lib/client-ip.ts";
import { isVerifyRateLimited } from "@/lib/rate-limit.ts";
import { lookupRegistro, publicLookupEnabled } from "@/lib/rcpn-lookup.ts";
import { getTenant } from "@/lib/tenant.ts";

export type LookupState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: Record<string, string> }
  | {
      status: "answered";
      answer: LookupAnswer;
      /** The date was given but the registro found has none to compare. */
      dateGiven: boolean;
    };

function fail(
  message: string,
  fieldErrors: Record<string, string> = {},
): LookupState {
  return { status: "error", message, fieldErrors };
}

/**
 * "Seu registro é daqui?": the lookup of the Registro Civil index from the
 * site. The person identifies themself and the purpose (the LGPD base, and
 * what protects the Tabelião), gives the full name and the mother's full
 * name, and the birth date if they know it. Every lookup is recorded.
 */
export async function lookupRegistroAction(
  _previous: LookupState,
  formData: FormData,
): Promise<LookupState> {
  const tenant = await getTenant();
  if (
    !tenant.attributions.includes("RCPN") ||
    !(await publicLookupEnabled(tenant.slug))
  ) {
    return fail("A consulta pelo site não está disponível nesta serventia.");
  }
  const requestHeaders = await headers();
  if (await isVerifyRateLimited(requestHeaders)) {
    return fail(
      "Muitas consultas seguidas. Aguarde alguns minutos e tente de novo.",
    );
  }

  const field = (name: string) => String(formData.get(name) ?? "").trim();
  const asker = {
    name: field("askerName"),
    cpf: field("askerCpf"),
    oab: field("askerOab"),
    purpose: field("purpose"),
  };
  const query = {
    name: field("name"),
    mother: field("mother"),
    birthDate: field("birthDate"),
  };
  const errors: Record<string, string> = {};
  if (asker.name.length < 5) errors.askerName = "Informe o seu nome completo.";
  if (!isValidCpf(asker.cpf)) errors.askerCpf = "Informe um CPF válido.";
  if (!(LOOKUP_PURPOSES as readonly string[]).includes(asker.purpose)) {
    errors.purpose = "Escolha a finalidade.";
  }
  if (formData.get("declaration") !== "on") {
    errors.declaration = "Marque a declaração para consultar.";
  }
  if (!isFullName(query.name)) {
    errors.name = "Informe o nome completo da pessoa registrada.";
  }
  if (!isFullName(query.mother)) {
    errors.mother = "Informe o nome completo da mãe.";
  }
  if (query.birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(query.birthDate)) {
    errors.birthDate = "Data inválida.";
  }
  if (Object.keys(errors).length > 0) {
    return fail("Confira os campos destacados.", errors);
  }

  try {
    const answer = await lookupRegistro(tenant.slug, query, {
      ...asker,
      ip: clientIp(requestHeaders) ?? "",
    });
    return {
      status: "answered",
      answer,
      dateGiven: Boolean(query.birthDate),
    };
  } catch (error) {
    console.error("consulta-registro", error);
    return fail(
      "Não foi possível consultar agora. Tente de novo em instantes.",
    );
  }
}
