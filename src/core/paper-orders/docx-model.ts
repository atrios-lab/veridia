/**
 * The supplier's own order form, as a Word file (decision of 11/11/2026):
 * the office uploads it once; the platform reads it (the title, the items
 * with their unit and minimum, the conditions) and, for every new order,
 * hands it back filled with the new data, the rest of the page as the
 * supplier drew it.
 *
 * Two ways the forms carry their blanks, both handled:
 * - a line "CARTÓRIO: ______" (or "CARTÓRIO: old value"), filled in place;
 * - a floating text box over the line (Word's VML or DrawingML), anchored
 *   in the paragraph just above it: the box gets the value.
 *
 * Pure string work on word/document.xml: no DOM, no zip here.
 */

export interface TextNode {
  /** Where the whole <w:t ...>...</w:t> element is, in the XML. */
  start: number;
  end: number;
  text: string;
}

interface TextBox {
  nodes: TextNode[];
  /** Horizontal offset, to tell two boxes on one line apart. */
  left: number;
}

export interface Paragraph {
  start: number;
  end: number;
  /** The paragraph's own text nodes (not those inside a text box). */
  nodes: TextNode[];
  text: string;
  boxes: TextBox[];
}

const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

const encode = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The body's top-level paragraphs, text boxes kept apart. */
export function paragraphsOf(xml: string): Paragraph[] {
  const ranges: { start: number; end: number }[] = [];
  const tag = /<w:p(?:\s[^>]*)?\/>|<w:p(?:\s[^>]*)?>|<\/w:p>/g;
  let depth = 0;
  let start = 0;
  for (let m = tag.exec(xml); m; m = tag.exec(xml)) {
    const t = m[0];
    if (t.endsWith("/>")) continue;
    if (t.startsWith("</")) {
      depth--;
      if (depth === 0) ranges.push({ start, end: m.index + t.length });
    } else {
      if (depth === 0) start = m.index;
      depth++;
    }
  }
  return ranges.map(({ start, end }) => {
    const chunk = xml.slice(start, end);
    const boxRanges: { start: number; end: number; left: number }[] = [];
    const box = /<w:txbxContent>([\s\S]*?)<\/w:txbxContent>/g;
    for (let m = box.exec(chunk); m; m = box.exec(chunk)) {
      const before = chunk.slice(0, m.index);
      // The shape that holds the box: its style (VML) or its offset.
      // The shape's style, not the text box's own ("mso-next-textbox").
      const style =
        [...before.matchAll(/style="([^"]*margin-left[^"]*)"/g)].at(-1)?.[1] ??
        "";
      const vml = style.match(/margin-left:\s*(-?[\d.]+)(pt|px|in)?/);
      const dml = [
        ...before.matchAll(/<wp:posOffset>(-?\d+)<\/wp:posOffset>/g),
      ].at(-1)?.[1];
      boxRanges.push({
        start: start + m.index,
        end: start + m.index + m[0].length,
        left: vml ? Number(vml[1]) : dml ? Number(dml) / 12700 : 0,
      });
    }
    // Word writes a DrawingML box and its VML fallback: one box, twice.
    const alternate = /<mc:Fallback>[\s\S]*?<\/mc:Fallback>/g;
    const fallbacks: { start: number; end: number }[] = [];
    for (let m = alternate.exec(chunk); m; m = alternate.exec(chunk)) {
      fallbacks.push({
        start: start + m.index,
        end: start + m.index + m[0].length,
      });
    }
    const nodes: TextNode[] = [];
    const boxes: TextBox[] = boxRanges
      .filter(
        (b) => !fallbacks.some((f) => b.start >= f.start && b.end <= f.end),
      )
      .map((b) => ({ nodes: [], left: b.left }));
    const kept = boxRanges.filter(
      (b) => !fallbacks.some((f) => b.start >= f.start && b.end <= f.end),
    );
    const t = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:t(?:\s[^>]*)?\/>/g;
    for (let m = t.exec(chunk); m; m = t.exec(chunk)) {
      const node = {
        start: start + m.index,
        end: start + m.index + m[0].length,
        text: decode(m[1] ?? ""),
      };
      if (fallbacks.some((f) => node.start >= f.start && node.end <= f.end)) {
        continue;
      }
      const inBox = kept.findIndex(
        (b) => node.start >= b.start && node.end <= b.end,
      );
      if (inBox >= 0) boxes[inBox]?.nodes.push(node);
      else nodes.push(node);
    }
    return {
      start,
      end,
      nodes,
      text: nodes.map((n) => n.text).join(""),
      boxes,
    };
  });
}

