import { parseTenant, type Tenant } from "../schema.ts";

// Real office (CNS 09.420-1). No official site or social profile found.
// The registries disagree on everything here (four addresses, three
// titulars, three phones), so the data comes from the CNJ record itself, on
// the public Justiça Aberta portal (justicaaberta.cnj.jus.br/
// produtividade-serventia-extrajudicial/094201) on 09/10/2026: the record
// the office declares and keeps. cartorio.net.br mirrors the same record;
// Gazeta do Povo, cartorios.info and sistemafederal.com.br are stale. The
// domain is the one the project owner registered for the office.
export const cartorioJoaoCamara2: Tenant = parseTenant({
  slug: "cartorio-joao-camara-2",
  hosts: ["2cartoriojoaocamararn.com.br", "joaocamara.localhost"],
  name: "2º Cartório de João Câmara",
  // emailFrom: waiting on 2cartoriojoaocamararn.com.br being verified in
  // Postmark (DKIM + Return-Path); until then the platform fallback sends.
  // Pointing it at a domain Postmark has not verified is worse than leaving
  // it out: the fallback delivers, an unverified From is refused outright.
  subtitle: "2º Ofício de Notas, Protesto e Registro Civil de João Câmara / RN",
  about:
    "O 2º Ofício de Notas, Protesto e Registro Civil de João Câmara / RN cuida das " +
    "notas, dos protestos de títulos e do registro civil das pessoas naturais do " +
    "município. Sua função é dar segurança jurídica, autenticidade e publicidade aos " +
    "atos da vida do cidadão, do nascimento aos negócios.",
  cns: "094201",
  // O registro de imóveis, títulos e documentos e o civil de pessoas jurídicas
  // ficam com o 1º Ofício do município (CNS 09.379-9); o CNJ lista este
  // cartório como NOTAS, PROTESTO e RCPN.
  attributions: ["RCPN", "NOTAS", "PROTESTO"],
  contacts: {
    // The CNJ record carries a single number; no mobile is published there,
    // so it doubles as the WhatsApp.
    // ponytail: confirm the WhatsApp number with the office (a 4042 number
    // is unlikely to be one).
    phone: "(84) 4042-1044",
    whatsapp: "(84) 4042-1044",
    // Institutional mailbox on the office's own domain, not created yet, same
    // as the DPO one below. The CNJ record carries protestojc2@gmail.com, kept
    // here in case the office prefers it as the public contact.
    email: "contato@2cartoriojoaocamararn.com.br",
  },
  municipality: "JOAO CAMARA",
  location: { city: "João Câmara", state: "RN" },
  // The CNJ spells it "Antonio Proença"; the site carries the accent.
  address: "Rua Antônio Proença, 241, Centro, João Câmara - RN, 59550-000",
  openingHours: "Segunda a sexta, das 8h às 17h",
  counterHours: { startHour: 8, endHour: 17 },
  owner: {
    // The CNJ record marks the delegation "vago" with her as interim since
    // 13/05/2024, so the status is checked rather than "a confirmar".
    name: "Gladis Rosane Schmidt",
    status: "interino",
  },
  dpo: {
    name: "Gladis Rosane Schmidt",
    // Institutional mailbox not created yet; DPO channel is required by LGPD
    // regardless, so it is registered ahead of the mailbox existing.
    email: "dpo@2cartoriojoaocamararn.com.br",
  },
  issRate: 0.05, // ponytail: 5% assumed, confirm the João Câmara municipal rate
  theme: "oliva-terracota",
  home: {
    title: "2º Ofício de Notas, Protesto e Registro Civil de João Câmara / RN",
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
  // Receita bruta declarada no Justiça Aberta, lida no portal público em
  // 09/10/2026 (a serventia ficou de fora do levantamento de 10/07/2026):
  // 1º semestre de 2026 e 2º semestre de 2025. A serventia confirma ou
  // corrige na Seção 1 do módulo de adequação; é ponto de partida, não
  // resposta.
  revenue: {
    semester: 298905.11,
    previousSemester: 192976.58,
    source: "justica-aberta",
    extractedOn: "2026-10-09",
  },
  legalFooter:
    "Obedecendo à Lei de Acesso à Informação (LAI), Lei nº 12.527/2011, Lei nº 13.709/2018 (LGPD) " +
    "e Resolução CNJ nº 363/2020.",
});
