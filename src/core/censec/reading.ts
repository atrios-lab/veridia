import { readGuideText } from "../guides/reading.ts";
import { formatTaxId, isValidTaxId } from "../tax-id.ts";
import {
  actDateIn,
  bookAndPageIn,
  centsFrom,
} from "../titularidade/titularidade.ts";
import {
  type CensecAct,
  type CensecParty,
  type CensecReference,
  type Central,
  emptyAct,
  emptyParty,
  emptyReference,
} from "./censec.ts";

/**
 * Reads the escrituras, procurações, atas and testamentos the office
 * attaches (decision of 14/11/2026: "ao fazer as leituras das escrituras",
 * "foque naquelas extrações dos docs que irá ser anexado") and fills the
 * act of the right central. Only what the text says plainly is taken;
 * what it does not say stays blank, and the screen shows it to complete.
 * The text is never kept: only the act read from it.
 */

const flat = (text: string) => text.replace(/\s+/g, " ").trim();

// ---------------------------------------------------------------- split

/**
 * The words that open an act, in capitals at the head of a page: a new
 * one starts there. A page that does not open one continues the act
 * before (the office may join all the quinzena's acts in a single PDF).
 */
const OPENING =
  /(?:^|\n)[\s\d.ºª-]*(ESCRITURA\s+P[ÚU]BLICA|ESCRITURA\s+DE|PROCURA[ÇC][ÃA]O|SUBSTABELECIMENTO|REVOGA[ÇC][ÃA]O|REN[ÚU]NCIA|ATA\s+NOTARIAL|TESTAMENTO|AUTO\s+DE\s+APROVA[ÇC][ÃA]O|TRASLADO|INVENT[ÁA]RIO|DIV[ÓO]RCIO|SEPARA[ÇC][ÃA]O\s+CONSENSUAL|SOBREPARTILHA)\b/;

/** The book and page an act states, to tell two acts apart. */
function bookPage(text: string): string {
  const { book, page } = bookAndPageIn(text.slice(0, 1500));
  return book && page ? `${book}/${page.split(/[/-]/)[0]}` : "";
}

export function splitActs(pages: string[]): string[] {
  const acts: string[] = [];
  let current = "";
  let currentWhere = "";
  for (const page of pages) {
    const head = page.slice(0, 600);
    const opens = OPENING.test(head);
    const where = bookPage(page);
    const differs = !currentWhere || !where || where !== currentWhere;
    if (current && opens && differs) {
      acts.push(current);
      current = "";
      currentWhere = "";
    }
    current = current ? `${current}\n${page}` : page;
    if (!currentWhere && where) currentWhere = where;
  }
  if (current.trim()) acts.push(current);
  return acts;
}

// ---------------------------------------------------------------- kind