/* ---------------------------------------------------------------- reading */

export interface ModelItem {
  name: string;
  unit: string;
  minimum: number;
  note: string;
  unitPriceCents: number | null;
}

export interface ModelReading {
  title: string;
  items: ModelItem[];
  /** "Autorizamos a ... a efetuar o faturamento": who the supplier is. */
  intro: string;
  supplierName: string;
  /** "Os materiais serão entregues até 15 dias...". */
  delivery: string;
  /** "Autorizo ainda a empresa proceder a entrega ... na sede da ANOREG". */
  deliveryAddress: string;
  freightOptions: string[];
  paymentOptions: string[];
  /** Everything else worth keeping, in order. */
  conditions: string[];
}

const OFFICE_LINE =
  /^\s*(CART[ÓO]RIO|CNS|CPF|CNPJ|ENDERE[ÇC]O|CEP|MUNIC[ÍI]PIO|FONE|TELEFONE|E-?MAIL|NOME|DATA|ASSINATURA|DADOS DE FATURAMENTO|\(SOMENTE|COMPLETE OS DADOS)/i;

const DATE_LINE =
  /^\s*[A-Za-zÀ-ú .'-]+\/[A-Z]{2}\s*,\s*\d{1,2}\s+DE\s+\S+\s+DE\s+\d{4}\.?\s*$/i;

const ITEM_LINE =
  /^\s*([^:_]{2,80}?)\s*:\s*\.?_{3,}[\s_.]*\(?\s*(Folhas?|Rolos?|Unidades?|Caixas?|Blocos?|Resmas?|Pacotes?)\s*\)?\s*[-\u2013\u2014\s]*(?:M[íi]nimo de\s*([\d.]+)\s*[^\s(]*\s*(\(.*\))?)?/i;

const PRICED_LINE =
  /\(\s*\d+\s*\)\s*[a-zà-úç\s]*?unidades?(?:\(s\))?\s+de\s+(.+?)\s*[-\u2013\u2014]\s*valor unit[áa]rio\s*R\$\s*([\d.]+,\d{2})/i;

const tidy = (s: string) => s.replace(/\s+/g, " ").trim();

function money(text: string): number {
  return Math.round(Number(text.replace(/\./g, "").replace(",", ".")) * 100);
}

/** What the form says, to start the supplier's registration from it. */
export function readModel(xml: string): ModelReading {
  const reading: ModelReading = {
    title: "",
    items: [],
    intro: "",
    supplierName: "",
    delivery: "",
    deliveryAddress: "",
    freightOptions: [],
    paymentOptions: [],
    conditions: [],
  };
  for (const p of paragraphsOf(xml)) {
    const line = tidy(p.text);
    if (!line) continue;
    if (!reading.title && line.length <= 60 && line === line.toUpperCase()) {
      reading.title = line;
      continue;
    }
    const item = line.match(ITEM_LINE);
    if (item) {
      reading.items.push({
        name: tidy(item[1] ?? ""),
        unit: capitalize(tidy(item[2] ?? "Folhas")),
        minimum: Number((item[3] ?? "0").replace(/\./g, "")) || 0,
        note: tidy((item[4] ?? "").replace(/^\(|\)$/g, "")),
        unitPriceCents: null,
      });
      continue;
    }
    const priced = line.match(PRICED_LINE);
    if (priced) {
      reading.items.push({
        name: capitalize(tidy((priced[1] ?? "").replace(/\(s\)/g, ""))),
        unit: "Unidades",
        minimum: 0,
        note: "",
        unitPriceCents: money(priced[2] ?? "0"),
      });
      continue;
    }
    if (/^\(?.*impressora/i.test(line) && reading.items.length) {
      const last = reading.items.at(-1);
      if (last && !last.note) last.note = line.replace(/^\(|\)$/g, "").trim();
      continue;
    }
    if (/valor total do pedido/i.test(line)) continue;
    if (OFFICE_LINE.test(line) || DATE_LINE.test(line)) continue;
    const named = line.match(/Autorizamos a (.+?) a efetuar/i);
    if (named) {
      reading.supplierName = tidy(named[1] ?? "");
      reading.intro = line;
      continue;
    }
    if (/^Autorizo\b/i.test(line)) {
      reading.deliveryAddress = line;
      continue;
    }
    if (/frete/i.test(line) && line.length < 160) {
      reading.freightOptions = line
        .split(/\s{2,}|(?=Frete )/)
        .map(tidy)
        .filter((s) => /frete/i.test(s));
      continue;
    }
    if (/^prazo de entrega$|^pagamento$/i.test(line)) continue;
    if (/entregues|prazo de entrega/i.test(line) && !reading.delivery) {
      reading.delivery = line;
      continue;
    }
    if (/\bddl\b|boleto|outros\s*_/i.test(line) && line.length < 120) {
      // Split on the line as typed: the options sit apart by spaces.
      reading.paymentOptions = p.text
        .trim()
        .split(/\s{2,}/)
        .map((s) => tidy(s.replace(/_+/g, "")))
        .filter(Boolean);
      continue;
    }
    reading.conditions.push(line);
  }
  return reading;
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
}

/* ---------------------------------------------------------------- filling */

export type FieldKey =
  | "cpfFaturamento"
  | "cartorio"
  | "cns"
  | "cpf"
  | "cnpj"
  | "endereco"
  | "cep"
  | "municipio"
  | "fone"
  | "email"
  | "nome"
  | "data";

// No "\b": after a run of underscores ("____FONE:") there is no word
// boundary, "_" being a word character.
const FIELDS: { key: FieldKey; pattern: RegExp }[] = [
  // A colon, always: "no e-mail cadastrado" in a sentence is no blank.
  { key: "email", pattern: /E-?MAIL(?:\s+DO\s+CART[ÓO]RIO)?\s*:/gi },
  { key: "cartorio", pattern: /CART[ÓO]RIO\s*:/gi },
  { key: "cns", pattern: /(?<![A-Za-zÀ-ú])CNS\s*:/gi },
  { key: "cpf", pattern: /(?<![A-Za-zÀ-ú])CPF\s*:/gi },
  { key: "cnpj", pattern: /(?<![A-Za-zÀ-ú(])CNPJ\s*:/gi },
  { key: "endereco", pattern: /ENDERE[ÇC]O\s*:/gi },
  { key: "cep", pattern: /(?<![A-Za-zÀ-ú])CEP\s*:/gi },
  { key: "municipio", pattern: /MUNIC[ÍI]PIO\s*(?::|(?=_))/gi },
  { key: "fone", pattern: /(?<![A-Za-zÀ-ú])(?:TELE)?FONE\s*:/gi },
  { key: "nome", pattern: /(?<![A-Za-zÀ-ú])NOME\s*:/gi },
  { key: "data", pattern: /(?<![A-Za-zÀ-ú])DATA\s*:/gi },
];

export interface FillInput {
  fields: Partial<Record<FieldKey, string>>;
  /** Each item line by its label as printed ("Traslado"), and how many. */
  items: { label: string; quantity: string }[];
  /** "Ielmo Marinho/RN, 11 de novembro de 2026" for a dated line. */
  dateLine: string;
  /** For a single-product form ("(07) sete unidade(s) de ribbon"). */
  priced?: {
    quantity: number;
    words: string;
    unitPrice: string;
    total: string;
  };
}

interface Label {
  key: string;
  value: string;
  /** Where the label ends and its value region ends, in the line. */
  from: number;
  to: number;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function labelsIn(
  text: string,
  input: FillInput,
  seen: Map<string, number>,
): Label[] {
  const found: { key: string; value: string; at: number; from: number }[] = [];
  for (const { key, pattern } of FIELDS) {
    pattern.lastIndex = 0;
    for (let m = pattern.exec(text); m; m = pattern.exec(text)) {
      // "E-MAIL DO CARTÓRIO:" is the e-mail, not the office.
      if (
        key === "cartorio" &&
        found.some(
          (f) => f.key === "email" && f.at <= m.index && m.index < f.from,
        )
      ) {
        continue;
      }
      // "DADOS DE FATURAMENTO (CNPJ):" is a heading.
      if (key === "cnpj" && /\(\s*$/.test(text.slice(0, m.index))) continue;
      // A second CPF on the form is the billing one ("dados de
      // faturamento"): the holder's goes only on the first.
      const count = seen.get(key) ?? 0;
      seen.set(key, count + 1);
      const value =
        key === "cpf" && count > 0
          ? (input.fields.cpfFaturamento ?? "")
          : (input.fields[key] ?? "");
      found.push({ key, value, at: m.index, from: m.index + m[0].length });
    }
  }
  for (const item of input.items) {
    const m = text.match(
      new RegExp(`^\\s*${escapeRegExp(item.label)}\\s*:\\.?`, "i"),
    );
    if (m) {
      found.push({
        key: `item:${item.label}`,
        value: item.quantity,
        at: m.index ?? 0,
        from: (m.index ?? 0) + m[0].length,
      });
    }
  }
  found.sort((a, b) => a.at - b.at);
  // A form line starts with its label ("CNPJ: ___"); a label in the middle
  // of a sentence ("... LTDA \u2013 CNPJ: 16.520...") is the supplier's text.
  // After the first, the others on the line count ("... FONE: ___").
  const first = found.findIndex((f) => text.slice(0, f.at).trim() === "");
  if (first < 0) return [];
  found.splice(0, first);
  // Overlapping matches (the e-mail and the office): the first wins.
  const kept = found.filter(
    (f, i) => !found.slice(0, i).some((g) => f.at < g.from && f.at >= g.at),
  );
  return kept.map((f, i) => ({
    key: f.key,
    value: f.value,
    from: f.from,
    to: kept[i + 1]?.at ?? text.length,
  }));
}

interface Edit {
  start: number;
  end: number;
  text: string;
}

const element = (text: string) =>
  `<w:t xml:space="preserve">${encode(text)}</w:t>`;

interface Op {
  a: number;
  b: number;
  insert: string;
}

/**
 * Applies the line's replacements on its runs: every character knows its
 * run, an insertion goes to the run where it lands, so the label keeps its
 * bold and the value takes the blank's type. One edit per run changed.
 */
function applyOps(nodes: TextNode[], ops: Op[]): Edit[] {
  if (nodes.length === 0 || ops.length === 0) return [];
  const chars = nodes.flatMap((node, i) =>
    [...node.text].map((ch) => ({ ch, node: i })),
  );
  for (const op of [...ops].sort((x, y) => y.a - x.a)) {
    const owner =
      op.a < chars.length
        ? (chars[op.a]?.node ?? 0)
        : (chars.at(-1)?.node ?? nodes.length - 1);
    chars.splice(
      op.a,
      Math.max(0, op.b - op.a),
      ...[...op.insert].map((ch) => ({ ch, node: owner })),
    );
  }
  const texts = nodes.map(() => "");
  for (const c of chars) texts[c.node] += c.ch;
  return nodes.flatMap((node, i) =>
    texts[i] === node.text
      ? []
      : [{ start: node.start, end: node.end, text: element(texts[i] ?? "") }],
  );
}

function setBox(box: TextBox, value: string): Edit[] {
  return box.nodes.map((node, i) => ({
    start: node.start,
    end: node.end,
    text: element(i === 0 ? value : ""),
  }));
}

/**
 * The form filled: each known label gets its value, in the floating box
 * anchored above it when there is one, else on the line itself (the
 * underscores give way to the value, or the old value is replaced).
 */
export function fillModel(xml: string, input: FillInput): string {
  const paragraphs = paragraphsOf(xml);
  const edits: Edit[] = [];
  let pending: TextBox[] = [];
  const seen = new Map<string, number>();

  for (const p of paragraphs) {
    const line = p.text;
    const labels = line.trim() ? labelsIn(line, input, seen) : [];
    const available = [...pending, ...p.boxes];

    if (!line.trim()) {
      // An empty paragraph only anchors boxes for the line below.
      pending = available;
      continue;
    }

    if (DATE_LINE.test(line) && input.dateLine) {
      const upper = line === line.toUpperCase();
      edits.push(
        ...applyOps(p.nodes, [
          {
            a: 0,
            b: line.length,
            insert: upper ? input.dateLine.toUpperCase() : input.dateLine,
          },
        ]),
      );
      pending = p.boxes;
      continue;
    }

    if (input.priced) {
      const ops: Op[] = [];
      const q = line.match(/\(\s*\d+\s*\)\s*([a-zà-úç\s]*?)\s*(?=unidades?)/i);
      if (q?.index !== undefined) {
        ops.push({
          a: q.index,
          b: q.index + q[0].length,
          insert: `(${String(input.priced.quantity).padStart(2, "0")}) ${input.priced.words} `,
        });
        const price = line.match(/valor unit[áa]rio\s*R\$\s*([\d.]+,\d{2})/i);
        if (price?.index !== undefined && input.priced.unitPrice) {
          const at = price.index + price[0].length - (price[1]?.length ?? 0);
          ops.push({
            a: at,
            b: at + (price[1]?.length ?? 0),
            insert: input.priced.unitPrice,
          });
        }
      }
      const total = line.match(
        /valor total do pedido[\s\S]*?R\$\s*([\d.]+,\d{2})/i,
      );
      if (total?.index !== undefined) {
        const at = total.index + total[0].length - (total[1]?.length ?? 0);
        ops.push({
          a: at,
          b: at + (total[1]?.length ?? 0),
          insert: input.priced.total,
        });
      }
      if (ops.length) {
        edits.push(...applyOps(p.nodes, ops));
        pending = p.boxes;
        continue;
      }
    }

    if (labels.length === 0) {
      // A line with no blank of ours: boxes above it were not for us.
      pending = p.boxes;
      continue;
    }

    // The boxes anchored above (and on) this line, as many as it has
    // labels, left to right; the rest go on to the next line.
    const taken = available
      .slice(0, labels.length)
      .sort((a, b) => a.left - b.left);
    pending = available.slice(labels.length);
    // Left to right, box by box: with fewer boxes than labels, the first
    // labels get them and the rest are filled on the line.
    const byLabel = new Map<number, TextBox>();
    for (const [i, box] of taken.entries()) byLabel.set(i, box);

    const ops: Op[] = [];
    labels.forEach((label, i) => {
      const box = byLabel.get(i);
      if (box) {
        edits.push(...setBox(box, label.value));
        return;
      }
      if (!label.value) return;
      const region = line.slice(label.from, label.to);
      const blank = region.match(/_{3,}/);
      if (blank?.index !== undefined) {
        const a = label.from + blank.index;
        const b = a + blank[0].length;
        // A space around the value only where the line has none.
        const before = /\s/.test(line[a - 1] ?? " ") ? "" : " ";
        const after = b >= line.length || /\s/.test(line[b] ?? "") ? "" : " ";
        ops.push({ a, b, insert: `${before}${label.value}${after}` });
        return;
      }
      if (label.key.startsWith("item:")) return;
      // An old value after the label: replaced up to the next label.
      const lead = region.match(/^\s*/)?.[0].length ?? 0;
      const trail = region.length - region.trimEnd().length;
      ops.push({
        a: label.from + lead,
        b: label.to - trail,
        insert: `${lead ? "" : " "}${label.value}${trail || label.to === line.length ? "" : " "}`,
      });
    });
    edits.push(...applyOps(p.nodes, ops));
  }

  let out = xml;
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  }
  return out;
}
