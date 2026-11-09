import { COURSES_TENANT_SLUG } from "../courses-tenant.ts";
import { parseTenant, type Tenant } from "../schema.ts";

// Fictional office where the course cohorts land: the clerks of offices
// that are not clients yet sign up here through a cohort link, take the
// course and look around a public site that behaves like their own would.
// Every attribution, so the site shows every section; a name, a town and
// people that exist nowhere, and marked `demo` so every public page says
// so. Not Serra Verde (demonstracao.ts): that one is recorded for the
// training videos, and the learners' accounts and filings would show up
// on screen. The e-mails go out from the platform's own sender: there is
// no `emailFrom` on purpose.
export const cartorioValeDoSilicio: Tenant = parseTenant({
  slug: COURSES_TENANT_SLUG,
  hosts: ["curso.atrioss.com", "curso.localhost"],
  name: "Cartório Vale do Silício",
  subtitle: "Ofício Único de Vale do Silício / RN",
  about:
    "O Ofício Único de Vale do Silício / RN é uma serventia de demonstração da " +
    "Átrios: a cidade, o cartório e as pessoas citadas aqui não existem. O site " +
    "funciona como o de um cartório de verdade, para você conhecer cada serviço.",
  cns: "000003",
  municipality: "VALE DO SILICIO",
  location: { city: "Vale do Silício", state: "RN" },
  address: "Rua das Startups, 100, Centro, Vale do Silício / RN, 59000-000",
  attributions: ["RCPN", "NOTAS", "RI", "PROTESTO", "RTD", "RCPJ"],
  contacts: {
    phone: "(84) 3000-0003",
    whatsapp: "(84) 3000-0003",
    email: "contato@cartoriovaledosilicio.exemplo",
  },
  openingHours: "Segunda a sexta, das 8h às 17h",
  counterHours: { startHour: 8, endHour: 17 },
  owner: {
    name: "Lívia Barros de Albuquerque",
    status: "provido",
  },
  dpo: {
    name: "Tiago Monteiro Dantas",
    email: "dpo@cartoriovaledosilicio.exemplo",
  },
  issRate: 0.05,
  theme: "grafite-cobre",
  logos: {
    light: "/logos/selo-padrao-preto.png",
    dark: "/logos/selo-padrao-branco.png",
    seal: {
      light: "/logos/selo-padrao-preto.png",
      dark: "/logos/selo-padrao-branco.png",
    },
  },
  legalFooter:
    "Serventia de demonstração. Obedecendo à Lei de Acesso à Informação (LAI), " +
    "Lei nº 12.527/2011, Lei nº 13.709/2018 (LGPD) e Resolução CNJ nº 363/2020.",
  home: { title: "Ofício Único de Vale do Silício / RN" },
  demo: true,
});