/** The central and the kind, by the act's own title (the first lines). */
export function kindIn(text: string): { central: Central; kind: string } {
  const head = flat(text.slice(0, 1500));
  const all = flat(text);
  const test = (re: RegExp) => re.test(head) || false;
  // RCTO (CNN, art. 267): testamentos and their approval and revocation.
  if (
    test(
      /testamento\s+cerrado|auto\s+de\s+aprova[çc][ãa]o|instrumento\s+de\s+aprova[çc][ãa]o/i,
    )
  ) {
    return { central: "rcto", kind: "Cerrado" };
  }
  if (test(/revoga[çc][ãa]o\s+(?:total\s+|parcial\s+)?de\s+testamento/i)) {
    return { central: "rcto", kind: "Revogacao" };
  }
  if (test(/aditamento\s+(?:ao|de)\s+testamento/i)) {
    return { central: "rcto", kind: "Aditamento" };
  }
  if (test(/\btestamento\b/i) && !test(/testamento\s+vital/i)) {
    if (
      /revog[ao]\w*\s+(?:o|os|todo|todos|qualquer)\s+(?:testamento|disposi)/i.test(
        all,
      )
    ) {
      return { central: "rcto", kind: "TestamentoComRevogacao" };
    }
    return { central: "rcto", kind: "Testamento" };
  }
  // CESDI (art. 270): the escrituras of the Lei nº 11.441/2007.
  if (test(/sobrepartilha/i))
    return { central: "cesdi", kind: "Sobrepartilha" };
  if (test(/nomea[çc][ãa]o\s+de\s+inventariante/i)) {
    return { central: "cesdi", kind: "NomeacaoDeInventariante" };
  }
  if (test(/convers[ãa]o\s+de\s+separa[çc][ãa]o\s+em\s+div[óo]rcio/i)) {
    return { central: "cesdi", kind: "ConversaoDeSeparacaoEmDivorcio" };
  }
  if (
    test(/restabelecimento\s+da\s+sociedade\s+conjugal|reconcilia[çc][ãa]o/i)
  ) {
    return { central: "cesdi", kind: "Reconciliacao" };
  }
  const cesdi = test(
    /invent[áa]rio|partilha|div[óo]rcio|separa[çc][ãa]o\s+consensual/i,
  );
  if (cesdi && test(/retifica[çc][ãa]o|rerratifica/i)) {
    return { central: "cesdi", kind: "Retificacao" };
  }
  if (test(/invent[áa]rio/i)) {
    return {
      central: "cesdi",
      kind: /\b(?:menor(?:es)?\s+(?:de\s+idade|impúbere|púbere)|incapaz)\b/i.test(
        all,
      )
        ? "InventarioComMenorOuIncapaz"
        : "Inventario",
    };
  }
  if (test(/div[óo]rcio/i)) return { central: "cesdi", kind: "DivorcioDireto" };
  if (test(/separa[çc][ãa]o\s+consensual/i))
    return { central: "cesdi", kind: "Separacao" };
  if (
    test(/\bpartilha\b/i) &&
    /falec|de\s+cujus|esp[óo]lio|heran[çc]a/i.test(all)
  ) {
    return { central: "cesdi", kind: "Partilha" };
  }
  // CEP (art. 272): everything else of the notas.
  if (test(/substabelecimento/i))
    return { central: "cep", kind: "Substabelecimento" };
  if (test(/revoga[çc][ãa]o\s+(?:de\s+)?(?:procura[çc][ãa]o|mandato)/i)) {
    return { central: "cep", kind: "RevogacaoDeProcuracao" };
  }
  if (test(/ren[úu]ncia\s+(?:de\s+|ao\s+)?(?:procura[çc][ãa]o|mandato)/i)) {
    return { central: "cep", kind: "RenunciaDeProcuracao" };
  }
  if (test(/ata\s+notarial/i)) {
    return {
      central: "cep",
      kind: /usucapi[ãa]o/i.test(head)
        ? "AtaNotarialDeUsucapiao"
        : "AtaNotarial",
    };
  }
  if (
    test(/procura[çc][ãa]o/i) &&
    !test(/escritura\s+p[úu]blica\s+de\s+(?!procura)/i)
  ) {
    return {
      central: "cep",
      kind: /previd[êe]nci|\bINSS\b/i.test(all)
        ? "ProcuracaoParaFinsPrevidenciarios"
        : "Procuracao",
    };
  }
  return { central: "cep", kind: "Escritura" };
}

