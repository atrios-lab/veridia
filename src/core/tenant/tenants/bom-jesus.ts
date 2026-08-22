import { parseTenant, type Tenant } from "../schema.ts";

// Real office. Data taken from the official site (cartoriobomjesusrn.com)
// on 10/08/2026; CNS confirmed against public registries (09.473-0).
export const cartorioBomJesus: Tenant = parseTenant({
  slug: "cartorio-bom-jesus",
  hosts: ["cartoriobomjesusrn.com", "bomjesus.localhost"],
  name: "Cartório de Bom Jesus",
  emailFrom: "nao-responda@cartoriobomjesusrn.com",
  subtitle: "Ofício Único de Bom Jesus / RN",
  about:
    "O Ofício Único de Bom Jesus / RN é o cartório que reúne todos os serviços de " +
    "registro e notas do município desde 1962. Sua função é dar segurança " +
    "jurídica, autenticidade e publicidade aos atos da vida do cidadão, do nascimento " +
    "aos negócios.",
  cns: "094730",
  // The official site lists Notas, RCPN (with interdições e tutelas), RI,
  // RTD and RCPJ; it does not hold Protesto.
  attributions: ["RCPN", "NOTAS", "RI", "PROTESTO", "RTD", "RCPJ"],
  contacts: {
    phone: "(84) 4042-0949",
    whatsapp: "(84) 4042-0949",
    email: "cartoriounicodebomjesus@gmail.com",
  },
  address: "Praça Padre João Maria, 24, Bom Jesus - RN, 59270-000",
  openingHours: "Segunda a sexta, das 8h às 14h",
  counterHours: { startHour: 8, endHour: 14 },
  owner: {
    name: "Natanailde de Souza Delgado Andrade",
    // Delegated after concurso per the site, but not yet checked against
    // CNJ Justiça Aberta the way the pilot was.
    status: "a confirmar",
  },
  // Institutional LGPD channel published on the office's own site
  // (/atendimento-lgpd/); the DPO is the substituta legal.
  dpo: {
    name: "Liana Delgado Ribeiro de Andrade",
    email: "dpo_lgpd@cartoriobomjesusrn.com",
  },
  issRate: 0.05, // ponytail: 5% assumed, confirm the Bom Jesus municipal rate
  theme: "verde-dourado",
  // ponytail: same photo as Marinho until the office sends its own
  heroImage: "/hero-home.jpg",
  home: { title: "Ofício Único de Bom Jesus / RN" }, // same text as `subtitle`
  // ponytail: placeholder logos until the office sends its own assets
  logos: {
    light: "/logos/CM-Logo-preto.png",
    dark: "/logos/CM-Logo-branco.png",
    seal: {
      light: "/logos/CM-Sublogo-preto.png",
      dark: "/logos/CM-Sublogo-branco.png",
    },
  },
  legalFooter:
    "Obedecendo à Lei de Acesso à Informação (LAI), Lei nº 12.527/2011, Lei nº 13.709/2018 (LGPD) " +
    "e Resolução CNJ nº 363/2020.",
});
