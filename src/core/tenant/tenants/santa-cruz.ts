import { parseTenant, type Tenant } from "../schema.ts";

// Real office (CNS 09.392-2). No official site reachable (2oficiosantacruz.com.br
// does not resolve): data taken from public registries (Gazeta do Povo,
// cartorio.net.br, both agreeing on CNS, address and titular) on 25/08/2026.
// Two phone numbers circulate for it, (84) 3291-4421 and (84) 4042-0437; the
// latter matches the RN notary association's numbering already seen at Bom
// Jesus, Taipu and Bento Fernandes, so it is the one registered here (worth
// confirming with the office either way).
export const cartorioSantaCruz2: Tenant = parseTenant({
  slug: "cartorio-santa-cruz-2",
  hosts: ["2cartoriosantacruzrn.com.br", "santacruz.localhost"],
  name: "2º Cartório de Santa Cruz",
  // emailFrom: waiting on 2cartoriosantacruzrn.com.br being verified in Postmark
  // (DKIM + Return-Path); until then the platform fallback sends. Pointing
  // it at a domain Postmark has not verified is worse than leaving it out:
  // the fallback delivers, an unverified From is refused outright.
  subtitle:
    "2º Tabelionato de Notas, Protestos e Ofício de Registro Civil de Santa Cruz / RN",
  about:
    "O 2º Tabelionato de Notas, Protestos e Ofício de Registro Civil de Santa Cruz / RN " +
    "cuida das notas, dos protestos de títulos e do registro civil das pessoas naturais " +
    "do município. Sua função é dar segurança jurídica, autenticidade e publicidade aos " +
    "atos da vida do cidadão, do nascimento aos negócios.",
  cns: "093922",
  // O registro de imóveis, títulos e documentos e o civil de pessoas jurídicas
  // ficam com o 1º Ofício do município; este cartório é NOTAS, PROTESTO e RCPN.
  attributions: ["RCPN", "NOTAS", "PROTESTO"],
  contacts: {
    // Endereço encontrado em agregadores públicos, confirmado independentemente
    // pela Gazeta do Povo e pelo cartorio.net.br.
    phone: "(84) 4042-0437",
    whatsapp: "(84) 4042-0437",
    email: "cartorio92@gmail.com",
  },
  address: "Travessa Paz União, 47, Centro, Santa Cruz - RN, 59200-000",
  openingHours: "Segunda a sexta, das 8h às 17h",
  counterHours: { startHour: 8, endHour: 17 },
  owner: {
    name: "Carla Bezerra de Andrade",
    status: "a confirmar",
  },
  dpo: {
    name: "Carla Bezerra de Andrade",
    // Institutional mailbox not created yet; DPO channel is required by LGPD
    // regardless, so it is registered ahead of the mailbox existing.
    email: "dpo@2cartoriosantacruzrn.com.br",
  },
  issRate: 0.05, // ponytail: 5% assumed, confirm the Santa Cruz municipal rate
  theme: "vinho-perola",
  home: {
    title:
      "2º Tabelionato de Notas, Protestos e Ofício de Registro Civil de Santa Cruz / RN",
  }, // same text as `subtitle`
  // Padrão novo para tenants sem marca própria enviada: a logo do Bom Jesus
  // (o livro, hoje publicada por ele no painel) em vez do placeholder CM
  // antigo, salva aqui como arquivo local: um logo em Blob externo passa
  // pelo `next/image`, que só carrega hosts listados em
  // `images.remotePatterns` (next.config.ts), montada a partir de
  // `BLOB_PUBLIC_HOST`; sem essa env var (CI, todo ambiente sem o Blob
  // configurado), a página inteira falha ao renderizar. A serventia troca
  // pela sua própria em Configurações > Identidade visual quando quiser.
  logos: {
    light: "/logos/livro-bomjesus-preto.png",
    dark: "/logos/livro-bomjesus-branco.png",
    seal: {
      light: "/logos/livro-bomjesus-preto.png",
      dark: "/logos/livro-bomjesus-branco.png",
    },
  },
  legalFooter:
    "Obedecendo à Lei de Acesso à Informação (LAI), Lei nº 12.527/2011, Lei nº 13.709/2018 (LGPD) " +
    "e Resolução CNJ nº 363/2020.",
});
