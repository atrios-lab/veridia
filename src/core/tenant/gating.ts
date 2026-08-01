import type { Attribution, Section, Tenant } from "./schema.ts";

// What each section requires. "always" means institutional or legally
// mandatory, so it does not depend on any attribution. An array of
// attributions means the section turns on if the office holds at least one.
// Declaration order is navigation order.
const SECTION_REQUIRES: Record<Section, Attribution[] | "always"> = {
  inicio: "always",
  "dpo-lgpd": "always", // data protection channel, required by law
  pedidos: ["RCPN", "NOTAS", "RI", "PROTESTO", "RTD", "RCPJ"],
  "consulta-protocolo": ["RCPN", "NOTAS", "RI", "PROTESTO", "RTD", "RCPJ"],
  // NOTAS has no public notice board; every other attribution has one.
  editais: ["RCPN", "RI", "PROTESTO", "RTD", "RCPJ"],
  ouvidoria: "always",
  transparencia: "always",
  "selo-tjrn": "always",
  "centrais-contato": "always",
};

// Sectors inside the "editais" section, each one bound to an attribution.
// Keys are route slugs, so they stay in Portuguese.
export const NOTICE_SECTOR_ATTRIBUTION = {
  proclamas: "RCPN",
  "registro-imoveis": "RI",
  protesto: "PROTESTO",
  rtd: "RTD",
  rcpj: "RCPJ",
} as const satisfies Record<string, Attribution>;

export type NoticeSector = keyof typeof NOTICE_SECTOR_ATTRIBUTION;

export function hasAttribution(tenant: Tenant, a: Attribution): boolean {
  return tenant.attributions.includes(a);
}

/**
 * Single source of truth for gating, consumed by navigation and by routes.
 * The override only disables: it never enables a section the attributions
 * do not grant.
 */
export function isSectionEnabled(tenant: Tenant, section: Section): boolean {
  if (tenant.disabledSections.includes(section)) return false;
  const requires = SECTION_REQUIRES[section];
  if (requires === "always") return true;
  return requires.some((a) => tenant.attributions.includes(a));
}

/** Sections actually enabled, in navigation order. */
export function enabledSections(tenant: Tenant): Section[] {
  return (Object.keys(SECTION_REQUIRES) as Section[]).filter((s) =>
    isSectionEnabled(tenant, s),
  );
}

/** Notice sectors available to the office (subitems of the notices section). */
export function noticeSectors(tenant: Tenant): NoticeSector[] {
  if (!isSectionEnabled(tenant, "editais")) return [];
  return (Object.keys(NOTICE_SECTOR_ATTRIBUTION) as NoticeSector[]).filter(
    (sector) => hasAttribution(tenant, NOTICE_SECTOR_ATTRIBUTION[sector]),
  );
}
