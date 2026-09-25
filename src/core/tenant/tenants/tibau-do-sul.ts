import { parseTenant, type Tenant } from "../schema.ts";

// Real office (CNS 09.521-6), the single office of the municipality,
// installed on 05/10/1995. No official site: data taken from the office's
// own Instagram (@oficiounicotibaudosul: address, WhatsApp, hours) and from
// public registries carrying the CNJ record (Gazeta do Povo, cartorio.net.br,
// cartorios.info, sistemafederal.com.br: CNS, titular, landline, mailbox) on
// 17/09/2026. Where the sources disagree the Instagram wins, since it is
// what the office itself publishes: the registries still show the old
// address (Rua Três Poderes, 270, Loja 02) and an 8h-18h schedule.
export const cartorioTibauDoSul: Tenant = parseTenant({
  slug: "cartorio-tibau-do-sul",
  hosts: ["cartoriotibaudosulrn.com.br", "tibaudosul.localhost"],
  name: "Cartório de Tibau do Sul",
  // emailFrom: waiting on cartoriotibaudosulrn.com.br being verified in
  // Postmark (DKIM + Return-Path); until then the platform fallback sends.
  // Pointing it at a domain Postmark has not verified is worse than leaving
  // it out: the fallback delivers, an unverified From is refused outright.
  subtitle: "Ofício Único de Tibau do Sul / RN",
  about:
    "O Ofício Único de Tibau do Sul / RN é o cartório que reúne todos os serviços de " +
    "registro e notas do município desde 1995. Sua função é dar segurança jurídica, " +
    "autenticidade e publicidade aos atos da vida do cidadão, do nascimento aos negócios.",
  cns: "095216",
  // Ofício único: the CNJ record lists notas, protesto, registro civil das
  // pessoas naturais e jurídicas, imóveis e títulos e documentos. The
  // marítimos, distribuição and interdições e tutelas it also lists have no
  // attribution of their own here: they fold into RTD and RCPN.
  attributions: ["RCPN", "NOTAS", "RI", "PROTESTO", "RTD", "RCPJ"],
  contacts: {
    // Landline from the CNJ record; the mobile is the one the Instagram
    // bio publishes, so it is the WhatsApp.
    phone: "(84) 3246-4071",
    whatsapp: "(84) 99688-1415",
    // The mailbox the CNJ record carries. Personal-looking, but it is the
    // only one the office declares anywhere. ponytail: confirm with the office.
    email: "bartfagundes@uol.com.br",
  },
  municipality: "TIBAU DO SUL",
  location: { city: "Tibau do Sul", state: "RN" },
  address:
    "Av. Governador Aluízio Alves, 174, Centro, Tibau do Sul - RN, 59178-000",
  // As the Instagram bio states; registries still show 8h-18h straight.
  // ponytail: confirm with the office.
  openingHours: "Segunda a sexta, das 8h às 12h e das 13h às 17h",
  counterHours: { startHour: 8, endHour: 17 },
  owner: {
    // Titular since installation (05/10/1995) per the CNJ record mirrored by
    // the registries (last CNJ update 15/07/2024); the substitute listed is
    // Bartolomeu Fagundes Bisneto. Not yet checked against Justiça Aberta
    // the way the pilot was, so it stays "a confirmar".
    name: "Benedito Fagundes Pereira",
    status: "a confirmar",
  },
  dpo: {
    name: "Benedito Fagundes Pereira",
    // Institutional mailbox not created yet; DPO channel is required by LGPD
    // regardless, so it is registered ahead of the mailbox existing.
    email: "dpo@cartoriotibaudosulrn.com.br",
  },
  issRate: 0.05, // ponytail: 5% assumed, confirm the Tibau do Sul municipal rate
  theme: "grafite-cobre",
  home: { title: "Ofício Único de Tibau do Sul / RN" }, // same text as `subtitle`
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
