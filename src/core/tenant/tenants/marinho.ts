import { parseTenant, type Tenant } from "../schema.ts";

// Real pilot office. Data confirmed at handoff (18/07/2026); the owner was
// confirmed as "provido" on 24/07/2026, matching CNJ Justica Aberta.
export const cartorioMarinho: Tenant = parseTenant({
  slug: "cartorio-marinho",
  // The bare domain is enough: resolveTenant strips "www" and the port.
  // The ".localhost" entry is what lets a developer serve this office locally.
  hosts: ["cartorioielmomarinhorn.com", "marinho.localhost"],
  name: "Cartório Marinho",
  subtitle: "Ofício Único de Ielmo Marinho / RN",
  cns: "094615",
  attributions: ["RCPN", "NOTAS", "RI", "PROTESTO", "RTD", "RCPJ"],
  contacts: {
    phone: "(84) 4042-0940",
    whatsapp: "(84) 4042-0940",
    email: "cartorioim@gmail.com",
  },
  openingHours: "Segunda a sexta, das 8h às 14h",
  owner: {
    name: "Maria Marreiro de Lima",
    status: "provido",
  },
  // Institutional channel for the data protection officer, taken from the
  // privacy policy published on the official site. A personal address here
  // would break the citizen's right of access under LGPD.
  dpo: {
    name: "Joelison Alves Marinho",
    email: "joelison@cartorioielmomarinhorn.com",
  },
  issRate: 0.05, // 5%, municipality joined the national NFS-e portal
  logos: {
    light: "/logos/CM-Logo-preto.png",
    dark: "/logos/CM-Logo-branco.png",
    seal: "/logos/CM-Sublogo-preto.png",
  },
  legalFooter:
    "Obedecendo à Lei de Acesso à Informação (LAI), Lei nº 12.527/2011, Ato normativo nº " +
    "0007427-48.2018.2.00.0000, Sessão 329ª, Resolução CNJ nº 215/2015, Lei nº 13.709/2018 (LGPD) " +
    "e Resolução CNJ nº 363/2020.",
});
