import type { Attribution, Section, Tenant } from "./schema.ts";

// What each section requires. "always" means institutional or legally
// mandatory, so it does not depend on any attribution. An array of
// attributions means the section turns on if the office holds at least one.
// Declaration order is navigation order.
const SECTION_REQUIRES: Record<Section, Attribution[] | "always"> = {
  inicio: "always",
  "dpo-lgpd": "always", // data protection channel, required by law
  pedidos: ["RCPN", "NOTAS", "RI", "PROTESTO", "RTD", "RCPJ"],
  // Every office has a counter, so every office can take an appointment for it.
  agendamento: "always",
  "consulta-protocolo": ["RCPN", "NOTAS", "RI", "PROTESTO", "RTD", "RCPJ"],
  // NOTAS has no public notice board; every other attribution has one.
  editais: ["RCPN", "RI", "PROTESTO", "RTD", "RCPJ"],
  ouvidoria: "always",
  transparencia: "always",
  "selo-tjrn": "always",
  "centrais-contato": "always",
};

/**
 * Public path of each section. The section names are gating keys, not URLs:
 * the addresses below are the ones citizens already know from the offices'
 * current sites, and breaking them to match an internal key would cost real
 * traffic. Keyed by Section, so a new section cannot ship without an address.
 */
export const SECTION_ROUTES: Record<Section, string> = {
  inicio: "/",
  "dpo-lgpd": "/lgpd",
  pedidos: "/solicitar",
  agendamento: "/agendar",
  "consulta-protocolo": "/protocolo",
  editais: "/editais",
  ouvidoria: "/ouvidoria",
  transparencia: "/transparencia",
  "selo-tjrn": "/selo",
  "centrais-contato": "/centrais",
};

/** Navigation label of each section, as the citizen reads it. */
export const SECTION_LABELS: Record<Section, string> = {
  inicio: "Início",
  "dpo-lgpd": "Canal LGPD",
  pedidos: "Solicitar serviço",
  agendamento: "Agendar atendimento",
  "consulta-protocolo": "Consultar protocolo",
  editais: "Editais",
  ouvidoria: "Ouvidoria",
  transparencia: "Transparência",
  "selo-tjrn": "Selo digital",
  "centrais-contato": "Centrais e contato",
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

// Sections a citizen must always be able to reach: institutional, or
// required by law regardless of attribution. Declared here, independent of
// SECTION_REQUIRES's "always", so the visual identity tab's own override
// schema can point at one list without inferring it from gating internals.
export const MANDATORY_SECTIONS: Section[] = [
  "inicio",
  "dpo-lgpd",
  "ouvidoria",
  "transparencia",
];

/**
 * Single source of truth for gating, consumed by navigation and by routes.
 * The override only disables: it never enables a section the attributions
 * do not grant, and it can never disable a mandatory one (not even a row
 * written into the database by hand).
 */
export function isSectionEnabled(tenant: Tenant, section: Section): boolean {
  if (
    tenant.disabledSections.includes(section) &&
    !MANDATORY_SECTIONS.includes(section)
  ) {
    return false;
  }
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

/**
 * Sections the office's attributions grant and that are not mandatory: the
 * ones the visual identity tab draws with a toggle. Mandatory sections get a
 * lock instead, never a control that implies they could be turned off.
 */
export function optionalSections(tenant: Tenant): Section[] {
  return enabledOrGrantable(tenant).filter(
    (s) => !MANDATORY_SECTIONS.includes(s),
  );
}

/** Sections the attribution grants, regardless of the override's on/off state. */
function enabledOrGrantable(tenant: Tenant): Section[] {
  return (Object.keys(SECTION_REQUIRES) as Section[]).filter((s) => {
    const requires = SECTION_REQUIRES[s];
    return (
      requires === "always" || requires.some((a) => hasAttribution(tenant, a))
    );
  });
}

/** Notice sectors available to the office (subitems of the notices section). */
export function noticeSectors(tenant: Tenant): NoticeSector[] {
  if (!isSectionEnabled(tenant, "editais")) return [];
  return (Object.keys(NOTICE_SECTOR_ATTRIBUTION) as NoticeSector[]).filter(
    (sector) => hasAttribution(tenant, NOTICE_SECTOR_ATTRIBUTION[sector]),
  );
}
