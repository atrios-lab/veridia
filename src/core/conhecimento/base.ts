/**
 * The legal base the office teaches the AI with (decision of 15/11/2026:
 * "criar um campo específico para ensinar a IA, onde serão enviados
 * documentos jurídicos no geral, mas ela irá buscar sempre na fonte do
 * direito voltado para a Lei dos Registros Públicos, seus provimentos,
 * jurisprudências"). Each source is kept as text, split by article or
 * passage, never as the file. The search follows the hierarchy of the
 * sources of law: the law first, the norms of the CNJ and of the
 * Corregedoria, then the courts, the doctrine and, last, the models; a
 * model from another office is a reference of form, never copied.
 */

export const SOURCE_KINDS = {
  lei: { label: "Lei ou código", weight: 10 },
  decreto: { label: "Decreto", weight: 9 },
  "provimento-cnj": {
    label: "Provimento ou resolução do CNJ (Código Nacional de Normas)",
    weight: 9,
  },
  "provimento-cgj": {
    label: "Provimento ou código de normas da Corregedoria (CGJ/RN)",
    weight: 8,
  },
  jurisprudencia: {
    label: "Jurisprudência (STF, STJ, tribunais, CSM)",
    weight: 7,
  },
  enunciado: { label: "Enunciado ou parecer normativo", weight: 6 },
  doutrina: { label: "Doutrina", weight: 4 },
  "modelo-serventia": { label: "Modelo da serventia", weight: 3 },
  "modelo-externo": {
    label: "Modelo de outro cartório (referência, não copiar)",
    weight: 2,
  },
  outro: { label: "Outro documento", weight: 1 },
} as const;
export type SourceKind = keyof typeof SOURCE_KINDS;
export const isSourceKind = (value: string): value is SourceKind =>
  Object.hasOwn(SOURCE_KINDS, value);

/** The attributions a source serves (blank: all). */
export const SOURCE_AREAS = {
  ri: "Registro de Imóveis",
  rtd: "Títulos e Documentos",
  rcpj: "Pessoas Jurídicas",
  notas: "Notas",
  rcpn: "Registro Civil",
  protesto: "Protesto",
  // The Assistente do DPO reads these too (decision of 15/11/2026: the
  // office teaches the DPO through the Base jurídica).
  lgpd: "Proteção de dados (LGPD)",
  geral: "Geral",
} as const;
export type SourceArea = keyof typeof SOURCE_AREAS;

export interface SourceMeta {
  kind: SourceKind;
  title: string;
  /** "Lei nº 6.015/1973", "Provimento CNJ nº 149/2023", "REsp 1.234.567". */
  reference: string;
  issuer: string;
  /** ISO date of the norm or the decision, when known. */
  date: string;
  /** A revoked source stays for history and is not used. */
  status: "vigente" | "revogada";
  url: string;
  areas: SourceArea[];
  notes: string;
  /**
   * A new version replaced this one (a new import, or the text changed):
   * kept for history, left out of the search. Nothing is deleted.
   */
  replacedBy?: string;
  /** The version this one replaced. */
  replaces?: string;
  /** The last check on the official source, by the AI. */
  check?: SourceCheck;
  /**
   * What looked wrong when it was read (sourceWarnings): while there is
   * any, the source is "em conferência" and not used.
   */
  pending?: string[];
}

/** What the AI found on the official site about a source. */
export interface SourceCheck {
  /** ISO date and time of the check. */
  on: string;
  result: "em-dia" | "alterada" | "revogada" | "incerta";
  summary: string;
  /** The official address of the text in force. */
  url: string;
}

export const CHECK_LABELS: Record<SourceCheck["result"], string> = {
  "em-dia": "Em dia com a fonte oficial",
  alterada: "Alterada depois do texto guardado",
  revogada: "Revogada na fonte oficial",
  incerta: "Não foi possível confirmar",
};

function checkFrom(raw: unknown): SourceCheck | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const result = String(r.result ?? "");
  if (!Object.hasOwn(CHECK_LABELS, result)) return undefined;
  const url = typeof r.url === "string" ? r.url : "";
  return {
    on: typeof r.on === "string" ? r.on.slice(0, 40) : "",
    result: result as SourceCheck["result"],
    summary: typeof r.summary === "string" ? r.summary.slice(0, 3000) : "",
    url: isOfficialUrl(url) ? url : "",
  };
}

