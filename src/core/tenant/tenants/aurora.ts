import { parseTenant, type Tenant } from "../schema.ts";

// Fictional second office, deliberately unlike the pilot: NOTAS only, so it
// has no notice board and no proclamas. A near copy of the pilot would prove
// nothing; the contrast is what catches data leaking between offices.
export const tabelionatoAurora: Tenant = parseTenant({
  slug: "tabelionato-aurora",
  hosts: ["tabelionatoaurora.com.br", "aurora.localhost"],
  name: "Tabelionato Aurora",
  subtitle: "2º Tabelionato de Notas de Aurora / RN",
  about:
    "O Tabelionato Aurora é o 2º Tabelionato de Notas de Aurora / RN, cartório dedicado " +
    "a escrituras, procurações, autenticações e reconhecimento de firmas, com " +
    "segurança jurídica para o cidadão e para os negócios.",
  cns: "000000",
  attributions: ["RCPN", "NOTAS", "RI", "PROTESTO", "RTD", "RCPJ"],
  contacts: {
    phone: "(84) 3000-0000",
    whatsapp: "(84) 3000-0000",
    email: "contato@tabelionatoaurora.com.br",
  },
  openingHours: "Segunda a sexta, das 8h às 17h",
  counterHours: { startHour: 8, endHour: 17 },
  owner: {
    name: "Antônio Bezerra da Silva",
    status: "interino",
  },
  dpo: {
    name: "Antônio Bezerra da Silva",
    email: "dpo@tabelionatoaurora.com.br",
  },
  issRate: 0.03, // 3%, different municipality from the pilot
  // A different theme from the pilot, on purpose: two offices sharing one
  // palette would never catch the theme being hardcoded somewhere.
  theme: "marinho-bronze",
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
  // Override on top of the gate: the office holds NOTAS, so protocol lookup
  // would be enabled, but it does not publish one yet.
  disabledSections: ["consulta-protocolo"],
  home: { title: "2º Tabelionato de Notas de Aurora / RN" }, // same text as `subtitle`
});
