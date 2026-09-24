import { parseTenant, type Tenant } from "../schema.ts";

// Real office (CNS 09.553-9), the single office of the municipality. No
// official site or social profile found: data taken from the public
// registries that mirror the CNJ record (Gazeta do Povo, sistemafederal.com.br,
// cartorionobrasil.com.br, ecartorios.com, cartorio.info) on 24/09/2026.
// They agree on titular, address and landline, so the address is registered;
// they disagree on the hours. The domain is the one the project owner
// registered for the office.
export const cartorioBrejinho: Tenant = parseTenant({
  slug: "cartorio-brejinho",
  hosts: ["cartoriobrejinhorn.com.br", "brejinho.localhost"],
  name: "Cartório de Brejinho",
  // emailFrom: waiting on cartoriobrejinhorn.com.br being verified in
  // Postmark (DKIM + Return-Path); until then the platform fallback sends.
  // Pointing it at a domain Postmark has not verified is worse than leaving
  // it out: the fallback delivers, an unverified From is refused outright.
  subtitle: "Ofício Único de Brejinho / RN",
  about:
    "O Ofício Único de Brejinho / RN reúne todos os serviços de registro e notas do " +
    "município. Sua função é dar segurança jurídica, autenticidade e publicidade aos atos " +
    "da vida do cidadão, do nascimento aos negócios.",
  cns: "095539",
  // Ofício único: the CNJ record lists notas, protesto, registro civil das
  // pessoas naturais e jurídicas, imóveis e títulos e documentos.
  attributions: ["RCPN", "NOTAS", "RI", "PROTESTO", "RTD", "RCPJ"],
  contacts: {
    // Landline from the CNJ record, on every registry; no mobile is
    // published anywhere, so the landline doubles as the WhatsApp.
    // ponytail: confirm the WhatsApp number with the office.
    phone: "(84) 3283-2071",
    whatsapp: "(84) 3283-2071",
    // Institutional mailbox on the office's own domain, not the Yahoo address
    // the registries carry; not created yet, same as the DPO one below.
    email: "contato@cartoriobrejinhorn.com.br",
  },
  municipality: "BREJINHO",
  address: "Av. Antônio Alves Pessoa, 1008, Centro, Brejinho - RN, 59219-000",
  // The registries disagree (7h30–17h, 8h–17h, 8h–12h and 14h–18h); the
  // split schedule is the one two of them share. `counterHours` only holds
  // start and end, so the sentence carries the break and the numbers span
  // the day.
  // ponytail: confirm the hours with the office.
  openingHours: "Segunda a sexta, das 8h às 12h e das 14h às 18h",
  counterHours: { startHour: 8, endHour: 18 },
  owner: {
    // Named titular on every registry (in office since 06/04/2023 per
    // ecartorios); not yet checked against Justiça Aberta the way the pilot
    // was, so it stays "a confirmar".
    name: "Antônio Paulino da Silva",
    status: "a confirmar",
  },
  dpo: {
    name: "Antônio Paulino da Silva",
    // Institutional mailbox not created yet; DPO channel is required by LGPD
    // regardless, so it is registered ahead of the mailbox existing.
    email: "dpo@cartoriobrejinhorn.com.br",
  },
  issRate: 0.05, // ponytail: 5% assumed, confirm the Brejinho municipal rate
  theme: "grafite-cobre",
  home: { title: "Ofício Único de Brejinho / RN" }, // same text as `subtitle`
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
