import { getActForTenant } from "@/core/acts/catalog.ts";
import { buildDeclaracoes } from "@/core/request/declaracao.ts";
import { readExemption, readPhone } from "@/core/request/kinds.ts";
import {
  buildRequerimento,
  type RequerimentoDocument,
} from "@/core/request/requerimento.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import type { findByProtocol } from "./service-request.ts";

type StoredRequest = NonNullable<Awaited<ReturnType<typeof findByProtocol>>>;

/**
 * The documents a stored request can produce, other than the access receipt.
 * The receipt is not here on purpose: it needs the plaintext key, which the
 * database does not hold, so it is built only by the route that just
 * verified the key, from what the citizen (or the operator) posted.
 */
export type RequestDocument =
  | "requerimento"
  | "declaracao"
  | "declaracao-em-branco";

/**
 * Which pages to render for `documento`, or null when this request has no
 * such document: an appointment or a manifestation has no requerimento; a
 * pedido without gratuidade has no declaração to fill or to hand out blank.
 *
 * One place, because three routes need exactly this and used to carry
 * their own copy: the citizen's POST, the citizen's signed GET link, and the
 * counter's print. The decision of "which document from which request" is
 * the part that drifts when copied.
 */
export function buildRequestDocuments(
  tenant: Tenant,
  stored: StoredRequest,
  documento: RequestDocument,
): RequerimentoDocument[] | null {
  if (!stored.actId || !stored.applicantName || !stored.contact) return null;
  const act = getActForTenant(tenant, stored.actId);
  if (!act) return null;

  const exemption = readExemption(stored.details);
  const meta = {
    protocolNumber: stored.protocolNumber,
    createdAt: stored.createdAt,
  };

  if (documento === "declaracao" || documento === "declaracao-em-branco") {
    if (!exemption) return null;
    return buildDeclaracoes(
      tenant,
      act,
      documento === "declaracao-em-branco" ? undefined : exemption,
      meta,
    );
  }

  return [
    buildRequerimento(tenant, act, {
      ...meta,
      applicantName: stored.applicantName,
      contact: stored.contact,
      phone: readPhone(stored.details),
      exemption,
      cpf: stored.cpf,
      description: stored.description,
      purpose: stored.purpose,
      parameterValue: stored.parameterValue,
    }),
  ];
}
