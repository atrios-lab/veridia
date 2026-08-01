import type { Attribution, Tenant } from "../tenant/schema.ts";

// Display names for the legal attributions. The keys keep the official
// acronyms; only the label is translated, because it is user visible.
export const ATTRIBUTION_NAMES: Record<Attribution, string> = {
  RCPN: "Registro Civil das Pessoas Naturais",
  NOTAS: "Tabelionato de Notas",
  RI: "Registro de Imóveis",
  PROTESTO: "Tabelionato de Protesto",
  RTD: "Registro de Títulos e Documentos",
  RCPJ: "Registro Civil das Pessoas Jurídicas",
};

export interface Act {
  id: string;
  attribution: Attribution;
  /** User visible label, in Portuguese. */
  name: string;
  legalBasis: string;
  /**
   * Only a few acts may ask the citizen why they want the document.
   * Certificates may not: Lei 6.015 art. 17 forbids requiring a motive.
   */
  requiresPurpose: boolean;
}

// ponytail: seeded catalog, one act per attribution. It is enough for gating
// and for filtering by attribution, which is all this change ships. The full
// list (about thirty acts, with documents and legal basis per act) is a data
// load that belongs with the "pedidos" module; the verified source is the
// previous system, packages/tenants/src/atos.ts.
export const ACTS: Act[] = [
  {
    id: "rcpn-certidao",
    attribution: "RCPN",
    name: "Certidão (nascimento, casamento, óbito)",
    legalBasis: "Lei 6.015 art. 17",
    requiresPurpose: false,
  },
  {
    id: "notas-escritura-publica",
    attribution: "NOTAS",
    name: "Escritura pública",
    legalBasis: "CC art. 215 (Lei 8.935 art. 7)",
    requiresPurpose: false,
  },
  {
    id: "ri-certidao-matricula",
    attribution: "RI",
    name: "Certidão de matrícula",
    legalBasis: "Lei 6.015 art. 19",
    requiresPurpose: true, // Lei 6.015 art. 123: the purpose is part of the request
  },
  {
    id: "protesto-certidao",
    attribution: "PROTESTO",
    name: "Certidão de protesto",
    legalBasis: "Lei 9.492 art. 27",
    requiresPurpose: false,
  },
  {
    id: "rtd-registro-documento",
    attribution: "RTD",
    name: "Registro de documento",
    legalBasis: "Lei 6.015 art. 127",
    requiresPurpose: false,
  },
  {
    id: "rcpj-registro-constituicao",
    attribution: "RCPJ",
    name: "Registro de constituição",
    legalBasis: "Lei 6.015 art. 114",
    requiresPurpose: false,
  },
];

/** Acts of a single attribution, empty when the office does not hold it. */
export function actsOfAttribution(
  tenant: Tenant,
  attribution: Attribution,
): Act[] {
  if (!tenant.attributions.includes(attribution)) return [];
  return ACTS.filter((a) => a.attribution === attribution);
}

/** Every act available to the office, across all attributions it holds. */
export function actsOfTenant(tenant: Tenant): Act[] {
  return ACTS.filter((a) => tenant.attributions.includes(a.attribution));
}

export function getAct(id: string): Act | undefined {
  return ACTS.find((a) => a.id === id);
}