/** naturezaEscritura by the title's words: the specific before the general. */
const NATURES: [RegExp, string][] = [
  [
    /promessa\s+de\s+compra\s+e\s+venda|compromisso\s+de\s+compra/i,
    "PromessaDeCompraEVenda",
  ],
  [/promessa\s+de\s+cess[ãa]o/i, "PromessaDeCessaoDeDireitosAquisitivos"],
  [
    /compra\s+e\s+venda|venda\s+e\s+compra|\bpermuta\b|adjudica[çc][ãa]o/i,
    "CompraEVenda",
  ],
  [/cess[ãa]o\s+de\s+direitos\s+heredit/i, "CessaoDeDireitosHereditarios"],
  [
    /ren[úu]ncia\s+(?:de\s+|a\s+|aos\s+)?(?:direitos\s+heredit|heran[çc]a)/i,
    "RenunciaDeDireitosHereditarios",
  ],
  [/cess[ãa]o\s+de\s+posse/i, "CessaoDePosse"],
  [
    /cess[ãa]o\s+de\s+(?:direito\s+)?credit|cess[ãa]o\s+de\s+cr[ée]dito/i,
    "CessaoDeDireitoCreditorio",
  ],
  [/cess[ãa]o\s+de\s+precat/i, "CessaoDePrecatorios"],
  [/cess[ãa]o\s+de\s+contrato/i, "CessaoDeContratos"],
  [/\bcess[ãa]o\b/i, "Cessao"],
  [/\bdoa[çc][ãa]o\b/i, "Doacao"],
  [
    /dissolu[çc][ãa]o\s+(?:de\s+|da\s+)?uni[ãa]o\s+est[áa]vel/i,
    "DissolucaoDeUniaoEstavel",
  ],
  [
    /uni[ãa]o\s+est[áa]vel\s+homoafetiva/i,
    "DeclaratoriaDeUniaoEstavelHomoafetiva",
  ],
  [/uni[ãa]o\s+est[áa]vel/i, "DeclaratoriaDeUniaoEstavel"],
  [/pacto\s+antenupcial/i, "PactoAnteNupcial"],
  [/aliena[çc][ãa]o\s+fiduci/i, "AlienacaoFiduciaria"],
  [/\bhipoteca\b/i, "Hipoteca"],
  [/\busufruto\b/i, "Usufruto"],
  [/\bservid[ãa]o\b/i, "Servidao"],
  [
    /diretivas\s+antecipadas|testamento\s+vital/i,
    "DiretivasAntecipadasDeVontade",
  ],
  [/diretivas\s+de\s+curatela/i, "DeclaratoriaComDiretivasDeCuratela"],
  [/autocuratela/i, "Autocuratela"],
  [/emancipa[çc][ãa]o/i, "Emancipacao"],
  [
    /reconhecimento\s+de\s+paternidade|perfilha/i,
    "ReconhecimentoDePaternidade",
  ],
  [
    /rerratifica|retifica[çc][ãa]o\s+e\s+ratifica|aditamento/i,
    "Rerratificacao",
  ],
  [
    /confiss[ãa]o\s+de\s+d[íi]vida|da[çc][ãa]o\s+em\s+pagamento/i,
    "ConfissaoDeDividaOuDacaoEmPagamento",
  ],
  [/\bcomodato\b|\bm[úu]tuo\b/i, "ComodatoOuMutuo"],
  [/\bloca[çc][ãa]o\b/i, "Locacao"],
  [
    /\bdivis[ãa]o\b|desmembramento|estrema[çc][ãa]o|partilha\s+amig/i,
    "Divisao",
  ],
  [/\bdistrato\b/i, "Distrato"],
  [/\bquita[çc][ãa]o\b/i, "Quitacao"],
  [/contrato\s+de\s+namoro/i, "ContratoDeNamoro"],
  [
    /integraliza[çc][ãa]o|subscri[çc][ãa]o\s+de\s+capital|constitui[çc][ãa]o\s+de\s+sociedade/i,
    "SociedadeEFundacoes",
  ],
  [/bem\s+de\s+fam[íi]lia/i, "BemDeFamilia"],
  [/condom[íi]nio/i, "Condominio"],
  [/concilia[çc][ãa]o/i, "Conciliacao"],
  [/media[çc][ãa]o/i, "Mediacao"],
  [/\bfian[çc]a\b/i, "Fianca"],
  [/\bpenhor\b/i, "Penhor"],
  [/\bnova[çc][ãa]o\b/i, "Novacao"],
  [/\brevoga[çc][ãa]o\b/i, "Revogacao"],
  [/declara[çc][ãa]o|declarat[óo]ria/i, "Declaracao"],
];

export function natureIn(text: string, kind: string): string {
  const head = flat(text.slice(0, 1500));
  if (kind === "AtaNotarialDeUsucapiao") {
    const all = flat(text);
    if (/extraordin[áa]ri/i.test(all)) return "Extraordinaria";
    if (/especial\s+rural/i.test(all)) return "EspecialRural";
    if (/especial\s+urbana/i.test(all)) return "EspecialUrbana";
    if (/familiar/i.test(all)) return "EspecialFamiliar";
    if (/ordin[áa]ri/i.test(all)) return "Ordinaria";
    return "";
  }
  if (kind !== "Escritura") return "";
  return NATURES.find(([re]) => re.test(head))?.[1] ?? "";
}

// ---------------------------------------------------------------- pieces

/** "Livro 100-F, folhas 34/35" → 100, F, 34. */
export function placeIn(text: string) {
  const { book, page } = bookAndPageIn(text);
  const b = /^(\d+)\s*[-/]?\s*([A-Za-z]*)$/.exec(book.trim());
  const p = /^(\d+)\s*([A-Za-z]?)/.exec(page.trim());
  return {
    book: b?.[1] ?? "",
    bookSuffix: (b?.[2] ?? "").toUpperCase(),
    page: p?.[1] ?? "",
    pageSuffix: (p?.[2] ?? "").toUpperCase(),
  };
}