/** The meta as stored, with every field checked (an old row, a hand edit). */
export function metaFrom(raw: unknown): SourceMeta {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const str = (v: unknown, max = 500) =>
    typeof v === "string" ? v.trim().slice(0, max) : "";
  const kind = str(r.kind);
  const areas = Array.isArray(r.areas)
    ? r.areas.filter(
        (a): a is SourceArea =>
          typeof a === "string" && Object.hasOwn(SOURCE_AREAS, a),
      )
    : [];
  return {
    kind: isSourceKind(kind) ? kind : "outro",
    title: str(r.title, 300),
    reference: str(r.reference, 200),
    issuer: str(r.issuer, 200),
    date: /^\d{4}-\d{2}-\d{2}$/.test(str(r.date)) ? str(r.date) : "",
    status: r.status === "revogada" ? "revogada" : "vigente",
    url: str(r.url, 1000),
    areas: [...new Set(areas)],
    notes: str(r.notes, 5000),
    ...(str(r.replacedBy) ? { replacedBy: str(r.replacedBy) } : {}),
    ...(str(r.replaces) ? { replaces: str(r.replaces) } : {}),
    ...(checkFrom(r.check) ? { check: checkFrom(r.check) } : {}),
    ...(Array.isArray(r.pending) && r.pending.length
      ? {
          pending: r.pending
            .filter((p): p is string => typeof p === "string")
            .map((p) => p.slice(0, 500))
            .slice(0, 10),
        }
      : {}),
  };
}

export const emptyMeta = (): SourceMeta => ({
  kind: "lei",
  title: "",
  reference: "",
  issuer: "",
  date: "",
  status: "vigente",
  url: "",
  areas: [],
  notes: "",
});

export function metaProblems(meta: SourceMeta): string[] {
  const problems: string[] = [];
  if (!meta.title.trim()) problems.push("Dê um título à fonte.");
  if (meta.date && !/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) {
    problems.push("Data inválida.");
  }
  if (meta.url && !/^https:\/\/[^\s]+$/i.test(meta.url)) {
    problems.push("O endereço da fonte deve começar com https://.");
  }
  return problems;
}

// ---------------------------------------------------------------- text

/** Text as read from any source: one space per run, paragraphs kept. */
export function cleanText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ordm: "º",
  ordf: "ª",
  sect: "§",
  deg: "°",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, code: string) => {
    if (code.startsWith("#x") || code.startsWith("#X")) {
      return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    }
    if (code.startsWith("#"))
      return String.fromCodePoint(Number(code.slice(1)));
    if (ENTITIES[code.toLowerCase()])
      return ENTITIES[code.toLowerCase()] ?? whole;
    // The accented letters of Portuguese: &aacute; &ccedil; &atilde;...
    const letter = /^([a-z])(acute|grave|circ|tilde|cedil|uml)$/i.exec(code);
    if (letter?.[1]) {
      const marks: Record<string, string> = {
        acute: "́",
        grave: "̀",
        circ: "̂",
        tilde: "̃",
        cedil: "̧",
        uml: "̈",
      };
      return `${letter[1]}${marks[letter[2]?.toLowerCase() ?? ""] ?? ""}`.normalize(
        "NFC",
      );
    }
    return whole;
  });
}

/**
 * The text in force of an official page (the Planalto's compiled laws, the
 * CNJ's acts): the passages struck through as revoked or altered are left
 * out, as are scripts and styles; paragraphs are kept.
 */
export function textFromHtml(html: string): string {
  const body =
    html
      .replace(/<(script|style|head)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<(strike|s|del)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h\d|table)>/gi, "\n")
      .replace(/<[^>]+>/g, " ") ?? "";
  return cleanText(decodeEntities(body))
    .split("\n")
    .filter(
      (line) => !/^\(\s*(revogad[oa]|vetad[oa])[^)]*\)\.?$/i.test(line.trim()),
    )
    .join("\n");
}

