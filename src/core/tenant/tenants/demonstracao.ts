import { parseTenant, type Tenant } from "../schema.ts";

// Fictional office for demonstrations and the training videos: every
// attribution, so the panel shows its whole menu, and a name, a town and
// people that exist nowhere. The recordings in docs/treinamento are made
// over this office on the homologation database, never over a real one: a
// citizen's name on screen is a data incident for as long as the video
// exists. Like Aurora, `demo.atrioss.com` is a real host on a fictional
// office, so the deployed homologation can be recorded too; `demo.localhost`
// is the local run. scripts/seed-demo-data.ts fills its desk.
export const cartorioDemonstracao: Tenant = parseTenant({
  slug: "cartorio-demonstracao",
  hosts: ["demo.atrioss.com", "demo.localhost"],
  name: "Cartório de Serra Verde/RN",
  subtitle: "Ofício Único de Serra Verde / RN",
  about:
    "O Ofício Único de Serra Verde / RN reúne todos os serviços de registro e notas do " +
    "município. Esta é uma serventia de demonstração: nenhum dado aqui é de uma pessoa " +
    "real.",
  cns: "000002",
  municipality: "SERRA VERDE",
  address: "Praça da Matriz, 10, Centro, Serra Verde / RN, 59000-000",
  attributions: ["RCPN", "NOTAS", "RI", "PROTESTO", "RTD", "RCPJ"],
  contacts: {
    phone: "(84) 3000-0002",
    whatsapp: "(84) 3000-0002",
    email: "contato@cartorioserraverde.com.br",
  },
  openingHours: "Segunda a sexta, das 8h às 16h",
  counterHours: { startHour: 8, endHour: 16 },
  owner: {
    name: "Helena Cavalcanti de Araújo",
    status: "provido",
  },
  dpo: {
    name: "Rafael Nóbrega Lins",
    email: "dpo@cartorioserraverde.com.br",
  },
  issRate: 0.05,
  theme: "verde-dourado",
  logos: {
    light: "/logos/selo-padrao-preto.png",
    dark: "/logos/selo-padrao-branco.png",
    seal: {
      light: "/logos/selo-padrao-preto.png",
      dark: "/logos/selo-padrao-branco.png",
    },
  },
  legalFooter:
    "Obedecendo à Lei de Acesso à Informação (LAI), Lei nº 12.527/2011, Lei nº 13.709/2018 (LGPD) " +
    "e Resolução CNJ nº 363/2020.",
  home: { title: "Ofício Único de Serra Verde / RN" },
});
