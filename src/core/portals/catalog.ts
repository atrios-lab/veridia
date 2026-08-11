import type { Attribution } from "../tenant/schema.ts";

/** One national portal a citizen can use directly, outside the serventia. */
export interface OfficialPortal {
  name: string;
  /** Citizen-facing description, in the words the design specifies. */
  description: string;
  /** Domain shown in the chip, without protocol. */
  domain: string;
  /** Full URL the card links to. */
  url: string;
}

/** A group of portals under one attribution-labelled section. */
export interface PortalGroup {
  /** Label of the divider above the group, matching `ATTRIBUTION_NAMES`. */
  label: string;
  attributions: Attribution[];
  portals: OfficialPortal[];
}

/**
 * SERP · Sistema Eletrônico dos Registros Públicos, the single entry point
 * highlighted above every attribution group. It has no attribution of its
 * own: every tenant with the section enabled sees it, regardless of which
 * attributions the office holds.
 */
export const SERP_PORTAL: OfficialPortal = {
  name: "SERP · Sistema Eletrônico dos Registros Públicos",
  description:
    "Não sabe por onde começar? O SERP reúne num só lugar os pedidos e " +
    "consultas de todos os cartórios de registro do Brasil.",
  domain: "serp.onr.org.br",
  url: "https://serp.onr.org.br",
};

/**
 * Groups by attribution, in the order the design draws them. A group
 * appears on `/centrais` only when the tenant holds at least one of its
 * attributions — see `portalGroupsFor`.
 */
export const PORTAL_GROUPS: PortalGroup[] = [
  {
    label: "Registro Civil",
    attributions: ["RCPN"],
    portals: [
      {
        name: "CRC Nacional / Meu Registro Civil",
        description:
          "Certidões de nascimento, casamento e óbito de qualquer cartório do Brasil.",
        domain: "registrocivil.org.br",
        url: "https://registrocivil.org.br",
      },
    ],
  },
  {
    label: "Tabelionato de Notas",
    attributions: ["NOTAS"],
    portals: [
      {
        name: "e-Notariado",
        description:
          "Procurações e escrituras feitas pela internet, por videoconferência.",
        domain: "e-notariado.org.br",
        url: "https://e-notariado.org.br",
      },
      {
        name: "CENSEC",
        description:
          "Consulte se existe escritura, procuração ou testamento feito em qualquer cartório do país.",
        domain: "censec.org.br",
        url: "https://censec.org.br",
      },
    ],
  },
  {
    label: "Protesto de Títulos",
    attributions: ["PROTESTO"],
    portals: [
      {
        name: "CENPROT",
        description:
          "Consulte de graça se há protesto no seu CPF ou CNPJ e veja como regularizar.",
        domain: "site.cenprot.org.br",
        url: "https://site.cenprot.org.br",
      },
    ],
  },
  {
    label: "Registro de Imóveis",
    attributions: ["RI"],
    portals: [
      {
        name: "Registro de Imóveis (ONR / SREI)",
        description:
          "Certidões e serviços de imóveis pela internet, no site nacional oficial.",
        domain: "registradores.onr.org.br",
        url: "https://registradores.onr.org.br",
      },
    ],
  },
  {
    label: "Títulos e Documentos · Pessoas Jurídicas",
    attributions: ["RTD", "RCPJ"],
    portals: [
      {
        name: "RTDPJ Brasil",
        description:
          "Registro de contratos, documentos e empresas em qualquer cartório do país.",
        domain: "rtdbrasil.org.br",
        url: "https://rtdbrasil.org.br",
      },
    ],
  },
];

/**
 * Groups the tenant's attributions unlock, in catalog order. A group needs
 * only one matching attribution (see the RTD/RCPJ group), never all of them.
 */
export function portalGroupsFor(attributions: Attribution[]): PortalGroup[] {
  return PORTAL_GROUPS.filter((group) =>
    group.attributions.some((a) => attributions.includes(a)),
  );
}
