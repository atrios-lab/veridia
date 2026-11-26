import type { Situation } from "./acts.ts";
import type { FichaContent } from "./ficha.ts";

/**
 * The certidões of the Registro de Imóveis (Lei nº 6.015/1973, art. 19:
 * "em inteiro teor, em resumo, ou em relatório, conforme quesitos"), as the
 * office asked on 26/11/2026: inteiro teor and ônus in the model it sent
 * (only the layout; no data of any client), and the other forms the law
 * gives. The text only; the document is drawn by the panel's renderer.
 *
 * - inteiro teor: the ficha as it is (art. 19, § 1º), which is enough to
 *   prove the ônus (§ 11);
 * - ônus reais: the situação jurídica in force (§ 9º): free, or the ônus;
 * - resumo (extrato): who owns it, what burdens it, and the ficha's data;
 * - quesitos (relatório): each question answered from the acervo;
 * - negativa: no matrícula in the name asked for.
 */

export type CertidaoKind =
  | "inteiro-teor"
  | "onus"
  | "resumo"
  | "quesitos"
  | "negativa";

export const CERTIDAO_LABELS: Record<CertidaoKind, string> = {
  "inteiro-teor": "Certidão de inteiro teor",
  onus: "Certidão de registro/ônus",
  resumo: "Certidão em resumo",
  quesitos: "Certidão em relatório",
  negativa: "Certidão negativa de propriedade",
};

export const CERTIDAO_RULES: Record<CertidaoKind, string> = {
  "inteiro-teor":
    "Lei nº 6.015/1973, art. 19, § 1º: reprodução de tudo o que consta da matrícula. Pelo § 11, o inteiro teor basta para provar os ônus.",
  onus: "Lei nº 6.015/1973, art. 19, § 9º: situação jurídica atualizada do imóvel, com os ônus em vigor.",
  resumo:
    "Lei nº 6.015/1973, art. 19, caput: certidão em resumo, com os dados em vigor.",
  quesitos:
    "Lei nº 6.015/1973, art. 19, caput: certidão em relatório, respondendo aos quesitos do pedido.",
  negativa:
    "Lei nº 6.015/1973, arts. 16 a 19: certifica que não há matrícula em nome da pessoa pesquisada.",
};

export interface CertidaoSection {
  heading?: string;
  paragraphs: string[];
}

export interface CertidaoInput {
  kind: CertidaoKind;
  /** "Ielmo Marinho/RN", the office's place. */
  place: string;
  /** "26 de novembro de 2026". */
  dateText: string;
  /** "Matrícula nº 001 do Livro 2" (not for the negativa). */
  reference?: string;
  ficha?: FichaContent;
  situation?: Situation;
  questions?: string[];
  /** Negativa: whom and what was searched. */
  searched?: { name: string; document: string };
  /** Who asked, when said (otherwise "a pedido verbal da parte"). */
  requester?: string;
  /** "2-I" and the ficha, as the opening of the model cites them. */
  book?: { volume: string; ficha: string };
  /** "MATRÍCULA Nº 1.693 - Data: 09/09/2024 - CNM: ...", centred. */
  headline?: string;
  /** "IMÓVEL RURAL" or "IMÓVEL URBANO". */
  idLabel?: string;
}

/** The ficha in the text of the certidão: each ato with its label in bold. */
function fichaParagraphs(ficha: FichaContent | undefined): string[] {
  return (ficha?.blocks ?? []).flatMap((b) => {
    const lines = b.text.split("\n").filter(Boolean);
    const label = b.meta ? `${b.label} - ${b.meta}` : b.label;
    return lines.length
      ? [
          `**${label.toLocaleUpperCase("pt-BR")}:** ${lines[0]}`,
          ...lines.slice(1),
        ]
      : [`**${label}**`];
  });
}

const where = (input: CertidaoInput, ref: string) =>
  input.book
    ? `que revendo o livro de Registro de Imóveis nº “${input.book.volume}”, da ficha ${input.book.ficha}, consta o registro de teor seguinte:`
    : `que revendo os livros deste Registro de Imóveis, dele consta ${ref}, cujo teor é o seguinte:`;

const lower = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const STOP = new Set(
  "a o as os de da do das dos e em no na nos nas um uma para por com que se ha qual quais quem existe existem consta constam sobre ao aos".split(
    " ",
  ),
);

/** The blocks of the ficha that answer a question, by its words. */
export function answerQuestion(
  question: string,
  ficha: FichaContent,
  situation?: Situation,
): string {
  const q = lower(question);
  if (situation && /proprietari|dono|titular|em nome/.test(q)) {
    return situation.owners.length
      ? `Consta como proprietário(s): ${situation.owners
          .map(
            (o) =>
              `${o.name}${o.document ? `, ${o.document}` : ""}${o.share ? ` (${o.share})` : ""}, desde ${o.since}`,
          )
          .join("; ")}.`
      : "Não consta proprietário registrado na matrícula.";
  }
  if (
    situation &&
    /onus|hipoteca|penhora|gravame|alienacao fiduciaria/.test(q)
  ) {
    return situation.burdens.length
      ? `Consta(m) em vigor: ${situation.burdens.map((b) => `${b.label}${b.nature ? ` (${b.nature})` : ""}`).join("; ")}.`
      : "Não constam ônus reais em vigor.";
  }
  const words = q
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
  if (words.length === 0) return "Pergunta sem termo para pesquisar.";
  const hits = ficha.blocks.filter((b) => {
    const text = lower(`${b.label} ${b.text}`);
    return words.some((w) => text.includes(w));
  });
  return hits.length
    ? hits
        .map((b) => `${b.label}${b.meta ? ` (${b.meta})` : ""}: ${b.text}`)
        .join("\n")
    : "Nada consta na matrícula sobre o que foi perguntado.";
}

