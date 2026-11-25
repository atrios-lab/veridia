import type { Act, ActParty } from "./acts.ts";
import { type CnmBook, cnmOf, cnmProblems, formatCnm } from "./cnm.ts";
import { ACTIVE, STREET_KINDS, UF_IBGE } from "./codes.ts";
import type { PropertyInput } from "./property.ts";

/**
 * The files the office imports in the ONR with its own certificate:
 *
 * - the lote of CNM for the PGV-CNM (CNN, arts. 330 to 334), in the XML of
 *   the "envioLoteModelo.xsd" the PGV offers for download;
 * - the Indicador Real (Livro 4) for the Ofício Eletrônico, in the JSON of
 *   the ONR's "Especificações Técnicas" v1.5 (Provimento CNJ nº 143/2023,
 *   art. 15, by CNN art. 342), following the official example where the
 *   field table and the example disagree;
 * - the Indicador Pessoal (Livro 5) in the XML of the Banco Light (WS
 *   Ofício v4.43, Anexo 1), ISO-8859-1, dates as ddMMaaaa.
 *
 * Nothing here sends anything: the office downloads, checks and imports.
 */

export interface ExportProperty extends PropertyInput {
  id: string;
}

export interface Skipped {
  label: string;
  reason: string;
}

const xmlEscape = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// ------------------------------------------------------------------ CNM

export interface CnmBatch {
  xml: string;
  count: number;
  skipped: Skipped[];
  /** Situations other than 0 in the lote: the ONR advises a small test first. */
  usesClosedSituations: boolean;
}

/**
 * The lote of the PGV-CNM. Out of it: what is already in the PGV, the
 * transcrições (no CNM), the Livro 3 (the TIPO for it still has to be
 * confirmed with the ONR), numbers repeated (art. 338, decide first) and a
 * CNM written on the matrícula that does not check.
 */