/**
 * Any text read from a source as Markdown (decision of 15/11/2026: "ao
 * receber os documentos, transforme-os em MD para facilitar"): the parts
 * of a norm (livro, título, capítulo, seção) as sections, each article as
 * a heading with its caput below, parágrafos in bold, incisos and alíneas
 * as lists; any other text as paragraphs. The wording itself is kept.
 */
export function toMarkdown(text: string, title = ""): string {
  const out: string[] = title.trim() ? [`# ${title.trim()}`] : [];
  for (const raw of cleanText(text).split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const article = ARTICLE.exec(line);
    if (article?.[1]) {
      const heading = article[1]
        .replace(/\s+/g, " ")
        .replace(/\s*[º°o]$/i, "º")
        .trim();
      const caput = line
        .slice(article[0].length)
        .replace(/^[\s.:\u2013\u2014-]+/, "");
      out.push(`## ${heading}`);
      if (caput) out.push(caput);
      continue;
    }
    if (
      /^(LIVRO|T[ÍI]TULO|CAP[ÍI]TULO)\b/.test(line) &&
      line === line.toUpperCase()
    ) {
      out.push(`### ${line}`);
      continue;
    }
    if (/^(SE[ÇC][ÃA]O|SUBSE[ÇC][ÃA]O)\b/i.test(line) && line.length < 120) {
      out.push(`#### ${line}`);
      continue;
    }
    const paragraph = /^(§\s*\d+[º°o]?|Par[áa]grafo [úu]nico\.?)(.*)$/i.exec(
      line,
    );
    if (paragraph) {
      out.push(`**${paragraph[1]?.trim()}**${paragraph[2] ?? ""}`);
      continue;
    }
    if (/^[IVXLC]{1,7}\s*[\u2013\u2014-]\s+/.test(line)) {
      out.push(`- ${line}`);
      continue;
    }
    if (/^[a-z]\)\s+/.test(line)) {
      out.push(`  - ${line}`);
      continue;
    }
    out.push(line);
  }
  return out.join("\n\n");
}

export interface Passage {
  /** "Art. 198", "Art. 1.245", or the passage's first words. */
  heading: string;
  text: string;
}

const ARTICLE = /^(Art\.?\s*\d{1,4}(?:\.\d{3})?(?:-[A-Z]{1,2})?\s*[º°o]?)/i;
const MAX_PASSAGE = 4000;

function firstWords(text: string): string {
  const words = text.split(/\s+/).slice(0, 8).join(" ");
  return words.length < text.length ? `${words}...` : words;
}

/**
 * The source split for the search: by article when it is a norm written
 * in articles, else by paragraphs of about 1.500 characters. A long
 * article is cut in parts that keep its heading.
 */
