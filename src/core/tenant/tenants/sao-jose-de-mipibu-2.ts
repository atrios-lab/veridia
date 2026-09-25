import { parseTenant, type Tenant } from "../schema.ts";

// Real office (CNS 09.394-8). No official site or social profile found:
// data taken from the public registries that mirror the CNJ record
// (cartorios.info and sistemafederal.com.br for address, phones, titular
// and substitute; Gazeta do Povo for the mailbox and hours) on 17/09/2026.
// The registries disagree more than usual here. Three addresses circulate
// (Rua Doutor Jerônimo, 76; Rua Coronel Trajano, 41; Praça Monsenhor Paiva,
// 17): the first is the one two independent mirrors of the CNJ record
// agree on, so it is the one registered. Installation date is given as
// 16/12/1933 by one mirror and 30/01/1956 by another, so the "about" text
// names no year. ponytail: confirm address and history with the office.
export const cartorioSaoJoseDeMipibu2: Tenant = parseTenant({
  slug: "cartorio-sao-jose-de-mipibu-2",
  hosts: ["2cartoriosaojosedemipiburn.com.br", "saojosedemipibu.localhost"],
  name: "2º Cartório de São José de Mipibu",
  // emailFrom: waiting on 2cartoriosaojosedemipiburn.com.br being verified
  // in Postmark (DKIM + Return-Path); until then the platform fallback
  // sends. Pointing it at a domain Postmark has not verified is worse than
  // leaving it out: the fallback delivers, an unverified From is refused.
  subtitle:
    "2º Ofício de Notas, Protesto e Registro Civil de São José de Mipibu / RN",
  about:
    "O 2º Ofício de Notas, Protesto e Registro Civil de São José de Mipibu / RN cuida " +
    "das notas, dos protestos de títulos e do registro civil das pessoas naturais do " +
    "município. Sua função é dar segurança jurídica, autenticidade e publicidade aos " +
    "atos da vida do cidadão, do nascimento aos negócios.",
  cns: "093948",
  // O registro de imóveis, títulos e documentos e o civil de pessoas jurídicas
  // ficam com o 1º Ofício do município (CNS 09.413-6); este cartório é NOTAS,
  // PROTESTO e RCPN. As interdições e tutelas que o CNJ lista entram em RCPN.
  attributions: ["RCPN", "NOTAS", "PROTESTO"],
  contacts: {
    // Landline from the CNJ record, on every registry; the mobile appears on
    // sistemafederal.com.br only, so it is the WhatsApp until confirmed.
    phone: "(84) 3273-2020",
    whatsapp: "(84) 98777-1235",
    email: "segundocartoriosjm@gmail.com",
  },
  // "SAO JOSE DE MIPIBU" has 18 characters and the Pix Merchant City field
  // takes 15, so the first name is abbreviated. Only the Pix payload reads
  // this; the citizen never sees it.
  municipality: "SAO J DE MIPIBU",
  location: { city: "São José de Mipibu", state: "RN" },
  address:
    "Rua Doutor Jerônimo, 76, Centro, São José de Mipibu - RN, 59162-000",
  openingHours: "Segunda a sexta, das 8h às 17h",
  counterHours: { startHour: 8, endHour: 17 },
  owner: {
    // The CNJ mirror names her responsible since 15/06/2015 but marks the
    // serventia "vago", which reads as an interim holding a vacant office;
    // an older mirror still names Francisco Araújo Fernandes (the "Cartório
    // F. A. Fernandes" trade name). Stays "a confirmar" until Justiça Aberta
    // or the office settles it.
    name: "Joseli Cristina da Silva Costa",
    status: "a confirmar",
  },
  dpo: {
    name: "Joseli Cristina da Silva Costa",
    // Institutional mailbox not created yet; DPO channel is required by LGPD
    // regardless, so it is registered ahead of the mailbox existing.
    email: "dpo@2cartoriosaojosedemipiburn.com.br",
  },
  issRate: 0.05, // ponytail: 5% assumed, confirm the São José de Mipibu municipal rate
  theme: "oliva-terracota",
  home: {
    title:
      "2º Ofício de Notas, Protesto e Registro Civil de São José de Mipibu / RN",
  }, // same text as `subtitle`
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