export function cnmBatch(
  cns: string,
  properties: readonly ExportProperty[],
): CnmBatch {
  const skipped: Skipped[] = [];
  const count = new Map<number, number>();
  for (const p of properties) {
    if (p.recordKind !== 4 && p.book === 2) {
      count.set(p.number, (count.get(p.number) ?? 0) + 1);
    }
  }
  const rows: string[] = [];
  let usesClosedSituations = false;
  const sorted = [...properties].sort((a, b) => a.number - b.number);
  for (const p of sorted) {
    const label = `Matrícula ${p.number.toLocaleString("pt-BR")}`;
    if (p.recordKind === 4) continue;
    if (p.cnmInPgv) continue;
    if (p.book !== 2) {
      skipped.push({
        label: `Registro Auxiliar ${p.number}`,
        reason:
          "Livro 3 fica fora até o ONR confirmar o TIPO do registro auxiliar no lote.",
      });
      continue;
    }
    if ((count.get(p.number) ?? 0) > 1) {
      skipped.push({
        label,
        reason:
          "Número repetido (CNN, art. 338): resolva qual fica antes de gerar o CNM.",
      });
      continue;
    }
    const book = p.book as CnmBook;
    const expected = cnmOf(cns, book, p.number);
    if (p.cnm && cnmProblems(p.cnm, { cns, book, number: p.number }).length) {
      skipped.push({
        label,
        reason: `O CNM lançado (${formatCnm(p.cnm)}) não confere; o calculado é ${expected}.`,
      });
      continue;
    }
    if (p.status !== ACTIVE) usesClosedSituations = true;
    rows.push(
      `  <REGISTRO><SEQ>${rows.length + 1}</SEQ><TIPO>I</TIPO><LIVRO>${book}</LIVRO><NUM>${p.number}</NUM><CNM>${expected}</CNM><SITUACAO>${p.status}</SITUACAO></REGISTRO>`,
    );
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<LOTE>\n${rows.join("\n")}${rows.length ? "\n" : ""}</LOTE>\n`;
  return { xml, count: rows.length, skipped, usesClosedSituations };
}

// --------------------------------------------------------- Indicador Real

export type RealMode = "completa" | "atualizacao";

export interface RealExport {
  json: string;
  count: number;
  skipped: Skipped[];
}

/**
 * The Indicador Real. "completa": the whole base (TIPOENVIO 0, and 2 for
 * the encerradas/canceladas); "atualizacao": only what changed (1, or 2).
 * The numbers that never had an imóvel (situação 4) are not imóveis and
 * stay out.
 */
export function indicadorReal(
  office: { cns: string; state: string; ibgeCity: string },
  properties: readonly ExportProperty[],
  mode: RealMode,
): RealExport {
  const uf = UF_IBGE[office.state.toUpperCase()];
  const city = Number(office.ibgeCity.replace(/\D/g, ""));
  if (!uf) throw new Error("A UF da serventia não está na tabela do IBGE.");
  if (!city || String(city).length !== 7) {
    throw new Error(
      "Informe o código IBGE do município (7 dígitos) em Configurações do Registro de Imóveis.",
    );
  }
  const skipped: Skipped[] = [];
  const real: Record<string, unknown>[] = [];
  const sorted = [...properties].sort(
    (a, b) => a.recordKind - b.recordKind || a.number - b.number,
  );
  for (const p of sorted) {
    // A number that never had an imóvel, and the Livro 3: the ONR's
    // "registro tipo" knows only matrícula, matrícula-mãe and transcrição.
    if (p.status === 4 || p.book === 3) continue;
    const label = `${p.recordKind === 4 ? "Transcrição" : "Matrícula"} ${p.number.toLocaleString("pt-BR")}`;
    if (!p.streetKind || !STREET_KINDS.has(p.streetKind)) {
      skipped.push({ label, reason: "falta o tipo de logradouro" });
      continue;
    }
    if (!p.street) {
      skipped.push({ label, reason: "falta o nome do logradouro" });
      continue;
    }
    const closed = p.status !== ACTIVE;
    const row: Record<string, unknown> = {
      TIPOENVIO: closed ? 2 : mode === "completa" ? 0 : 1,
      NUMERO_REGISTRO: String(p.number),
      REGISTRO_TIPO: p.recordKind,
    };
    if (p.propertyKind) row.TIPO_DE_IMOVEL = p.propertyKind;
    Object.assign(row, {
      LOCALIZACAO: p.location,
      TIPO_LOGRADOURO: p.streetKind,
      NOME_LOGRADOURO: p.street,
      NUMERO_LOGRADOURO: p.streetNumber,
      UF: uf,
      CIDADE: city,
      BAIRRO: p.district,
      CEP: p.cep,
      COMPLEMENTO: p.complement,
      QUADRA: p.quadra,
      CONJUNTO: p.conjunto,
      SETOR: p.setor,
      LOTE: p.lote,
      LOTEAMENTO: p.loteamento,
      CONTRIBUINTE: p.contributors,
      RURAL: {
        CAR: p.rural.car,
        NIRF: p.rural.nirf,
        CCIR: p.rural.ccir,
        NUMERO_INCRA: p.rural.incra,
        SIGEF: p.rural.sigef,
        DENOMINACAORURAL: p.rural.denominacao,
        ACIDENTEGEOGRAFICO: p.rural.acidente,
      },
      CONDOMINIO: {
        NOME_CONDOMINIO: p.condo.nome,
        BLOCO: p.condo.bloco,
        CONJUNTO: p.condo.conjunto,
        TORRE: p.condo.torre,
        APTO: p.condo.apto,
        VAGA: p.condo.vaga,
      },
    });
    real.push(row);
  }
  const json = JSON.stringify(
    { INDICADOR_REAL: { CNS: office.cns, REAL: real } },
    null,
    1,
  );
  return { json, count: real.length, skipped };
}

// ------------------------------------------------------- Indicador Pessoal

export interface PersonalExport {
  xml: string;
  count: number;
  skipped: Skipped[];
}

/** aaaa-mm-dd → ddMMaaaa, as the Banco Light wants. */
export function bdlDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}${m}${y}`;
}

const cdata = (text: string) =>
  `<![CDATA[${text.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;

/** What the person did in the ato, as TIPODEATO ("COMPRA", "VENDA"…). */
export function actTypeFor(act: Pick<Act, "nature">, party: ActParty): string {
  const nature = act.nature.trim().toUpperCase();
  if (/COMPRA/.test(nature)) {
    if (party.role === "adquirente") return "COMPRA";
    if (party.role === "transmitente") return "VENDA";
  }
  return nature || "ATO";
}

/**
 * Every person who appears in an ato of a matrícula (Lei nº 6.015/1973,
 * art. 180: individual ou coletivamente, ativa ou passivamente), one
 * INDIVIDUO per person, matrícula and ato. DTVENDA: the date the same
 * person later transmitted that imóvel, when there was one.
 */
export function indicadorPessoal(
  properties: readonly {
    number: number;
    status: number;
    openedOn: string | null;
    acts: Act[];
    book?: number;
  }[],
): PersonalExport {
  const skipped: Skipped[] = [];
  const rows: string[] = [];
  const sorted = [...properties].sort((a, b) => a.number - b.number);
  for (const p of sorted) {
    // NMATRICULA is a matrícula's number: the Livro 3 stays in the
    // office's own Indicador Pessoal, not in the ONR's file.
    if (p.status === 4 || p.book === 3) continue;
    const acts = [...p.acts].sort((a, b) => a.seq - b.seq);
    for (const act of acts) {
      for (const party of act.parties) {
        const document = party.document.replace(/\D/g, "");
        if (!document) {
          skipped.push({
            label: `${party.name} (matrícula ${p.number.toLocaleString("pt-BR")})`,
            reason: "sem CPF ou CNPJ: o SAEC busca pelo documento",
          });
          continue;
        }
        let sold = "";
        if (party.role === "adquirente" || party.role === "titular") {
          const later = acts.find(
            (other) =>
              other.seq > act.seq &&
              other.effect === "transmissao" &&
              other.parties.some(
                (q) =>
                  q.personId === party.personId && q.role === "transmitente",
              ),
          );
          sold = bdlDate(later?.registeredOn ?? null);
        }
        rows.push(
          [
            "<INDIVIDUO>",
            `<NOME>${cdata(party.name)}</NOME>`,
            `<CNPJCPF>${document}</CNPJCPF>`,
            `<NMATRICULA>${p.number}</NMATRICULA>`,
            `<TIPODEATO>${xmlEscape(actTypeFor(act, party))}</TIPODEATO>`,
            `<DTREGAVERB>${bdlDate(act.registeredOn ?? (act.kind === "M" ? p.openedOn : null))}</DTREGAVERB>`,
            `<DTVENDA>${sold}</DTVENDA>`,
            "</INDIVIDUO>",
          ].join(""),
        );
      }
    }
  }
  const xml = `<?xml version="1.0" encoding="iso-8859-1"?>\n<BANCOLIGHT xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://registradores.onr.org.br/xsd/BDLIGHT_OPCAO1.xsd">\n${rows.join("\n")}${rows.length ? "\n" : ""}</BANCOLIGHT>\n`;
  return { xml, count: rows.length, skipped };
}

/**
 * The bytes of a text in ISO-8859-1; a character outside it (an emoji, a
 * curly quote) becomes "?", which the Banco Light reads.
 */
export function latin1(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  let i = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 63;
    bytes[i++] = code <= 0xff ? code : 63;
  }
  return bytes.slice(0, i);
}
