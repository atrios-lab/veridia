/**
 * The images of the Livro 2 for the ONR (change
 * registro-de-imoveis-imagens-onr), by the manual "Matrícula Online:
 * forma de disponibilização das imagens das matrículas" (v2.0):
 *
 * - item 1: TIFF black and white, 200 × 200 dpi, without loss (CCITT
 *   Group 4 among the algorithms it lists), Multi-TIFF "*.tif";
 * - item 2: folders of 8 digits, one per thousand (00000000 holds 1 to
 *   999, 00000001 holds 1000 to 1999) and the file with 8 digits and
 *   ".TIF": 00000000\00000001.TIF (the same as its "Padrão 12").
 *
 * The CSL2 copies what is in the folder of the matrículas to the ONR at
 * the hour set (manual do CSL2, v2.0.1). A photocopy is not an image of
 * the matrícula for this service.
 */

export const ONR_DPI = 200;

export interface OnrPattern {
  id: string;
  label: string;
  /** "00000000/00000001.TIF" for the matrícula 1. */
  path: (n: number) => string;
}

const pad = (n: number, size: number) => String(n).padStart(size, "0");

export const ONR_PATTERNS: OnrPattern[] = [
  {
    id: "p12",
    label:
      "Padrão principal do manual (Padrão 12): pasta de 8 dígitos por milhar e arquivo de 8 dígitos .TIF, várias folhas num arquivo",
    path: (n) => `${pad(Math.floor(n / 1000), 8)}/${pad(n, 8)}.TIF`,
  },
  {
    id: "p3",
    label:
      "Padrão 3: pasta com o primeiro número do milhar (8 dígitos) e arquivo de 8 dígitos .TIF",
    path: (n) => `${pad(Math.floor(n / 1000) * 1000, 8)}/${pad(n, 8)}.TIF`,
  },
  {
    id: "p13",
    label:
      "Padrão 13: pasta de 5 dígitos por milhar e arquivo de 8 dígitos .TIF",
    path: (n) => `${pad(Math.floor(n / 1000), 5)}/${pad(n, 8)}.TIF`,
  },
];

export const DEFAULT_PATTERN = "p12";

export function patternOf(id: string | null | undefined): OnrPattern {
  return (
    ONR_PATTERNS.find((p) => p.id === id) ?? (ONR_PATTERNS[0] as OnrPattern)
  );
}

/** Where the image of the matrícula goes, inside the folder of the CSL2. */
export function onrPath(n: number, pattern = DEFAULT_PATTERN): string {
  return patternOf(pattern).path(n);
}

/** A line of text on the last page, in points from the top. */
export interface TextLine {
  top: number;
  bottom: number;
  text: string;
}

/**
 * Where the signature goes on the last page: right under the last line of
 * the body, before the footer. The footer is what sits in the last 8% of
 * the page. Null when there is no room: the office leaves blank lines at
 * the end of the Word and saves the PDF again.
 */
export function signaturePlace(
  lines: readonly TextLine[],
  pageHeight: number,
  height: number,
): { top: number } | null {
  const footerFrom = pageHeight * 0.92;
  const body = lines.filter((l) => l.text.trim() && l.bottom < footerFrom);
  const last = body.reduce((max, l) => Math.max(max, l.bottom), 0);
  const footer = lines
    .filter((l) => l.text.trim() && l.top >= footerFrom)
    .reduce((min, l) => Math.min(min, l.top), pageHeight * 0.95);
  const top = last + 8;
  return top + height <= footer ? { top } : null;
}

/**
 * The number of the matrícula the document says it is: "MATRÍCULA Nº
 * 1.234", "Matrícula n. 1234", "MAT. 1234". The first one wins.
 */
export function numberInText(text: string): number | null {
  const m =
    /matr[íi]cula\s*(?:n[º°o.]*|n[úu]mero)?\s*[:\-\u2013]?\s*(\d{1,3}(?:[.\s]\d{3})+|\d{1,7})\b/i.exec(
      text,
    ) ?? /\bmat\.\s*(\d{1,3}(?:\.\d{3})+|\d{1,7})\b/i.exec(text);
  if (!m?.[1]) return null;
  const n = Number(m[1].replace(/\D/g, ""));
  return n >= 1 ? n : null;
}

/** The number in the file name: "matricula 1234.pdf", "00001234.docx". */
export function numberInName(name: string): number | null {
  const digits = name.replace(/\.[^.]+$/, "").match(/\d+/g);
  if (!digits?.length) return null;
  const n = Number((digits.at(-1) as string).replace(/^0+/, "") || "0");
  return n >= 1 && n < 10_000_000 ? n : null;
}

/** The CNM printed on the document, digits and dígito verificador. */
export function cnmInText(text: string): string | null {
  const m = /\bCNM\s*[:nº°.]*\s*([\d.\-\s]{14,24})/i.exec(text);
  if (!m?.[1]) return null;
  const digits = m[1].replace(/\D/g, "");
  return digits.length >= 15 ? digits : null;
}

export interface Conference {
  number: number | null;
  /** What to look at before generating; empty when all agrees. */
  issues: string[];
}

/**
 * The conferência the system does on its own: the number the office
 * typed, the one in the text and the one in the file name must agree, the
 * matrícula must be in the acervo, and the CNM printed must be its CNM.
 */
export function confer(input: {
  typed: number | null;
  name: string;
  text: string;
  acervo: { number: number; cnm: string } | null;
  textOk: boolean;
}): Conference {
  const issues: string[] = [];
  const inText = input.textOk ? numberInText(input.text) : null;
  const inName = numberInName(input.name);
  const number = input.typed ?? inText ?? inName;
  if (!number) {
    return {
      number: null,
      issues: ["Não achei o número da matrícula: informe-o."],
    };
  }
  const br = (n: number) => n.toLocaleString("pt-BR");
  if (inText !== null && inText !== number) {
    issues.push(
      `O texto diz matrícula nº ${br(inText)}, mas o arquivo vai como nº ${br(number)}.`,
    );
  }
  if (!input.textOk) {
    issues.push(
      "Não consegui ler o texto do arquivo para conferir o número (PDF de imagem?). Confira na prévia.",
    );
  }
  if (!input.acervo) {
    issues.push(
      `A matrícula nº ${br(number)} não está no acervo do sistema. Confira o número ou lance a matrícula antes.`,
    );
  } else if (input.acervo.cnm && input.textOk) {
    const cnm = cnmInText(input.text);
    const own = input.acervo.cnm.replace(/\D/g, "");
    if (cnm && own && cnm !== own) {
      issues.push(
        "O CNM impresso no documento não é o CNM desta matrícula no sistema.",
      );
    }
  }
  return { number, issues };
}