export function mneIn(text: string): string {
  const formatted = /\b(\d{6}\.\d{4}\.\d{2}\.\d{2}\.\d{8}-\d{2})\b/.exec(
    text,
  )?.[1];
  if (formatted) return formatted.replace(/\D/g, "");
  return /\bMNE\b[^\d]{0,30}(\d{24})\b/i.exec(flat(text))?.[1] ?? "";
}

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: string, m: string, y: string) =>
  `${y}-${pad(Number(m))}-${pad(Number(d))}`;

function dateAfter(re: RegExp, text: string): string {
  const m = re.exec(text);
  return m?.[1] && m[2] && m[3] ? isoOf(m[1], m[2], m[3]) : "";
}

const TAX_ID =
  /\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/g;

/** Where each valid CPF/CNPJ sits in the flat text. */
function taxIdPositions(text: string): Map<string, number> {
  const at = new Map<string, number>();
  for (const match of text.matchAll(TAX_ID)) {
    const digits = (match[1] ?? "").replace(/\D/g, "");
    if (isValidTaxId(digits) && !at.has(digits))
      at.set(digits, match.index ?? 0);
  }
  return at;
}

/** The qualification of a person: from the name to the next ";". */
function qualification(text: string, name: string, taxAt: number): string {
  const nameAt = text.lastIndexOf(name, taxAt);
  const start = nameAt >= 0 ? nameAt : Math.max(0, taxAt - 400);
  const end = text.indexOf(";", taxAt);
  return text.slice(start, end > 0 ? Math.min(end, taxAt + 500) : taxAt + 500);
}

function identityIn(chunk: string): { identity: string; issuer: string } {
  const m =
    /(?:RG|R\.G\.|identidade|C[ée]dula\s+de\s+identidade|CIN)\s*(?:civil\s*)?(?:n[º°o]\.?|sob\s+o\s+n[º°o]\.?)?\s*:?\s*([\dXx][\d.\-Xx]{3,18})\s*[-\u2013,/]?\s*(?:expedid[ao]\s+pel[ao]\s+)?((?:SSP|SESP|SDS|ITEP|IIRGD|IFP|DETRAN|PC|SSPDS|SEJUSP|DGPC|SESDEC|IGP)[\s/-]*[A-Z]{0,2})?/i.exec(
      chunk,
    );
  return {
    identity: m?.[1]?.replace(/[.\s]+$/, "") ?? "",
    issuer: m?.[2]?.replace(/\s+/g, "").toUpperCase() ?? "",
  };
}

const UF_NAMES: Record<string, string> = {
  acre: "AC",
  alagoas: "AL",
  amapá: "AP",
  amazonas: "AM",
  bahia: "BA",
  ceará: "CE",
  "distrito federal": "DF",
  "espírito santo": "ES",
  goiás: "GO",
  maranhão: "MA",
  "mato grosso do sul": "MS",
  "mato grosso": "MT",
  "minas gerais": "MG",
  pará: "PA",
  paraíba: "PB",
  paraná: "PR",
  pernambuco: "PE",
  piauí: "PI",
  "rio de janeiro": "RJ",
  "rio grande do norte": "RN",
  "rio grande do sul": "RS",
  rondônia: "RO",
  roraima: "RR",
  "santa catarina": "SC",
  "são paulo": "SP",
  sergipe: "SE",
  tocantins: "TO",
};

function ufIn(text: string): string {
  const sigla = /[/-]\s*([A-Z]{2})\b/.exec(text)?.[1];
  if (sigla) return sigla;
  const lower = text.toLowerCase();
  return (
    Object.entries(UF_NAMES).find(([name]) => lower.includes(name))?.[1] ?? ""
  );
}

// ---------------------------------------------------------------- parties

const TRANSMITS =
  /(vendedor|vendedora|outorgantes?|transmitente|doador|doadora|cedente|promitente\s+vendedor|permutante)/gi;
const ACQUIRES =
  /(comprador|compradora|outorgad[oa]s?|adquirente|donat[áa]ri[oa]|cession[áa]ri[oa]|procurador[a]?)/gi;

function lastAt(re: RegExp, text: string): number {
  let last = -1;
  for (const m of text.matchAll(re)) last = m.index ?? last;
  return last;
}

/** The role named nearest before the person's name. */
function roleBefore(text: string): "transmitente" | "adquirente" | undefined {
  const t = lastAt(TRANSMITS, text);
  const a = lastAt(ACQUIRES, text);
  if (t < 0 && a < 0) return undefined;
  return t > a ? "transmitente" : "adquirente";
}

