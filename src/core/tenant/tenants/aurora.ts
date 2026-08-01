import { parseTenant, type Tenant } from "../schema.ts";

// Fictional second office, deliberately unlike the pilot: NOTAS only, so it
// has no notice board and no proclamas. A near copy of the pilot would prove
// nothing; the contrast is what catches data leaking between offices.
export const tabelionatoAurora: Tenant = parseTenant({
  slug: "tabelionato-aurora",
  hosts: ["tabelionatoaurora.com.br", "aurora.localhost"],
  name: "Tabelionato Aurora",
  subtitle: "2º Tabelionato de Notas de Aurora / RN",
  cns: "000000",
  attributions: ["NOTAS"],
  contacts: {
    phone: "(84) 3000-0000",
    whatsapp: "(84) 3000-0000",
    email: "contato@tabelionatoaurora.com.br",
  },
  openingHours: "Segunda a sexta, das 8h às 17h",
  owner: {
    name: "Antônio Bezerra da Silva",
    status: "interino",
  },
  dpo: {
    name: "Antônio Bezerra da Silva",
    email: "dpo@tabelionatoaurora.com.br",
  },
  issRate: 0.03, // 3%, different municipality from the pilot
  logos: {
    light: "/logos/CM-Logo-preto.png",
    dark: "/logos/CM-Logo-branco.png",
    seal: "/logos/CM-Sublogo-preto.png",
  },
  legalFooter:
    "Obedecendo à Lei de Acesso à Informação (LAI), Lei nº 12.527/2011, Lei nº 13.709/2018 (LGPD) " +
    "e Resolução CNJ nº 363/2020.",
  // Override on top of the gate: the office holds NOTAS, so protocol lookup
  // would be enabled, but it does not publish one yet.
  disabledSections: ["consulta-protocolo"],
});
