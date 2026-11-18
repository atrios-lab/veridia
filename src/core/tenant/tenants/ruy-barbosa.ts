import { parseTenant, type Tenant } from "../schema.ts";

// Real office (CNS 09.477-1), the single office of the municipality. No
// official site or social profile found. The data comes from the CNJ record
// itself, on the public Justiça Aberta portal (justicaaberta.cnj.jus.br/
// produtividade-serventia-extrajudicial/094771) on 17/11/2026: the record the
// office declares and keeps. The registries that mirror it are stale
// (sistemafederal.com.br still names a previous "respondendo" as titular and
// carries another phone and hours). The domain is the one the project owner
// registered for the office.
export const cartorioRuyBarbosa: Tenant = parseTenant({
  slug: "cartorio-ruy-barbosa",
  hosts: ["cartorioruybarbosarn.com.br", "ruybarbosa.localhost"],
  name: "Cartório de Ruy Barbosa",
  // emailFrom: waiting on cartorioruybarbosarn.com.br being verified in
  // Postmark (DKIM + Return-Path); until then the platform fallback sends.
  // Pointing it at a domain Postmark has not verified is worse than leaving
  // it out: the fallback delivers, an unverified From is refused outright.
  subtitle: "Ofício Único de Ruy Barbosa / RN",
  about:
    "O Ofício Único de Ruy Barbosa / RN reúne todos os serviços de registro e notas do " +
    "município. Sua função é dar segurança jurídica, autenticidade e publicidade aos atos " +
    "da vida do cidadão, do nascimento aos negócios.",
  cns: "094771",
  // Ofício único: the CNJ record lists registro civil das pessoas naturais,
  // notas, imóveis, títulos e documentos, pessoas jurídicas e protesto.
  attributions: ["RCPN", "NOTAS", "RI", "PROTESTO", "RTD", "RCPJ"],
  contacts: {
    // The CNJ record carries a single number; no mobile is published there,
    // so it doubles as the WhatsApp. (The official list of RN offices carries
    // a mobile, (84) 98873-9418, under the titular's name: likelier to be a
    // WhatsApp.)
    // ponytail: confirm the WhatsApp number with the office.
    phone: "(84) 4042-0591",
    whatsapp: "(84) 4042-0591",
    // Institutional mailbox on the office's own domain, not the Hotmail
    // address (oficiounicoruybarbosarn@hotmail.com) the CNJ record carries;
    // not created yet, same as the DPO one below.
    email: "contato@cartorioruybarbosarn.com.br",
  },
  municipality: "RUY BARBOSA",
  location: { city: "Ruy Barbosa", state: "RN" },
  address: "Rua Conjunto Novo, 02, Centro, Ruy Barbosa - RN, 59420-000",
  // As declared in the CNJ record ("Seg - Sex: 08:00-12:00 e 13:00-16:00");
  // the break is declared in `counterHours` so the scheduler skips it.
  // ponytail: confirm the hours with the office.
  openingHours: "Segunda a sexta, das 8h às 12h e das 13h às 16h",
  counterHours: {
    startHour: 8,
    endHour: 16,
    lunchBreak: { start: "12:00", end: "13:00" },
  },
  owner: {
    // The CNJ record marks the delegation "provido" with her as titular since
    // 15/07/2024. A TJRN resolution of March 2025 (reuniting the Lagoa de
    // Velhos office with this one) calls the delegatária "interventora", and
    // the schema has no such status; it stays "a confirmar" until the office
    // says which one holds today.
    name: "Patrícia Morais Monte Florêncio",
    status: "a confirmar",
  },
  dpo: {
    name: "Patrícia Morais Monte Florêncio",
    // Institutional mailbox not created yet; DPO channel is required by LGPD
    // regardless, so it is registered ahead of the mailbox existing.
    email: "dpo@cartorioruybarbosarn.com.br",
  },
  issRate: 0.05, // ponytail: 5% assumed, confirm the Ruy Barbosa municipal rate
  // Vinho e pérola: escolha de partida, trocável com uma edição.
  theme: "vinho-perola",
  home: { title: "Ofício Único de Ruy Barbosa / RN" }, // same text as `subtitle`
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
  // Receita bruta declarada no Justiça Aberta, lida no portal público em
  // 17/11/2026: 1º semestre de 2026 e 2º semestre de 2025. A serventia
  // confirma ou corrige na Seção 1 do módulo de adequação; é ponto de
  // partida, não resposta.
  revenue: {
    semester: 347722.18,
    previousSemester: 468414.94,
    source: "justica-aberta",
    extractedOn: "2026-11-17",
  },
  legalFooter:
    "Obedecendo à Lei de Acesso à Informação (LAI), Lei nº 12.527/2011, Lei nº 13.709/2018 (LGPD) " +
    "e Resolução CNJ nº 363/2020.",
});