/** The CEP's quality by the words near the person. */
function cepQuality(
  role: "transmitente" | "adquirente" | undefined,
  chunk: string,
  kind: string,
): string {
  if (/usufrutu[áa]ri/i.test(chunk)) return "Usufrutuario";
  if (/\binterveniente|anuente|assistid|a\s+rogo|credor/i.test(chunk))
    return "Interveniente";
  if (/\brequerente\b/i.test(chunk)) return "Requerente";
  if (/\brequerid[oa]\b/i.test(chunk)) return "Requerido";
  if (role === "transmitente") return "Outorgante";
  if (role === "adquirente") return "Outorgado";
  // A procuração's first party is who grants it.
  return kind.includes("Procuracao") || kind === "Substabelecimento" ? "" : "";
}

/** The CESDI's quality by the words of the qualification or the heading. */
const CESDI_WORDS: [RegExp, string][] = [
  [/\badvogad[oa]|\bOAB\b/i, "Advogado"],
  [/inventariante/i, "Inventariante"],
  [
    /falecid[oa]|de\s+cujus|autor[a]?\s+da\s+heran[çc]a|esp[óo]lio/i,
    "Falecido",
  ],
  [
    /vi[úu]v[oa]|meeir[oa]|c[ôo]njuge\s+(?:sobrevivente|sup[ée]rstite)/i,
    "Viuvo",
  ],
  [/companheir[oa]\s+sobrevivente/i, "Companheiro"],
  [/herdeir[oa]/i, "Herdeiro"],
  [/divorciand[oa]/i, "Divorciando"],
  [/separand[oa]/i, "Separando"],
  [/reconcilian/i, "Reconciliando"],
  [/cession[áa]ri[oa]|adjudicat[áa]ri/i, "CessionarioAdjudicatarios"],
  [/\bcedente\b/i, "Cedente"],
  [/\banuente\b/i, "Anuente"],
  [/\binterveniente\b/i, "Interveniente"],
];

function cesdiQuality(chunk: string, before: string, kind: string): string {
  const own = CESDI_WORDS.find(([re]) => re.test(chunk))?.[1];
  if (own) return own;
  let best = "";
  let at = -1;
  for (const [re, quality] of CESDI_WORDS) {
    const global = new RegExp(re.source, "gi");
    for (const m of before.matchAll(global)) {
      if ((m.index ?? -1) > at) {
        at = m.index ?? -1;
        best = quality;
      }
    }
  }
  if (best) return best;
  if (kind === "DivorcioDireto" || kind === "ConversaoDeSeparacaoEmDivorcio")
    return "Divorciando";
  if (kind === "Separacao") return "Separando";
  return "";
}

function partyFrom(name: string, taxId: string): CensecParty {
  const digits = taxId.replace(/\D/g, "");
  return {
    ...emptyParty(),
    name,
    docType: digits.length === 14 ? "Cnpj" : digits.length === 11 ? "Cpf" : "",
    docNumber: digits ? formatTaxId(digits) : "",
  };
}

