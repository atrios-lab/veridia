import { parseTenant, type Tenant } from "../schema.ts";

// Real office (CNS 09.374-0), the oldest in the municipality (1866). Data
// taken from the office's own site (1cartoriodemacaibarn.com: address, hours,
// contact mailbox and the LGPD page naming the DPO) and from the Justiça
// Aberta survey (titular, attributions, phone), cross-checked with Gazeta do
// Povo and cartorio.net on 12/09/2026. Where the sources disagree the site
// wins: the aggregators still list the old landline (84) 3271-4414 and three
// different closing times, and the site is what the office itself publishes.
export const cartorioMacaiba1: Tenant = parseTenant({
  slug: "cartorio-macaiba-1",
  // The office's current site lives on 1cartoriodemacaibarn.com; the ".com.br"
  // below is the domain this platform answers on. Not registering the ".com"
  // here on purpose: while it still points at the old site, claiming it would
  // only matter once its DNS is moved, and that is the office's call.
  hosts: ["1cartoriomacaibarn.com.br", "macaiba.localhost"],
  name: "1º Cartório de Macaíba",
  // emailFrom: waiting on 1cartoriomacaibarn.com.br being verified in Postmark
  // (DKIM + Return-Path); until then the platform fallback sends. Pointing
  // it at a domain Postmark has not verified is worse than leaving it out:
  // the fallback delivers, an unverified From is refused outright.
  subtitle: "1º Ofício de Macaíba / RN",
  about:
    "O 1º Ofício de Macaíba / RN, criado em 1866, cuida das notas, do registro de imóveis, " +
    "do registro de títulos e documentos e do registro civil das pessoas jurídicas do " +
    "município. Sua função é dar segurança jurídica, autenticidade e publicidade aos atos " +
    "da vida do cidadão, dos negócios à propriedade.",
  cns: "093740",
  // O registro civil das pessoas naturais e o protesto ficam com o 2º Ofício
  // do município (CNS 09.537-2); este cartório é NOTAS, RI, RTD e RCPJ. O
  // registro de contratos marítimos que o Justiça Aberta lista não tem
  // atribuição própria aqui: entra em RTD.
  attributions: ["NOTAS", "RI", "RTD", "RCPJ"],
  contacts: {
    phone: "(84) 4042-0959",
    whatsapp: "(84) 4042-0959",
    // The mailbox the site publishes on its "Localização" page. The Justiça
    // Aberta declares atendimento@1cartoriodemacaiba.com.br instead; the site
    // is the more recent of the two and the one the office keeps.
    email: "1cartoriodemacaiba@gmail.com",
  },
  municipality: "MACAIBA",
  address: "Rua Ivanildo Gama Pacheco, 20, Centro, Macaíba - RN, 59280-000",
  // As published on the site's "Localização" page; aggregators still show
  // older schedules (until 17h or 17h30). ponytail: confirm with the office.
  openingHours: "Segunda a sexta, das 8h às 12h e das 13h30 às 16h",
  counterHours: { startHour: 8, endHour: 16 },
  owner: {
    // Titular desde 23/10/1989 no Justiça Aberta, que hoje marca a serventia
    // como "conversão em diligência"; fica "a confirmar" até a serventia
    // dizer o que isso significa para a titularidade.
    name: "Hilton Sales Chaves",
    status: "a confirmar",
  },
  dpo: {
    // Named on the office's own LGPD page (/atendimento-lgpd), with the
    // institutional mailbox it publishes there. Note the domain: the office
    // opened the DPO channel on the ".com", not on the ".com.br" served here.
    name: "Maria do Socorro Bezerra",
    email: "dpo@1cartoriomacaibarn.com",
  },
  issRate: 0.05, // ponytail: 5% assumed, confirm the Macaíba municipal rate
  theme: "marinho-bronze",
  home: { title: "1º Ofício de Macaíba / RN" }, // same text as `subtitle`
  // Marca padrão da plataforma para serventias sem identidade própria.
  // A serventia troca em Configurações > Identidade visual quando quiser.
  logos: {
    light: "/logos/selo-padrao-preto.png",
    dark: "/logos/selo-padrao-branco.png",
    seal: {
      light: "/logos/selo-padrao-preto.png",
      dark: "/logos/selo-padrao-branco.png",
    },
  },
  // Sem `revenue` de propósito. No levantamento do Justiça Aberta
  // (10/07/2026) o último semestre não tinha declaração (a planilha traz
  // zero, que o schema recusa por não ser um número de verdade), e só o
  // semestre anterior estava declarado: R$ 1.579.878,81. Como o schema
  // exige o semestre corrente, a Seção 1 fica em branco e a serventia
  // preenche; o valor anterior fica registrado aqui para quem for conferir.
  legalFooter:
    "Obedecendo à Lei de Acesso à Informação (LAI), Lei nº 12.527/2011, Lei nº 13.709/2018 (LGPD) " +
    "e Resolução CNJ nº 363/2020.",
});
