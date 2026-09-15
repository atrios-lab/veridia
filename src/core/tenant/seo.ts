import type { Tenant } from "./schema.ts";

/**
 * What a search engine shows for each page, per office. Pure: the pages
 * read it through `publicMetadata`, and the tests read it directly.
 *
 * Every description names the office, because that is what a citizen types
 * ("cartório de Ielmo Marinho", not "solicitar serviço"), and says what the
 * page does in the words the page itself uses. One template per page, the
 * office interpolated: a description written per office would be eight
 * copies of the same sentence to keep in step.
 */
export type PageMeta = {
  title: string;
  description: (tenant: Tenant) => string;
};

/**
 * Title of the home, and the fallback of every route that sets none: the
 * office's name and what it is. "Cartório Ielmo Marinho/RN" alone is what
 * nobody searches for; "Ofício Único de Ielmo Marinho / RN" carries the
 * kind of serventia and the town, which is what the query says.
 */
export function siteTitle(tenant: Tenant): string {
  return `${tenant.name} · ${tenant.subtitle}`;
}

export const PAGE_META: Record<string, PageMeta> = {
  "/": {
    title: "",
    description: (t) =>
      `${t.subtitle}. Peça certidões e atos, agende atendimento e acompanhe ` +
      "seu pedido pela internet, sem sair de casa.",
  },
  "/solicitar": {
    title: "Solicitar serviço",
    description: (t) =>
      `Peça certidões e atos do ${t.name} em 3 etapas, sem sair de casa: ` +
      "escolha a área, preencha o pedido e acompanhe pelo número do protocolo.",
  },
  "/agendar": {
    title: "Agendar atendimento",
    description: (t) =>
      `Marque dia e hora para ser atendido no balcão do ${t.name}. ` +
      `${t.openingHours}. Horário reservado no seu nome na hora.`,
  },
  "/acompanhar": {
    title: "Acompanhar pedido",
    description: (t) =>
      `Veja o andamento de um pedido feito ao ${t.name} com o número do ` +
      "protocolo e a chave de acesso recebida ao solicitar.",
  },
  "/editais": {
    title: "Editais",
    description: (t) =>
      `Proclamas de casamento e demais editais publicados pelo ${t.name}, ` +
      "organizados por setor, conforme a lei de cada atribuição.",
  },
  "/selo": {
    title: "Selo digital",
    description: (t) =>
      "Confira no sistema do Tribunal de Justiça se um documento emitido " +
      `pelo ${t.name} é autêntico, pelo código do selo digital impresso nele.`,
  },
  "/centrais": {
    title: "Centrais oficiais",
    description: (t) =>
      "Sites oficiais onde você pede certidões e resolve serviços de " +
      `cartório pela internet, indicados pelo ${t.name}. Evite sites falsos.`,
  },
  "/contato": {
    title: "Contato",
    description: (t) =>
      "Endereço, telefone, WhatsApp, e-mail e horário de atendimento do " +
      `${t.name}. ${t.openingHours}.`,
  },
  "/transparencia": {
    title: "Transparência",
    description: (t) =>
      "Tabela de emolumentos, documentos públicos e boletim mensal de " +
      `arrecadação do ${t.name}, na forma da Lei de Acesso à Informação.`,
  },
  "/lgpd": {
    title: "Canal LGPD",
    description: (t) =>
      `Canal do encarregado de dados do ${t.name}: peça acesso, correção ` +
      "ou exclusão dos seus dados pessoais, como manda a LGPD.",
  },
  "/ouvidoria": {
    title: "Ouvidoria",
    description: (t) =>
      `Registre elogio, reclamação, sugestão ou denúncia sobre o ${t.name}, ` +
      "com número de registro e resposta pelos canais oficiais.",
  },
  "/plataforma": {
    title: "Sobre a plataforma",
    description: (t) =>
      `Sob qual norma existe o site do ${t.name}, por onde os pedidos ` +
      "eletrônicos entram e como os seus dados pessoais são tratados.",
  },
  "/privacidade": {
    title: "Política de Privacidade",
    description: (t) =>
      `Quais dados pessoais o ${t.name} coleta pelo site, para quê, por ` +
      "quanto tempo e como exercer seus direitos, conforme a LGPD.",
  },
};

/**
 * The street address split the way schema.org wants it. The config holds
 * one line, written by hand per office, in two spellings so far:
 * "..., Centro, Ielmo Marinho / RN" and "..., Bom Jesus - RN, 59270-000".
 * Both end in town, separator, state, optional CEP; that tail is what this
 * reads. A line in neither shape goes whole into `streetAddress`, which is
 * still a valid address, only a less useful one.
 */
export function postalAddress(address: string): Record<string, string> {
  const match = address.match(
    /^(.*?),\s*([^,]+?)\s*[-/]\s*([A-Z]{2})(?:,\s*(\d{5}-?\d{3}))?\s*$/,
  );
  if (!match) {
    return {
      "@type": "PostalAddress",
      streetAddress: address,
      addressCountry: "BR",
    };
  }
  const [, street, locality, region, postalCode] = match;
  return {
    "@type": "PostalAddress",
    streetAddress: street,
    addressLocality: locality,
    addressRegion: region,
    ...(postalCode ? { postalCode } : {}),
    addressCountry: "BR",
  };
}

/** "(84) 4042-0940" as the international number a machine dials. */
export function telephone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function clock(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

/**
 * The office as a schema.org entity, for the JSON-LD every public page
 * carries. Both types on purpose: a cartório is a notary's office and a
 * civil registry at once, and a search engine reading either type gets
 * the same address, telephone and hours.
 *
 * The hours are the counter's (`counterHours`), Monday to Friday, the same
 * numbers the "Aberto agora" line reads: an office with a lunch break shows
 * the whole span, as the site itself does. The CNS is the one identifier a
 * serventia has that no other shares.
 */
export function organizationJsonLd(
  tenant: Tenant,
  origin: string,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": ["Notary", "GovernmentOffice"],
    "@id": `${origin}/#serventia`,
    name: tenant.name,
    alternateName: tenant.subtitle,
    description: tenant.about,
    url: origin,
    logo: `${origin}${tenant.logos.light}`,
    ...(tenant.heroImage ? { image: `${origin}${tenant.heroImage}` } : {}),
    telephone: telephone(tenant.contacts.phone),
    email: tenant.contacts.email,
    ...(tenant.address ? { address: postalAddress(tenant.address) } : {}),
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: WEEKDAYS,
        opens: clock(tenant.counterHours.startHour),
        closes: clock(tenant.counterHours.endHour),
      },
    ],
    identifier: {
      "@type": "PropertyValue",
      propertyID: "CNS",
      value: tenant.cns,
    },
  };
}

/**
 * The JSON-LD as the text of a script tag. "<" is escaped so that no string
 * from the config, however it is edited one day, can close the tag early:
 * the escape is JSON, so the parser reads the same value back.
 */
export function jsonLdScript(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
