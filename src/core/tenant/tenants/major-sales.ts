import { parseTenant, type Tenant } from "../schema.ts";

// Real office (CNS 09.507-5). No official site: data taken from public
// registries (Gazeta do Povo, cartorio.net.br) and confirmed by the project
// owner where those sources disagreed, on 22/08/2026.
export const cartorioMajorSales: Tenant = parseTenant({
  slug: "cartorio-major-sales",
  hosts: ["cartoriomajorsalesrn.com.br", "majorsales.localhost"],
  name: "Cartório de Major Sales",
  emailFrom: "nao-responda@cartoriomajorsales.com.br",
  subtitle: "Ofício Único de Major Sales / RN",
  about:
    "O Ofício Único de Major Sales / RN reúne todos os serviços de registro e notas " +
    "do município. Sua função é dar segurança jurídica, autenticidade e publicidade " +
    "aos atos da vida do cidadão, do nascimento aos negócios.",
  cns: "095075",
  attributions: ["RCPN", "NOTAS", "RI", "PROTESTO", "RTD", "RCPJ"],
  contacts: {
    phone: "(84) 3190-0980",
    whatsapp: "(84) 3190-0980",
    email: "contato@cartoriomajorsales.com.br",
  },
  // ponytail: hours vary across public sources (7h-17h, 8h-17h, 9h-17h);
  // 8h-17h assumed until the office confirms
  openingHours: "Segunda a sexta, das 8h às 17h",
  counterHours: { startHour: 8, endHour: 17 },
  owner: {
    name: "Patrícia Magna de Oliveira",
    status: "a confirmar",
  },
  dpo: {
    name: "Patrícia Magna de Oliveira",
    // Institutional mailbox not created yet; DPO channel is required by LGPD
    // regardless, so it is registered ahead of the mailbox existing.
    email: "dpo@cartoriomajorsales.com.br",
  },
  issRate: 0.05, // ponytail: 5% assumed, confirm the Major Sales municipal rate
  theme: "vinho-perola",
  home: { title: "Ofício Único de Major Sales / RN" }, // same text as `subtitle`
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
