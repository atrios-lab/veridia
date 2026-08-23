import { parseTenant, type Tenant } from "../schema.ts";

// Real office (CNS 09.502-6). No official site among the sources checked:
// data taken from public registries (Gazeta do Povo, cartorio.net.br,
// Sistema Federal) and confirmed by the project owner where they disagreed,
// on 22/08/2026.
export const cartorioBentoFernandes: Tenant = parseTenant({
  slug: "cartorio-bento-fernandes",
  hosts: ["cartoriobentofernandesrn.com.br", "bentofernandes.localhost"],
  name: "Cartório de Bento Fernandes",
  emailFrom: "nao-responda@cartoriobentofernandesrn.com.br",
  subtitle: "Ofício Único de Bento Fernandes / RN",
  about:
    "O Ofício Único de Bento Fernandes / RN reúne todos os serviços de registro e notas do " +
    "município. Sua função é dar segurança jurídica, autenticidade e publicidade aos atos " +
    "da vida do cidadão, do nascimento aos negócios.",
  cns: "095026",
  attributions: ["RCPN", "NOTAS", "RI", "PROTESTO", "RTD", "RCPJ"],
  contacts: {
    phone: "(84) 4042-0779",
    whatsapp: "(84) 4042-0779",
    email: "contato@cartoriobentofernandesrn.com.br",
  },
  // ponytail: sources disagree on the exact schedule; 8h-17h assumed until
  // the office confirms
  openingHours: "Segunda a sexta, das 8h às 17h",
  counterHours: { startHour: 8, endHour: 17 },
  owner: {
    name: "Gladis Rosane Schmidt",
    status: "a confirmar",
  },
  dpo: {
    name: "Gladis Rosane Schmidt",
    // Institutional mailbox not created yet; DPO channel is required by LGPD
    // regardless, so it is registered ahead of the mailbox existing.
    email: "dpo@cartoriobentofernandesrn.com.br",
  },
  issRate: 0.05, // ponytail: 5% assumed, confirm the Bento Fernandes municipal rate
  theme: "oliva-terracota",
  home: { title: "Ofício Único de Bento Fernandes / RN" }, // same text as `subtitle`
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
