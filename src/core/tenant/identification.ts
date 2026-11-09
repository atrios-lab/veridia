import { ATTRIBUTION_NAMES } from "../acts/catalog.ts";
import type { Attribution, Jurisdiction, Tenant } from "./schema.ts";

/**
 * How a serventia identifies itself on every paper it issues, as the Código
 * de Normas da CGJ/TJRN (Provimento 156/2016) sets it:
 *
 * - art. 2º: the office is identified by its denomination, with the comarca,
 *   the circunscrição and the municipality; no trade name and no logotype;
 * - § 1º: the holder's name and the legal attributions may follow, in
 *   smaller type, right below the identification;
 * - § 3º: the rule reaches the office's stationery and its pages on the
 *   internet, which is every document this platform prints for it.
 *
 * Laid out the way the office's own certidões read: the national arms, then
 *
 *   REPÚBLICA FEDERATIVA DO BRASIL
 *   SERVIÇO NOTARIAL E REGISTRAL
 *   CARTÓRIO DO OFÍCIO ÚNICO DE IELMO MARINHO/RN
 *   COMARCA/TERMO DE MACAÍBA/RN
 *
 * and, at the foot of the page, the address, telephone, e-mail and site.
 * Pure: the PDF renderers draw it, the panel previews it.
 */
export interface OfficeIdentification {
  /** The centred capitals, top to bottom. */
  header: string[];
  /** The holder and their title, in smaller type (§ 1º), when the office
      chose to print them. */
  holder?: string;
  /** The legal attributions, in smaller type (§ 1º), when the office chose
      to print them. */
  attributions?: string;
  /** The foot of the page: where the office is and how to reach it. */
  footer: string[];
  /** Whether the comarca or termo is still to be filled in the panel (not
      when the office chose to print none). */
  missingJurisdiction: boolean;
}

export const JURISDICTION_LABELS: Record<
  Exclude<Jurisdiction["kind"], "none">,
  string
> = {
  comarca: "Comarca",
  termo: "Termo",
  "comarca-termo": "Comarca/Termo",
};

const NOTARIAL: readonly Attribution[] = ["NOTAS", "PROTESTO"];

/**
 * "Serviço Notarial e Registral", or only the half the office holds: Lei
 * 8.935/1994 names notarial (notas, protesto) and registry services apart,
 * and an office with registries only is not a notarial service.
 */
export function serviceLine(attributions: readonly Attribution[]): string {
  const notarial = attributions.some((a) => NOTARIAL.includes(a));
  const registral = attributions.some((a) => !NOTARIAL.includes(a));
  if (notarial && registral) return "Serviço Notarial e Registral";
  return notarial ? "Serviço Notarial" : "Serviço Registral";
}

/** The denomination, as the office writes it; its site name until it does. */
export function officialName(
  tenant: Pick<Tenant, "officialName" | "name">,
): string {
  return tenant.officialName ?? tenant.name;
}

/** "Comarca/Termo de Macaíba/RN", or undefined until the office says. */
export function jurisdictionLine(
  tenant: Pick<Tenant, "jurisdiction" | "location">,
): string | undefined {
  const { jurisdiction } = tenant;
  if (!jurisdiction || jurisdiction.kind === "none" || !jurisdiction.seat) {
    return undefined;
  }
  return `${JURISDICTION_LABELS[jurisdiction.kind]} de ${jurisdiction.seat}/${tenant.location.state}`;
}

/**
 * The denomination with its comarca, for a sentence: "Cartório do Ofício
 * Único de Ielmo Marinho/RN, Comarca/Termo de Macaíba/RN".
 */
export function officeWithJurisdiction(
  tenant: Pick<Tenant, "officialName" | "name" | "jurisdiction" | "location">,
): string {
  const line = jurisdictionLine(tenant);
  return line ? `${officialName(tenant)}, ${line}` : officialName(tenant);
}

function holderLine(
  tenant: Pick<Tenant, "owner" | "holderTitle" | "showHolder">,
): string | undefined {
  if (!tenant.showHolder) return undefined;
  // A holder the platform has not confirmed is not printed under the
  // office's name: a wrong name on a public paper is worse than none.
  if (tenant.owner.status === "a confirmar") return undefined;
  const title =
    tenant.holderTitle ??
    (tenant.owner.status === "interino"
      ? "Responsável interino(a)"
      : "Titular");
  return `${tenant.owner.name}, ${title}`;
}

/** The site's bare domain, for the foot of the page. */
function siteDomain(hosts: readonly string[]): string | undefined {
  return hosts.find((host) => !host.endsWith(".localhost"));
}

const upper = (text: string) => text.toLocaleUpperCase("pt-BR");

export function officeIdentification(tenant: Tenant): OfficeIdentification {
  const jurisdiction = jurisdictionLine(tenant);
  const contact = [
    tenant.contacts.phone ? `Fone ${tenant.contacts.phone}` : undefined,
    tenant.contacts.email ? `E-mail: ${tenant.contacts.email}` : undefined,
    siteDomain(tenant.hosts),
  ].filter(Boolean);
  return {
    header: [
      "República Federativa do Brasil",
      serviceLine(tenant.attributions),
      officialName(tenant),
      ...(jurisdiction ? [jurisdiction] : []),
    ].map(upper),
    holder: holderLine(tenant),
    attributions: tenant.showAttributions
      ? tenant.attributions
          .map((attribution) => ATTRIBUTION_NAMES[attribution])
          .join(" · ")
      : undefined,
    footer: [
      tenant.address ?? `${tenant.location.city}/${tenant.location.state}`,
      contact.join(" · "),
    ].filter(Boolean),
    missingJurisdiction: tenant.jurisdiction === undefined,
  };
}