export function splitPassages(text: string): Passage[] {
  const clean = cleanText(text);
  if (!clean) return [];
  // Markdown headings ("## Art. 1º") are read as the article lines.
  const lines = clean.split("\n").map((l) => l.replace(/^#{2}\s+(?=Art)/i, ""));
  const articles = lines.filter((l) => ARTICLE.test(l.trim())).length;
  const passages: Passage[] = [];
  const push = (heading: string, body: string) => {
    const t = body.trim();
    if (!t) return;
    for (let i = 0; i < t.length; i += MAX_PASSAGE) {
      passages.push({
        heading: i === 0 ? heading : `${heading} (continuação)`,
        text: t.slice(i, i + MAX_PASSAGE),
      });
    }
  };
  if (articles >= 3) {
    let heading = "Preâmbulo";
    let current: string[] = [];
    for (const line of lines) {
      const match = ARTICLE.exec(line.trim());
      if (match?.[1]) {
        push(heading, current.join("\n"));
        heading = match[1]
          .replace(/\s+/g, " ")
          .replace(/\s*[º°o]$/i, "º")
          .trim();
        current = [
          `## ${match[1]
            .replace(/\s+/g, " ")
            .replace(/\s*[º°o]$/i, "º")
            .trim()}${line.trim().slice(match[1].length)}`,
        ];
      } else current.push(line);
    }
    push(heading, current.join("\n"));
    return passages;
  }
  let current = "";
  for (const paragraph of clean.split(/\n{2,}|\n/)) {
    if (current && current.length + paragraph.length > 1500) {
      push(firstWords(current), current);
      current = "";
    }
    current = current ? `${current}\n${paragraph}` : paragraph;
  }
  push(firstWords(current), current);
  return passages;
}

// ---------------------------------------------------------------- search

const STOPWORDS = new Set(
  "a o as os de da do das dos e em no na nos nas um uma uns umas por para com sem que se ao aos à às ou ser é são foi pelo pela pelos pelas sua seu suas seus como mais quando qual quais este esta isso essa esse".split(
    " ",
  ),
);

/** Lowercase, without accents: "Exigência" → "exigencia". */
export const fold = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function searchTerms(query: string): string[] {
  return [
    ...new Set(
      fold(query)
        .split(/[^a-z0-9.]+/)
        .map((t) => t.replace(/^\.+|\.+$/g, ""))
        .filter((t) => t.length >= 3 && !STOPWORDS.has(t)),
    ),
  ];
}

/** "art. 198", "artigo 1.245" → the article asked for, when the query names one. */
export function articleIn(query: string): string | undefined {
  const m = /\bart(?:igo)?\.?\s*(\d{1,4}(?:\.\d{3})?(?:-[a-z]{1,2})?)/i.exec(
    query,
  );
  return m?.[1]?.toUpperCase();
}

export interface Candidate {
  sourceId: string;
  /** The passage itself, when it came from the database. */
  passageId?: string;
  kind: SourceKind;
  status: SourceMeta["status"];
  reference: string;
  title: string;
  heading: string;
  text: string;
}

export interface Hit extends Candidate {
  score: number;
}

/**
 * The passages that answer the query, best first: how many of its terms
 * each one has, the article named in the query, and the weight of the
 * source in the hierarchy. A revoked source is left out.
 */
export function rankPassages(
  query: string,
  candidates: Candidate[],
  limit = 20,
): Hit[] {
  const terms = searchTerms(query);
  const article = articleIn(query);
  if (terms.length === 0 && !article) return [];
  const hits: Hit[] = [];
  for (const c of candidates) {
    if (c.status === "revogada") continue;
    if (isRevokedPassage(c.text)) continue;
    const text = fold(`${c.heading} ${c.text}`);
    let matched = 0;
    let frequency = 0;
    for (const term of terms) {
      const count = text.split(term).length - 1;
      if (count > 0) {
        matched += 1;
        frequency += Math.min(count, 5);
      }
    }
    const articleHit =
      article !== undefined &&
      fold(c.heading)
        .replace(/\s+/g, " ")
        .startsWith(`art. ${fold(article)}`);
    if (matched === 0 && !articleHit) continue;
    const coverage = terms.length ? matched / terms.length : 0;
    const score =
      coverage * 100 +
      frequency * 2 +
      (articleHit ? 80 : 0) +
      SOURCE_KINDS[c.kind].weight * 3;
    hits.push({ ...c, score: Math.round(score) });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

// ---------------------------------------------------------------- catalog

/**
 * The basic norms of the registros públicos, with the official address of
 * the text in force, to import in one click (the office adds the rest).
 */
export const OFFICIAL_CATALOG: (SourceMeta & { key: string })[] = [
  {
    key: "lei-6015",
    kind: "lei",
    title: "Lei dos Registros Públicos",
    reference: "Lei nº 6.015/1973",
    issuer: "Presidência da República",
    date: "1973-12-31",
    status: "vigente",
    url: "https://www.planalto.gov.br/ccivil_03/leis/l6015compilada.htm",
    areas: ["ri", "rtd", "rcpj", "rcpn"],
    notes: "",
  },
  {
    key: "lei-8935",
    kind: "lei",
    title: "Lei dos Notários e Registradores",
    reference: "Lei nº 8.935/1994",
    issuer: "Presidência da República",
    date: "1994-11-18",
    status: "vigente",
    url: "https://www.planalto.gov.br/ccivil_03/leis/l8935.htm",
    areas: ["geral"],
    notes: "",
  },
  {
    key: "codigo-civil",
    kind: "lei",
    title: "Código Civil",
    reference: "Lei nº 10.406/2002",
    issuer: "Presidência da República",
    date: "2002-01-10",
    status: "vigente",
    url: "https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm",
    areas: ["geral"],
    notes: "",
  },
  {
    key: "lei-14382",
    kind: "lei",
    title: "Sistema Eletrônico dos Registros Públicos (SERP)",
    reference: "Lei nº 14.382/2022",
    issuer: "Presidência da República",
    date: "2022-06-27",
    status: "vigente",
    url: "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2022/lei/l14382.htm",
    areas: ["ri", "rtd", "rcpj"],
    notes: "",
  },
  {
    key: "lei-7433",
    kind: "lei",
    title: "Requisitos da lavratura de escrituras públicas",
    reference: "Lei nº 7.433/1985",
    issuer: "Presidência da República",
    date: "1985-12-18",
    status: "vigente",
    url: "https://www.planalto.gov.br/ccivil_03/leis/l7433.htm",
    areas: ["ri", "notas"],
    notes: "",
  },
  {
    key: "decreto-93240",
    kind: "decreto",
    title: "Regulamento da Lei nº 7.433/1985",
    reference: "Decreto nº 93.240/1986",
    issuer: "Presidência da República",
    date: "1986-09-09",
    status: "vigente",
    url: "https://www.planalto.gov.br/ccivil_03/decreto/d93240.htm",
    areas: ["ri", "notas"],
    notes: "",
  },
  {
    key: "lei-10267",
    kind: "lei",
    title: "Georreferenciamento de imóveis rurais",
    reference: "Lei nº 10.267/2001",
    issuer: "Presidência da República",
    date: "2001-08-28",
    status: "vigente",
    url: "https://www.planalto.gov.br/ccivil_03/leis/leis_2001/l10267.htm",
    areas: ["ri"],
    notes: "",
  },
  {
    key: "decreto-4449",
    kind: "decreto",
    title: "Regulamento do georreferenciamento",
    reference: "Decreto nº 4.449/2002",
    issuer: "Presidência da República",
    date: "2002-10-30",
    status: "vigente",
    url: "https://www.planalto.gov.br/ccivil_03/decreto/2002/d4449.htm",
    areas: ["ri"],
    notes: "",
  },
  {
    key: "lei-13465",
    kind: "lei",
    title: "Regularização fundiária (Reurb)",
    reference: "Lei nº 13.465/2017",
    issuer: "Presidência da República",
    date: "2017-07-11",
    status: "vigente",
    url: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2017/lei/l13465.htm",
    areas: ["ri"],
    notes: "",
  },
  {
    key: "lei-8906",
    kind: "lei",
    title: "Estatuto da Advocacia (visto em atos constitutivos)",
    reference: "Lei nº 8.906/1994",
    issuer: "Presidência da República",
    date: "1994-07-04",
    status: "vigente",
    url: "https://www.planalto.gov.br/ccivil_03/leis/l8906.htm",
    areas: ["rcpj"],
    notes: "",
  },
  {
    key: "prov-cnj-149",
    kind: "provimento-cnj",
    title: "Código Nacional de Normas do Foro Extrajudicial",
    reference: "Provimento CNJ nº 149/2023",
    issuer: "Corregedoria Nacional de Justiça",
    date: "2023-08-30",
    status: "vigente",
    url: "https://atos.cnj.jus.br/atos/detalhar/5243",
    areas: ["geral"],
    notes: "",
  },
];

/** The hosts an official text may be imported from. */
export const OFFICIAL_HOSTS = [
  "www.planalto.gov.br",
  "planalto.gov.br",
  "atos.cnj.jus.br",
  "www.cnj.jus.br",
  "www.tjrn.jus.br",
  "www.stj.jus.br",
  "scon.stj.jus.br",
  "portal.stf.jus.br",
  "www.in.gov.br",
] as const;

/**
 * The legal sources' own sites, the only ones the AI consults (decision of
 * 15/11/2026: "buscar apenas na fonte jurídica"): the federal laws and
 * decrees, the Diário Oficial, the Judiciary (CNJ, STF, STJ, tribunais and
 * their corregedorias, all under jus.br), LexML and the legislatures (the
 * Senado's compiled texts at normas.leg.br, which answers from abroad when
 * the Planalto does not). A subdomain of
 * one of these counts; any other site does not.
 */
export const LEGAL_SOURCE_DOMAINS = [
  "planalto.gov.br",
  "in.gov.br",
  "lexml.gov.br",
  "jus.br",
  // The legislatures: Câmara, Senado (and its compiled texts at
  // normas.leg.br) and the state assemblies.
  "leg.br",
] as const;

export function isOfficialUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return (
      parsed.protocol === "https:" &&
      ((OFFICIAL_HOSTS as readonly string[]).includes(host) ||
        LEGAL_SOURCE_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`)))
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- review

/** A CPF written in the text (000.000.000-00), with valid digits. */
function hasCpf(text: string): boolean {
  for (const m of text.matchAll(/\b(\d{3})\.(\d{3})\.(\d{3})-(\d{2})\b/g)) {
    const d = `${m[1]}${m[2]}${m[3]}${m[4]}`.split("").map(Number);
    if (new Set(d).size === 1) continue;
    const digit = (n: number) => {
      const sum = d.slice(0, n).reduce((acc, v, i) => acc + v * (n + 1 - i), 0);
      const rest = (sum * 10) % 11;
      return rest === 10 ? 0 : rest;
    };
    if (digit(9) === d[9] && digit(10) === d[10]) return true;
  }
  return false;
}

const LEGAL_WORDS =
  /\bart\.|\b(?:artigo|lei|decreto|provimento|resolu[cç][aã]o|par[aá]grafo|inciso|al[ií]nea|ac[oó]rd[aã]o|ementa|recurso|registro|cart[oó]rio|serventia|oficial|tabeli[aã]o|nota devolutiva|exig[eê]ncias?|enunciado|s[uú]mula)\b/gi;

/** The numbers of a reference ("Lei nº 6.015/1973" → ["6.015", "6015"]). */
function referenceNumbers(reference: string): string[] {
  const m = /(\d{1,3}(?:\.\d{3})+|\d{2,6})/.exec(reference);
  if (!m?.[1]) return [];
  return [...new Set([m[1], m[1].replace(/\./g, "")])];
}

/**
 * What may be wrong with a document before it goes into the base (decision
 * of 15/11/2026: "você mesmo já sugira o erro e não use como base"). Any
 * of these keeps the source "em conferência", out of the search, until a
 * person confirms it or sends the right file.
 */
export function sourceWarnings(
  meta: SourceMeta,
  markdown: string,
  viaAi = false,
): string[] {
  const warnings: string[] = [];
  const text = markdown.slice(0, 400_000);
  const legal = text.match(LEGAL_WORDS)?.length ?? 0;
  if (legal < 3) {
    warnings.push(
      "O texto não parece documento jurídico (quase não tem artigo, lei, provimento, decisão ou registro). Confira se é o arquivo certo.",
    );
  }
  const numbers = referenceNumbers(meta.reference);
  if (numbers.length > 0 && !numbers.some((n) => text.includes(n))) {
    warnings.push(
      `O número da referência (${meta.reference}) não aparece no texto. Confira se é o arquivo certo.`,
    );
  }
  if (
    meta.kind !== "modelo-serventia" &&
    meta.kind !== "modelo-externo" &&
    hasCpf(text)
  ) {
    warnings.push(
      "O texto tem CPF de pessoa. Documento de cliente não deve ir para a base (LGPD): troque por modelo sem dados reais.",
    );
  } else if (hasCpf(text)) {
    warnings.push(
      "O modelo tem CPF de pessoa. Tire os dados reais (LGPD) antes de usar: troque o arquivo por um modelo com dados fictícios.",
    );
  }
  if (viaAi) {
    warnings.push(
      "O texto foi lido pelo Assistente Virtual a partir de imagem ou PDF digitalizado. Confira a transcrição antes de usar.",
    );
  }
  return warnings;
}

/* ------------------------------------------------ norms revoked by a text */

/**
 * A norm named in a text, as a key to compare: its kind, number and year
 * ("provimento:149:2023"). The year may be missing.
 */
export interface NormRef {
  kind: string;
  number: string;
  year?: string;
}

const NORM_KINDS =
  "lei complementar|lei|decreto-lei|decreto|provimento|resolu[cç][aã]o|portaria|instru[cç][aã]o normativa|recomenda[cç][aã]o|medida provis[oó]ria|ato normativo";
const NORM_MENTION = new RegExp(
  `\\b(${NORM_KINDS})(?:s|es)?\\b([^.;\\n]{0,80}?)\\bn(?:º|°|o|\\.)?(?:s)?\\.?\\s*((?:[\\d.]+(?:\\s*\\/\\s*\\d{2,4})?)(?:\\s*(?:,|e)\\s*[\\d.]+(?:\\s*\\/\\s*\\d{2,4})?)*)(?:,?\\s*de\\s+(?:\\d{1,2}\\s+de\\s+[a-zç]+\\s+de\\s+)?(\\d{4}))?`,
  "gi",
);

function kindKey(kind: string): string {
  return fold(kind).replace(/\s+/g, "-");
}

/** Every norm a stretch of text names, with its number and year. */
export function normsIn(text: string): NormRef[] {
  const found: NormRef[] = [];
  for (const m of text.matchAll(NORM_MENTION)) {
    const kind = kindKey(m[1] ?? "");
    const years = m[4];
    for (const part of (m[3] ?? "").split(/\s*(?:,|\be\b)\s*/)) {
      const [num, y] = part.split("/").map((p) => p.trim());
      const number = (num ?? "").replace(/\./g, "");
      if (!/^\d+$/.test(number)) continue;
      const year = y ? (y.length === 2 ? `20${y}` : y) : years;
      found.push({ kind, number, ...(year ? { year } : {}) });
    }
  }
  return found;
}

/** The norm a source is, by its reference or, without one, its title. */
export function normOf(meta: Pick<SourceMeta, "reference" | "title">) {
  return normsIn(meta.reference)[0] ?? normsIn(meta.title)[0];
}

export function sameNorm(a: NormRef, b: NormRef): boolean {
  return (
    a.kind === b.kind &&
    a.number === b.number &&
    (!a.year || !b.year || a.year === b.year)
  );
}

const PARTIAL =
  /\bart(?:igo)?s?\.?\s*\d|\bincisos?\b|\bpar[aá]grafos?\b|§|\bal[ií]neas?\b|\bcaput\b/i;

/**
 * The norms a text revokes in full (decision of 15/11/2026: when one
 * revokes the other, the system knows): "Fica revogado o Provimento nº
 * 7/2020", "Revogam-se a Resolução nº 5/2018 e o Provimento nº 10/2019".
 * A clause that revokes only an article, an inciso or a paragraph is not
 * the norm revoked, nor is "revogam-se as disposições em contrário".
 */
export function revokedNorms(text: string): NormRef[] {
  const out: NormRef[] = [];
  for (const sentence of text.split(/(?<=[.;])\s+|\n+/)) {
    const at = sentence.search(/revog/i);
    if (at < 0) continue;
    const after = sentence.slice(at);
    for (const m of after.matchAll(NORM_MENTION)) {
      const before = after.slice(0, m.index ?? 0);
      if (PARTIAL.test(before) || PARTIAL.test(m[2] ?? "")) continue;
      for (const norm of normsIn(m[0])) {
        if (!out.some((o) => sameNorm(o, norm))) out.push(norm);
      }
    }
  }
  return out;
}

/**
 * An article that only says it was revoked or vetoed ("Art. 5º (Revogado
 * pela Lei nº 1/2020)."): kept in the text for history, never an answer.
 */
export function isRevokedPassage(text: string): boolean {
  const body = text
    .replace(/^##\s+.*$/m, "")
    .replace(/^\s*art(?:igo)?\.?\s*[\d.]+[º°o]?(?:-[a-z])?\s*[.:-]?/i, "")
    .trim();
  return /^\(?\s*(revogad[oa]s?|vetad[oa]s?)\b[^)]*\)?\.?$/i.test(body);
}