function partiesIn(text: string, act: CensecAct): CensecParty[] {
  const all = flat(text);
  const reading = readGuideText(text);
  const positions = taxIdPositions(all);
  const parties: CensecParty[] = [];
  for (const p of reading.parties) {
    const digits = p.taxId.replace(/\D/g, "");
    const at = positions.get(digits) ?? -1;
    const chunk = at >= 0 ? qualification(all, p.name, at) : "";
    const before =
      at >= 0
        ? all.slice(
            Math.max(0, at - 1200),
            Math.max(0, all.lastIndexOf(p.name, at)),
          )
        : "";
    const party = { ...partyFrom(p.name, p.taxId), ...identityIn(chunk) };
    party.foreign = /\bestrangeir|nacionalidade\s+(?!brasileir)/i.test(chunk);
    if (act.central === "cep") {
      const nameAt = at >= 0 ? all.lastIndexOf(p.name, at) : -1;
      const role =
        nameAt >= 0
          ? (roleBefore(all.slice(Math.max(0, nameAt - 1500), nameAt)) ??
            p.role)
          : p.role;
      party.quality = cepQuality(role, chunk, act.kind);
    } else {
      party.quality = cesdiQuality(chunk, before, act.kind);
      party.birthDate = dateAfter(
        /nascid[oa]\s+(?:em|aos?)\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i,
        chunk,
      );
      party.sex =
        p.gender === "feminino" ? "F" : p.gender === "masculino" ? "M" : "";
      if (/brasileir/i.test(chunk)) {
        party.birthCountry = "BRASIL";
        party.residenceCountry = "BRASIL";
      }
      const natural = /natural\s+de\s+([^,;]{3,60})/i.exec(chunk)?.[1] ?? "";
      party.birthUf = ufIn(natural);
      const lives =
        /(?:residente|domiciliad)[^;]{0,200}?(?:em|na\s+cidade\s+de|no\s+munic[íi]pio\s+de)\s+([^;]{3,80})/i.exec(
          chunk,
        )?.[1] ?? "";
      party.residenceUf = ufIn(lives);
    }
    parties.push(party);
  }
  if (act.central === "cesdi") {
    // The advogado: "..., advogado, OAB/RN nº 1234".
    for (const m of all.matchAll(
      /([A-ZÀ-Ú][A-ZÀ-Úa-zà-ú'´ ]{5,80}?),\s*(?:[^,;]{0,60},\s*){0,3}advogad[oa][^;]{0,160}?OAB\s*[/-]?\s*([A-Z]{2})[^\d]{0,25}([\d.]{2,10})/g,
    )) {
      const name = (m[1] ?? "").trim();
      const existing = parties.find((p) => p.name === name);
      const target = existing ?? { ...emptyParty(), name };
      target.quality = "Advogado";
      target.oab = (m[3] ?? "").replace(/\D/g, "");
      target.oabUf = m[2] ?? "";
      if (!existing) parties.push(target);
    }
    // The deceased, often named without a CPF of their own.
    const deceased =
      /(?:falecimento\s+de|esp[óo]lio\s+de|de\s+cujus|autor[a]?\s+da\s+heran[çc]a)[,:]?\s+([A-ZÀ-Ú][A-ZÀ-Ú'´ ]{5,80}?)(?=[,;.(]|\s+(?:falecid|ocorrid|em\s+\d))/
        .exec(all)?.[1]
        ?.trim();
    if (deceased && !parties.some((p) => p.quality === "Falecido")) {
      const known = parties.find((p) => p.name === deceased);
      if (known) known.quality = "Falecido";
      else
        parties.unshift({
          ...emptyParty(),
          name: deceased,
          quality: "Falecido",
          docType: "Desconhecido",
        });
    }
    // The couple: cônjuge 1 and 2 in the order they appear.
    const spouses = parties.filter(
      (p) =>
        p.quality === "Divorciando" ||
        p.quality === "Separando" ||
        p.quality === "Reconciliando",
    );
    spouses.slice(0, 2).forEach((p, i) => {
      p.spouse = i === 0 ? "Conjuge1" : "Conjuge2";
    });
  }
  return parties;
}

// ---------------------------------------------------------------- couple

const NUMBER_WORDS: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  três: 3,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
};

function childrenIn(text: string, adult: boolean): string {
  const word = adult ? "maior(?:es)?" : "menor(?:es)?";
  const none = new RegExp(
    `n[ãa]o\\s+(?:tiveram|possuem|t[êe]m|h[áa]|houve|existem)\\s+filh[oa]s?(?:\\s+${word})?\\b`,
    "i",
  );
  const m = new RegExp(
    `(\\d{1,2}|${Object.keys(NUMBER_WORDS).join("|")})\\s*(?:\\([^)]{1,12}\\)\\s*)?filh[oa]s?\\s+${word}\\b`,
    "i",
  ).exec(text);
  if (m?.[1]) return String(NUMBER_WORDS[m[1].toLowerCase()] ?? Number(m[1]));
  const noneMatch = none.exec(text);
  if (
    noneMatch &&
    (noneMatch[0].match(new RegExp(word, "i")) ||
      /filhos\s*$/i.test(noneMatch[0]))
  ) {
    return "0";
  }
  return "";
}

const REGIME_WORDS: [RegExp, string][] = [
  [/comunh[ãa]o\s+parcial/i, "ComunhaoParcial"],
  [/comunh[ãa]o\s+universal/i, "ComunhaoUniversal"],
  [/participa[çc][ãa]o\s+final/i, "ParticipacaoFinalNosAquestos"],
  [/separa[çc][ãa]o\s+(?:obrigat[óo]ria|legal)/i, "SeparacaoObrigatoria"],
  [
    /separa[çc][ãa]o\s+(?:total|convencional|absoluta)\s+de\s+bens/i,
    "SeparacaoTotal",
  ],
];

function regimeIn(text: string): string {
  const m = /regime\s+d[ae]\s+([^,;.]{5,60})/i.exec(text);
  const where = m?.[1] ?? "";
  return REGIME_WORDS.find(([re]) => re.test(where))?.[1] ?? "";
}

// ---------------------------------------------------------------- RCTO

function testatorIn(text: string, act: CensecAct): void {
  const all = flat(text);
  const reading = readGuideText(text);
  const positions = taxIdPositions(all);
  const named = /testador[a]?\s*[:,]?\s*([A-ZÀ-Ú][A-ZÀ-Ú'´ ]{5,80}?)\s*,/
    .exec(all)?.[1]
    ?.trim();
  const person =
    reading.parties.find((p) => named && p.name === named) ??
    reading.parties[0];
  if (!person && !named) return;
  const name = person?.name ?? named ?? "";
  const digits = (person?.taxId ?? "").replace(/\D/g, "");
  const at = positions.get(digits) ?? all.indexOf(name);
  const chunk = at >= 0 ? qualification(all, name, at) : all.slice(0, 1500);
  const { identity, issuer } = identityIn(chunk);
  const filiation =
    /filh[oa]\s+de\s+([^,;]{5,90}?)\s+e\s+(?:de\s+)?([^,;]{5,90}?)\s*[,;]/i.exec(
      chunk,
    );
  const onlyMother = /filh[oa]\s+de\s+([^,;]{5,90}?)\s*[,;]/i.exec(chunk);
  act.testator = {
    name,
    cpf: digits.length === 11 ? formatTaxId(digits) : "",
    birthDate: dateAfter(
      /nascid[oa]\s+(?:em|aos?)\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i,
      chunk,
    ),
    // "filho de [pai] e de [mãe]", the usual order of a qualification.
    father: filiation?.[1]?.trim() ?? "",
    mother: filiation?.[2]?.trim() ?? onlyMother?.[1]?.trim() ?? "",
    docType: identity ? "Rg" : "",
    doc: identity,
    docComplement: issuer.slice(0, 20),
  };
  if (act.kind === "Revogacao" || act.kind === "TestamentoComRevogacao") {
    const revoked =
      /revog[^.]{0,300}?(?:lavrad[oa]\s+em\s+(\d{1,2})\/(\d{1,2})\/(\d{4}))?[^.]{0,200}?livro\s*(?:n[º°o]\.?\s*)?(\d+)\s*([A-Z]?)\D{0,30}?folhas?\s*(?:n[º°o]\.?\s*)?(\d+)/i.exec(
        all,
      );
    if (revoked) {
      act.revocation = {
        ...act.revocation,
        date:
          revoked[1] && revoked[2] && revoked[3]
            ? isoOf(revoked[1], revoked[2], revoked[3])
            : "",
        book: revoked[4] ?? "",
        bookSuffix: revoked[5] ?? "",
        page: revoked[6] ?? "",
      };
    }
  }
}

// ---------------------------------------------------------------- origin

/** The act a revogação, substabelecimento or rerratificação refers to. */
function referenceIn(text: string, act: CensecAct): CensecReference | null {
  const all = flat(text);
  // The second "livro ... folha" of the text: the first is the act's own.
  const places = [
    ...all.matchAll(
      /livro\s*(?:n[º°o]\.?\s*)?(\d+)\s*-?\s*([A-Z]?)\b\D{0,40}?folhas?\s*(?:n[º°o]\.?\s*)?(\d+)/gi,
    ),
  ];
  const own = `${act.book}/${act.page}`;
  const other = places.find((m) => `${m[1]}/${m[3]}` !== own);
  if (!other) return null;
  const around = all.slice(
    Math.max(0, (other.index ?? 0) - 300),
    (other.index ?? 0) + 300,
  );
  const cns =
    /\bCNS\b\s*(?:n[º°o]\.?)?\s*:?\s*([\d.-]{6,9})/i.exec(around)?.[1] ?? "";
  return {
    ...emptyReference(),
    kind:
      act.central === "cesdi"
        ? ""
        : act.kind === "Escritura"
          ? "Escritura"
          : /procura[çc][ãa]o\s+privada|instrumento\s+particular/i.test(around)
            ? "ProcuracaoPrivada"
            : "Procuracao",
    cns,
    book: other[1] ?? "",
    bookSuffix: (other[2] ?? "").toUpperCase(),
    page: other[3] ?? "",
  };
}

// ---------------------------------------------------------------- the act

export interface ActReading {
  act: CensecAct;
  /** What was found, in plain words. */
  found: string[];
}

export function readActText(text: string): ActReading {
  const { central, kind } = kindIn(text);
  const act: CensecAct = { ...emptyAct(central), kind };
  const all = flat(text);
  act.nature = central === "cep" ? natureIn(text, kind) : "";
  act.date = actDateIn(text);
  Object.assign(act, placeIn(text));
  act.mne = mneIn(text);
  if (central === "rcto") {
    testatorIn(text, act);
  } else {
    act.parties = partiesIn(text, act);
  }
  if (central === "cep") {
    if (kind === "Escritura") {
      const value = readGuideText(text).declaredValueCents;
      act.valueCents = value ?? (act.nature === "SemValorDeclarado" ? 0 : null);
    }
    if (
      act.nature === "DeclaratoriaDeUniaoEstavel" ||
      act.nature === "DissolucaoDeUniaoEstavel"
    ) {
      act.regime = regimeIn(all);
    }
    act.validity = dateAfter(
      /(?:v[áa]lid[ao]|validade|vig[êe]ncia)[^.;]{0,40}?at[ée]\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i,
      all,
    );
    if (kind === "Substabelecimento") {
      act.reserve = /sem\s+reserva/i.test(all)
        ? "nao"
        : /com\s+reserva/i.test(all)
          ? "sim"
          : "";
    }
    if (
      kind === "RevogacaoDeProcuracao" ||
      kind === "RenunciaDeProcuracao" ||
      kind === "Substabelecimento" ||
      act.nature === "Rerratificacao"
    ) {
      const reference = referenceIn(text, act);
      if (reference) act.references = [reference];
    }
    const property = /matr[íi]cula\s*(?:n[º°o]\.?)?\s*:?\s*(\d[\d.]*)/i.exec(
      all,
    )?.[1];
    if (kind === "Escritura" && (property || act.valueCents !== null)) {
      const reading = readGuideText(text);
      act.assets = [
        {
          description: (reading.property.description ?? "").slice(0, 1000),
          valueCents: act.valueCents,
          fiscalCents: (() => {
            const m =
              /(?:valor\s+venal|avalia[çc][ãa]o\s+fiscal|base\s+de\s+c[áa]lculo)[^R]{0,80}R\$\s*([\d.]+,\d{2})/i.exec(
                all,
              );
            return m?.[1] ? (centsFrom(m[1]) ?? null) : null;
          })(),
          paymentForm: /em\s+esp[ée]cie|em\s+dinheiro/i.test(all)
            ? "Dinheiro"
            : /\bpix\b|transfer[êe]ncia|\bTED\b|dep[óo]sito/i.test(all)
              ? "Transferencia"
              : /\bcheque\b/i.test(all)
                ? "Cheque"
                : /nota\s+promiss/i.test(all)
                  ? "NotaPromissoria"
                  : act.nature === "CompraEVenda" && /\bpermuta\b/i.test(all)
                    ? "Permuta"
                    : "",
          paymentTerm: /(?:^|[\s,(])[àa]\s+vista\b/i.test(all)
            ? "AVista"
            : /\bparcelas?\b|a\s+prazo/i.test(all)
              ? "APrazo"
              : "",
          matricula: (property ?? "").replace(/\D/g, "").slice(0, 15),
          cnm: "",
        },
      ];
    }
  }
  if (central === "cesdi") {
    act.marriageDate = dateAfter(
      /(?:casad[oa]s?\s+(?:entre\s+si\s+)?(?:desde|em)|contra[íi]ram\s+(?:matrim[ôo]nio|casamento)\s+(?:civil\s+)?em|casamento\s+(?:foi\s+)?(?:celebrado|realizado)\s+em)\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i,
      all,
    );
    act.regime = regimeIn(all);
    act.adultChildren = childrenIn(all, true);
    act.minorChildren = childrenIn(all, false);
    if (act.minorChildren === "0") act.custody = "SemDeclaracao";
    else if (/guarda\s+compartilhada/i.test(all)) act.custody = "AmbosConjuges";
    if (act.kind === "Retificacao") {
      const reference = referenceIn(text, act);
      if (reference) act.references = [{ ...reference, kind: "Inventario" }];
    }
  }
  const found = [
    act.kind && "tipo do ato",
    act.nature && "natureza",
    act.date && "data",
    act.book && "livro e folha",
    act.mne && "MNE",
    act.valueCents !== null && "valor",
    act.parties.length > 0 && `${act.parties.length} parte(s)`,
    act.testator.name && "testador",
    act.marriageDate && "data do casamento",
    act.regime && "regime de bens",
  ].filter((x): x is string => Boolean(x));
  return { act, found };
}
