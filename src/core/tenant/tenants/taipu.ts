import { parseTenant, type Tenant } from "../schema.ts";

// Real office (CNS 09.377-3). No official site: data taken from public
// registries (Gazeta do Povo, Sistema Federal, both agreeing) and confirmed
// by the project owner where they didn't, on 22/08/2026.
export const cartorioTaipu: Tenant = parseTenant({
  slug: "cartorio-taipu",
  hosts: ["cartoriotaipurn.com", "taipu.localhost"],
  name: "Cartório de Taipu",
  emailFrom: "nao-responda@cartoriotaipurn.com",
  subtitle: "Serviço Único Notarial e Registral de Taipu / RN",
  about:
    "O Serviço Único Notarial e Registral de Taipu / RN reúne todos os serviços de registro " +
    "e notas do município. Sua função é dar segurança jurídica, autenticidade e publicidade " +
    "aos atos da vida do cidadão, do nascimento aos negócios.",
  cns: "093773",
  attributions: ["RCPN", "NOTAS", "RI", "PROTESTO", "RTD", "RCPJ"],
  contacts: {
    phone: "(84) 4042-0593",
    whatsapp: "(84) 4042-0593",
    email: "contato@cartoriotaipurn.com",
  },
  openingHours: "Segunda a sexta, das 8h às 12h e das 14h às 17h",
  counterHours: { startHour: 8, endHour: 17 },
  address: "Rua Salvina Soares de Miranda, 11-B, Centro, Taipu - RN, 59565-000",
  owner: {
    name: "Selma Teixeira de Menezes",
    status: "a confirmar",
  },
  dpo: {
    name: "Selma Teixeira de Menezes",
    // Institutional mailbox not created yet; DPO channel is required by LGPD
    // regardless, so it is registered ahead of the mailbox existing.
    email: "dpo@cartoriotaipurn.com",
  },
  issRate: 0.05, // ponytail: 5% assumed, confirm the Taipu municipal rate
  theme: "grafite-cobre",
  home: { title: "Serviço Único Notarial e Registral de Taipu / RN" }, // same text as `subtitle`
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