const opening = (input: CertidaoInput, what: string) =>
  `CERTIFICO, em razão do meu ofício e ${input.requester ? `a pedido de ${input.requester}` : "a pedido verbal da parte interessada"}, ${what}`;

/** The text of the certidão, section by section. */
export function certidaoSections(input: CertidaoInput): CertidaoSection[] {
  const out: CertidaoSection[] = [];
  const ref = input.reference ?? "a matrícula";
  const owners = input.situation?.owners ?? [];
  const burdens = input.situation?.burdens ?? [];
  switch (input.kind) {
    case "inteiro-teor": {
      out.push({
        paragraphs: [
          opening(input, where(input, ref)),
          ...(input.headline ? [`**${input.headline}**`] : []),
          ...fichaParagraphs(input.ficha),
          "Nada mais consta. As alterações posteriores ao ato, quando existentes, estão mencionadas acima (Lei nº 6.015/1973, art. 21).",
        ],
      });
      break;
    }
    case "onus": {
      // Resumida, as the office's model: the matrícula, the imóvel, the
      // atos (label and nature), the current owners and the ônus.
      const first = input.ficha?.blocks[0];
      const acts = (input.ficha?.blocks ?? []).slice(1);
      out.push({
        paragraphs: [
          opening(input, where(input, ref)),
          ...(input.headline ? [`**${input.headline}**`] : []),
          ...(first
            ? [
                `**${(input.idLabel ?? "IMÓVEL").toLocaleUpperCase("pt-BR")}:\u00a0**${first.text.split("\n").filter(Boolean).join(" ")}`,
              ]
            : []),
          ...acts.map(
            (b) =>
              `**${(b.meta ? `${b.label} - DATA: ${b.meta}` : b.label).toLocaleUpperCase("pt-BR")}**${b.text ? ` \u2013 ${b.text.split(/[.:]/)[0]?.trim() ?? ""}.` : ""}`,
          ),
          `**NOME, DOMICÍLIO E NACIONALIDADE DOS PROPRIETÁRIOS:\u00a0**${
            owners.length
              ? owners
                  .map(
                    (o) =>
                      `**${o.name}**${o.document ? `, CPF/CNPJ nº ${o.document}` : ""}`,
                  )
                  .join("; ")
              : "não consta proprietário registrado"
          }.`,
          burdens.length
            ? `**Certifico**, ainda, que sobre o imóvel da matrícula acima referida pesa(m) o(s) seguinte(s) ônus real(is), em vigor: ${burdens
                .map(
                  (b) =>
                    `${b.label}${b.nature ? ` (${b.nature})` : ""}${b.registeredOn ? `, registrado em ${b.registeredOn.split("-").reverse().join("/")}` : ""}${b.parties.length ? `, figurando ${b.parties.map((p) => p.name).join(", ")}` : ""}`,
                )
                .join("; ")}. O referido é verdade e dou fé.`
            : "**Certifico**, ainda, que a matrícula acima referida encontra-se livre e desembaraçada de quaisquer ônus reais, judiciais ou extrajudiciais que possam restringir ou limitar a livre disposição do imóvel. O referido é verdade e dou fé.",
        ],
      });
      return out;
    }
    case "resumo": {
      const identification = input.ficha?.blocks[0];
      out.push({
        paragraphs: [
          opening(
            input,
            `que revendo os livros deste Registro de Imóveis, dele consta ${ref}, cujo resumo é o seguinte:`,
          ),
        ],
      });
      if (identification) {
        out.push({
          heading: "Imóvel",
          paragraphs: identification.text.split("\n").filter(Boolean),
        });
      }
      out.push({
        heading: "Proprietário(s)",
        paragraphs: owners.length
          ? owners.map(
              (o) =>
                `${o.name}${o.document ? `, ${o.document}` : ""}${o.share ? `, ${o.share}` : ""} (${o.since}).`,
            )
          : ["Não consta proprietário registrado."],
      });
      out.push({
        heading: "Ônus reais em vigor",
        paragraphs: burdens.length
          ? burdens.map((b) => `${b.label}${b.nature ? `: ${b.nature}` : ""}.`)
          : ["Nenhum."],
      });
      if (input.situation?.lastAct) {
        out.push({
          heading: "Último ato",
          paragraphs: [input.situation.lastAct],
        });
      }
      break;
    }
    case "quesitos": {
      out.push({
        paragraphs: [
          opening(
            input,
            `que revendo ${ref}, em resposta aos quesitos apresentados, consta o seguinte:`,
          ),
        ],
      });
      (input.questions ?? []).forEach((q, i) => {
        out.push({
          heading: `${i + 1}º quesito: ${q}`,
          paragraphs: (input.ficha
            ? answerQuestion(q, input.ficha, input.situation)
            : "Sem matrícula para responder."
          )
            .split("\n")
            .filter(Boolean),
        });
      });
      break;
    }
    case "negativa": {
      const who = input.searched;
      out.push({
        paragraphs: [
          opening(
            input,
            `que revendo os indicadores real e pessoal (Livros 4 e 5) deste Registro de Imóveis, NÃO ENCONTREI imóvel registrado em nome de ${who?.name || "pessoa não informada"}${who?.document ? `, inscrito(a) sob o nº ${who.document}` : ""}, até a presente data.`,
          ),
        ],
      });
      break;
    }
  }
  out.push({ paragraphs: ["O referido é verdade e dou fé."] });
  return out;
}
