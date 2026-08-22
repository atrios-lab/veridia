import { parseTenant, type Tenant } from "../schema.ts";

// Real pilot office. Data confirmed at handoff (18/07/2026); the owner was
// confirmed as "provido" on 24/07/2026, matching CNJ Justica Aberta.
export const cartorioMarinho: Tenant = parseTenant({
  slug: "cartorio-marinho",
  // The bare domain is enough: resolveTenant strips "www" and the port.
  // The ".localhost" entry is what lets a developer serve this office locally.
  hosts: ["cartorioielmomarinhorn.com", "marinho.localhost"],
  name: "Cartório Marinho",
  // emailFrom: waiting on cartorioielmomarinhorn.com being verified in
  // Postmark (DKIM + Return-Path); until then the platform fallback sends.
  subtitle: "Ofício Único de Ielmo Marinho / RN",
  about:
    "O Cartório Marinho é o Ofício Único de Ielmo Marinho / RN, o cartório que reúne " +
    "todos os serviços de registro e notas do município. Sua função é dar " +
    "segurança jurídica, autenticidade e publicidade aos atos da vida do cidadão, do " +
    "nascimento aos negócios.",
  cns: "094615",
  attributions: ["RCPN", "NOTAS", "RI", "PROTESTO", "RTD", "RCPJ"],
  contacts: {
    phone: "(84) 4042-0940",
    whatsapp: "(84) 4042-0940",
    email: "cartorioim@gmail.com",
  },
  address: "Rua José Camilo Bezerra, 44, Centro, Ielmo Marinho / RN",
  openingHours: "Segunda a sexta, das 8h às 14h",
  counterHours: { startHour: 8, endHour: 14 },
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
  theme: "verde-dourado", // the office's own green and gold, kept from the redesign
  heroImage: "/hero-home.jpg", // aerial photograph of Ielmo Marinho
  home: { title: "OFÍCIO ÚNICO DE IELMO MARINHO/RN" }, // same text as `subtitle`, today's hero behavior
  logos: {
    light: "/logos/CM-Logo-preto.png",
    dark: "/logos/CM-Logo-branco.png",
    seal: {
      light: "/logos/CM-Sublogo-preto.png",
      dark: "/logos/CM-Sublogo-branco.png",
    },
  },
  legalFooter:
    "Obedecendo à Lei de Acesso à Informação (LAI), Lei nº 12.527/2011, Ato normativo nº " +
    "0007427-48.2018.2.00.0000, Sessão 329ª, Resolução CNJ nº 215/2015, Lei nº 13.709/2018 (LGPD) " +
    "e Resolução CNJ nº 363/2020.",
});
