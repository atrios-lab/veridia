/**
 * Reads the answer of the TJRN seal lookup (SIEX) and turns it into data.
 *
 * The SIEX is a 2010-era Java application: it answers a form POST with a whole
 * HTML page, and the result of a lookup is a single blob of `<br>`-separated
 * lines inside one div. There is no API and no contract, so everything here is
 * shape-matching against captured fixtures (see `fixtures/`), and a page that
 * does not match any known shape is reported as `unrecognized` instead of
 * guessed at: showing nothing is recoverable, showing a wrong seal is not.
 */

/** One `Rótulo: valor` line of the lookup, kept exactly as the TJ wrote it. */
export interface SealField {
  label: string;
  value: string;
}

export interface SealSection {
  /** Heading of the section, absent for the fields that open the block. */
  title?: string;
  fields: SealField[];
  /** Lines that are not `label: value`, such as "1 lançamento(s)". */
  notes: string[];
}

export interface Seal {
  code: string;
  /** What the TJ appends to the code in parentheses, e.g. "Atualizado". */
  note?: string;
  sections: SealSection[];
}

export type SealLookup =
  | { kind: "seals"; seals: Seal[] }
  /** The TJ answered with a page-level message: wrong captcha, seal not found. */
  | { kind: "message"; text: string }
  /** Neither shape matched: the page changed, or something else answered. */
  | { kind: "unrecognized" };

const ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decodeEntities(text: string): string {
  return text.replace(
    /&(#\d+|#x[0-9a-f]+|[a-z]+);/gi,
    (whole, code: string) => {
      if (code.startsWith("#x") || code.startsWith("#X")) {
        return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
      }
      if (code.startsWith("#")) {
        return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
      }
      return ENTITIES[code.toLowerCase()] ?? whole;
    },
  );
}

/** Tags out, entities in, whitespace collapsed: what a person would read. */
function toText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** The content of the first element with `marker`, up to its closing tag. */
function sliceElement(html: string, marker: string): string | undefined {
  const start = html.indexOf(marker);
  if (start === -1) return undefined;
  const contentStart = html.indexOf(">", start);
  if (contentStart === -1) return undefined;
  const end = html.indexOf("</div>", contentStart);
  return html.slice(contentStart + 1, end === -1 ? undefined : end);
}

/**
 * The page-level message box. It is how the TJ reports a wrong captcha, and
 * the shape any other refusal is expected to take.
 */
function extractMessage(html: string): string | undefined {
  const block = sliceElement(html, '<div class="mensagemDaPagina">');
  if (block === undefined) return undefined;
  const text = toText(block);
  return text.length > 0 ? text : undefined;
}

/**
 * The result blob. The page carries several `conteudoSemRotulo` divs (the
 * form's own title and footnotes are two of them), so the one that opens a
 * seal is picked by content, never by position or by its generated id.
 */
function extractResultBlob(html: string): string | undefined {
  const marker = 'class="conteudoSemRotulo"';
  let from = 0;
  while (true) {
    const at = html.indexOf(marker, from);
    if (at === -1) return undefined;
    const block = sliceElement(html.slice(at), marker);
    if (block && /<h3>\s*C[óo]digo:/i.test(block)) return block;
    from = at + marker.length;
  }
}

/** A chunk wholly wrapped in `<b>` heads a section; one with a value is a field. */
function boldOnly(chunk: string): string | undefined {
  const match = chunk.match(/^\s*<b>([\s\S]*?)<\/b>\s*$/i);
  return match ? toText(match[1]) : undefined;
}

function toField(text: string): SealField | undefined {
  const at = text.indexOf(":");
  // A colon far into the line is prose (or a time), not a label.
  if (at <= 0 || at > 40) return undefined;
  const value = text.slice(at + 1).trim();
  if (value.length === 0) return undefined;
  return { label: text.slice(0, at).trim(), value };
}

function parseSections(blob: string): SealSection[] {
  const sections: SealSection[] = [{ fields: [], notes: [] }];

  for (const chunk of blob.split(/<br\s*\/?>/i)) {
    const heading = boldOnly(chunk);
    if (heading !== undefined) {
      // A heading always opens a section, even an empty one: "Selos
      // vinculados:" with nothing under it is the answer "none".
      if (heading.length > 0) {
        sections.push({
          title: heading.replace(/:$/, ""),
          fields: [],
          notes: [],
        });
      }
      continue;
    }

    const text = toText(chunk);
    if (text.length === 0) continue;

    const section = sections[sections.length - 1];
    const field = toField(text);
    if (field) section.fields.push(field);
    else section.notes.push(text);
  }

  // The opening section exists only to catch fields written before the first
  // heading; drop it when the page had none.
  return sections.filter(
    (s) => s.title !== undefined || s.fields.length > 0 || s.notes.length > 0,
  );
}

function parseSeals(blob: string): Seal[] {
  const seals: Seal[] = [];
  // Each seal opens with its own `<h3>Código: ...`; the closing disclaimer is
  // an <h3> too, which is why the split keys on the label and not on the tag.
  const parts = blob.split(/<h3>\s*(?=C[óo]digo:)/i).slice(1);

  for (const part of parts) {
    const headingEnd = part.search(/<\/h3>/i);
    if (headingEnd === -1) continue;
    const heading = toText(part.slice(0, headingEnd));
    const match = heading.match(/C[óo]digo:\s*([^\s(]+)\s*(?:\(([^)]*)\))?/i);
    if (!match) continue;

    // Anything after the closing disclaimer belongs to no seal.
    const rest = part.slice(headingEnd).split(/<h3>/i)[0];
    seals.push({
      code: match[1],
      ...(match[2] ? { note: match[2].trim() } : {}),
      sections: parseSections(rest),
    });
  }

  return seals;
}

export function parseSealLookup(html: string): SealLookup {
  const message = extractMessage(html);
  if (message) return { kind: "message", text: message };

  const blob = extractResultBlob(html);
  if (blob) {
    const seals = parseSeals(blob);
    if (seals.length > 0) return { kind: "seals", seals };
  }

  return { kind: "unrecognized" };
}
