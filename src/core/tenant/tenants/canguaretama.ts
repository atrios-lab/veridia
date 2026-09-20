import { parseTenant, type Tenant } from "../schema.ts";

// Real office (CNS 09.519-0), the single office of the municipality. No
// official site or social profile found: data taken from the public
// registries that mirror the CNJ record (Gazeta do Povo, cartorio.net.br,
// cartorio.info, sistemafederal.com.br, cartoriosdobrasil.org) on
// 20/09/2026. Unusually, they agree with each other on titular, address,
// landline and hours, so the address is registered. The domain is the one
// the project owner registered for the office.
export const cartorioCanguaretama: Tenant = parseTenant({
  slug: "cartorio-canguaretama",
  hosts: ["cartoriocanguaretamarn.com.br", "canguaretama.localhost"],
  name: "Cartório de Canguaretama",
  // emailFrom: waiting on cartoriocanguaretamarn.com.br being verified in
  // Postmark (DKIM + Return-Path); until then the platform fallback sends.
  // Pointing it at a domain Postmark has not verified is worse than leaving
  // it out: the fallback delivers, an unverified From is refused outright.
  subtitle: "Ofício Único de Registros e Notas de Canguaretama / RN",
  about:
    "O Ofício Único de Registros e Notas de Canguaretama / RN reúne todos os serviços de " +
    "registro e notas do município. Sua função é dar segurança jurídica, autenticidade e " +
    "publicidade aos atos da vida do cidadão, do nascimento aos negócios.",
  cns: "095190",
  // Ofício único: the CNJ record lists notas, protesto, registro civil das
  // pessoas naturais e jurídicas, imóveis e títulos e documentos. The
  // interdições e tutelas it also lists fold into RCPN.
  attributions: ["RCPN", "NOTAS", "RI", "PROTESTO", "RTD", "RCPJ"],
  contacts: {
    // Landline from the CNJ record, on every registry; no mobile is
    // published anywhere, so the landline doubles as the WhatsApp.
    // ponytail: confirm the WhatsApp number with the office.
    phone: "(84) 3241-2280",
    whatsapp: "(84) 3241-2280",
    // Institutional mailbox on the office's own domain, not the address the
    // registries carry; not created yet, same as the DPO one below.
    email: "contato@cartoriocanguaretamarn.com.br",
  },
  municipality: "CANGUARETAMA",
  address:
    "Rua André de Albuquerque, 155, Centro, Canguaretama - RN, 59190-000",
  // Every registry gives a lunch break; `counterHours` only holds start and
  // end, so the sentence carries the break and the numbers span the day.
  // ponytail: confirm the hours with the office.
  openingHours: "Segunda a sexta, das 8h às 12h e das 14h às 18h",
  counterHours: { startHour: 8, endHour: 18 },
  owner: {
    // Named titular on every registry; not yet checked against Justiça
    // Aberta the way the pilot was, so it stays "a confirmar".
    name: "Maria dos Ramos Freire Vieira",
    status: "a confirmar",
  },
  dpo: {
    name: "Maria dos Ramos Freire Vieira",
    // Institutional mailbox not created yet; DPO channel is required by LGPD
    // regardless, so it is registered ahead of the mailbox existing.
    email: "dpo@cartoriocanguaretamarn.com.br",
  },
  issRate: 0.05, // ponytail: 5% assumed, confirm the Canguaretama municipal rate
  theme: "marinho-bronze",
  home: { title: "Ofício Único de Registros e Notas de Canguaretama / RN" }, // same text as `subtitle`
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
  // Sem `revenue` de propósito: a serventia não entrou no levantamento do
  // Justiça Aberta de 10/07/2026. A Seção 1 do módulo de adequação fica em
  // branco e a serventia preenche; quando a Átrios levantar, entra aqui.
  legalFooter:
    "Obedecendo à Lei de Acesso à Informação (LAI), Lei nº 12.527/2011, Lei nº 13.709/2018 (LGPD) " +
    "e Resolução CNJ nº 363/2020.",
});
