import { parseTenant, type Tenant } from "../schema.ts";

// Real office (CNS 09.554-7), the single office of the municipality. No
// official site or social profile found. The data comes from the CNJ record
// itself, on the public Justiça Aberta portal (justicaaberta.cnj.jus.br/
// produtividade-serventia-extrajudicial/095547) on 20/11/2026: the record the
// office declares and keeps. The domain is the one the project owner
// registered for the office.
export const cartorioCruzeta: Tenant = parseTenant({
  slug: "cartorio-cruzeta",
  hosts: ["cartoriocruzetarn.com.br", "cruzeta.localhost"],
  name: "Cartório de Cruzeta",
  // No `emailFrom` yet: a From on a domain Postmark has not verified is
  // refused, while the platform sender delivers. Filled with
  // nao-responda@cartoriocruzetarn.com.br once the domain is verified.
  subtitle: "Ofício Único de Cruzeta / RN",
  about:
    "O Ofício Único de Cruzeta / RN reúne todos os serviços de registro e notas do " +
    "município. Sua função é dar segurança jurídica, autenticidade e publicidade aos atos " +
    "da vida do cidadão, do nascimento aos negócios.",
  cns: "095547",
  // Ofício único: the CNJ record lists registro civil das pessoas naturais,
  // notas, protesto, imóveis, títulos e documentos e pessoas jurídicas.
  attributions: ["RCPN", "NOTAS", "RI", "PROTESTO", "RTD", "RCPJ"],
  contacts: {
    // The CNJ record carries a single number, a mobile, so it doubles as the
    // WhatsApp. (The official list of RN offices carries another mobile,
    // (84) 99408-8998, under the titular's name.)
    // ponytail: confirm the WhatsApp number with the office.
    phone: "(84) 99111-6958",
    whatsapp: "(84) 99111-6958",
    // Institutional mailbox on the office's own domain, not the Gmail
    // address (cartoriounicocruzeta@gmail.com) the CNJ record carries; not
    // created yet, same as the DPO one below.
    email: "contato@cartoriocruzetarn.com.br",
  },
  municipality: "CRUZETA",
  location: { city: "Cruzeta", state: "RN" },
  address: "Rua João Lopes de Araújo, 215, Centro, Cruzeta - RN, 59375-000",
  // As declared in the CNJ record ("Seg - Sex: 08:00-12:00 e 14:00-17:00");
  // the break is declared in `counterHours` so the scheduler skips it.
  // ponytail: confirm the hours with the office.
  openingHours: "Segunda a sexta, das 8h às 12h e das 14h às 17h",
  counterHours: {
    startHour: 8,
    endHour: 17,
    lunchBreak: { start: "12:00", end: "14:00" },
  },
  owner: {
    // The CNJ record marks the delegation "provido" with her as titular
    // since 15/07/2024.
    name: "Ivanka Franci Delgado Dantas Nobre Costa",
    status: "provido",
  },
  dpo: {
    name: "Ivanka Franci Delgado Dantas Nobre Costa",
    // Institutional mailbox not created yet; DPO channel is required by LGPD
    // regardless, so it is registered ahead of the mailbox existing.
    email: "dpo@cartoriocruzetarn.com.br",
  },
  issRate: 0.05, // ponytail: 5% assumed, confirm the Cruzeta municipal rate
  // Oliva e terracota: escolha de partida, trocável com uma edição.
  theme: "oliva-terracota",
  home: { title: "Ofício Único de Cruzeta / RN" }, // same text as `subtitle`
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
  // 20/11/2026: 1º semestre de 2026 e 2º semestre de 2025. A serventia
  // confirma ou corrige na Seção 1 do módulo de adequação; é ponto de
  // partida, não resposta.
  revenue: {
    semester: 902698.53,
    previousSemester: 913404.37,
    source: "justica-aberta",
    extractedOn: "2026-11-20",
  },
  legalFooter:
    "Obedecendo à Lei de Acesso à Informação (LAI), Lei nº 12.527/2011, Lei nº 13.709/2018 (LGPD) " +
    "e Resolução CNJ nº 363/2020.",
});
