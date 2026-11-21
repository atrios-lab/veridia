import {
  emptyQualification,
  emptyRequirement,
  type QualificationData,
} from "../qualificacao/qualificacao.ts";
import {
  addendumUnclear,
  type CedulaData,
  type CedulaGuarantee,
  type Plan,
} from "./analise.ts";
import { type CedulaKind, KIND_INFO } from "./especies.ts";

/**
 * The exigências the analysis finds in a cédula (decision of 21/11/2026:
 * "nota de exigência para após análise e ver algo que está faltando").
 * Suggestions only: the clerk checks each, edits, removes or adds, and the
 * nota devolutiva is issued by the Qualificação de títulos (numbered,
 * signed, delivered), never from here. Every exigência carries its basis;
 * none asks for a document the law forbids to ask (DL 167/1967, art. 14,
 * §§ 3º a 6º: no CCIR, ITR or CND for the cédulas).
 */

export interface SuggestedRequirement {
  /** Stable key, to tell the suggestions apart in the form. */
  key: string;
  title: string;
  description: string;
  howToComply: string;
  basis: string;
  /** What it refers to: the título, a bem, a person. */
  reference: string;
}

/** Where each kind lists the requisitos its título must carry. */
const REQUISITES: Record<CedulaKind, string> = {
  "rural-pignoraticia": "Decreto-Lei nº 167/1967, art. 14",
  "rural-hipotecaria": "Decreto-Lei nº 167/1967, art. 20",
  "rural-pignoraticia-hipotecaria": "Decreto-Lei nº 167/1967, art. 25",
  "nota-credito-rural": "Decreto-Lei nº 167/1967, art. 27",
  "credito-industrial": "Decreto-Lei nº 413/1969, art. 14",
  "credito-exportacao":
    "Lei nº 6.313/1975, art. 3º, e Decreto-Lei nº 413/1969, art. 14",
  "credito-comercial":
    "Lei nº 6.840/1980, art. 5º, e Decreto-Lei nº 413/1969, art. 14",
  "produto-rural": "Lei nº 8.929/1994, art. 3º",
  "credito-imobiliario": "Lei nº 10.931/2004, art. 19",
  "credito-bancario": "Lei nº 10.931/2004, art. 29",
  "imobiliaria-rural": "Lei nº 13.986/2020, art. 22",
};

const ON_IMOVEL = new Set<CedulaGuarantee["kind"]>([
  "hipoteca",
  "af-imovel",
  "afetacao",
]);

const married = (text: string) => /\bcasad[oa]\b/i.test(text);

function bemOf(g: CedulaGuarantee, index: number): string {
  const label = {
    penhor: "penhor",
    hipoteca: "hipoteca",
    "af-imovel": "alienação fiduciária",
    "af-movel": "alienação fiduciária",
    "af-produto": "alienação fiduciária de produtos",
    afetacao: "patrimônio rural em afetação",
    pessoal: "garantia pessoal",
  }[g.kind];
  return `Garantia ${index + 1} (${label}${g.registration ? `, ${g.registration}` : ""})`;
}

export function suggestRequirements(
  data: CedulaData,
  plan: Plan,
): SuggestedRequirement[] {
  const info = KIND_INFO[data.kind];
  const out: SuggestedRequirement[] = [];
  const title = data.title || info.label;
  const has = (role: string) =>
    data.people.some((p) => p.role === role && p.name.trim());

  // 1. The título's own requisitos, all in one exigência.
  const missing = [
    !data.issuedOn.trim() && "a data da emissão",
    !data.amount.trim() && "o valor do crédito",
    !data.dueOn.trim() && "o vencimento",
    !has("emitente") && "a identificação do emitente",
    !has("credor") && "a identificação do credor",
    data.kind === "produto-rural" &&
      !data.product.trim() &&
      "o produto, a quantidade e as características",
  ].filter((m): m is string => Boolean(m));
  if (missing.length > 0) {
    out.push({
      key: "requisitos",
      title: "Requisitos do título",
      description: `O título não traz ${missing.join(", ").replace(/, ([^,]*)$/, " e $1")}, que a lei exige na ${info.label.toLocaleLowerCase("pt-BR")}.`,
      howToComply:
        "Apresentar o título com os requisitos completos, ou aditivo, datado e assinado na forma da lei, que os complete.",
      basis: `${REQUISITES[data.kind]}.`,
      reference: title,
    });
  }

  for (const [index, g] of data.guarantees.entries()) {
    if (g.kind === "pessoal") continue;
    const bem = bemOf(g, index);
    // 2. A bem out of this circunscrição.
    if (g.here === "nao") {
      out.push({
        key: `g${index}-competencia`,
        title: "Bem fora desta circunscrição",
        description: `O bem da ${bem.toLocaleLowerCase("pt-BR")} fica fora da circunscrição desta serventia${g.municipality ? ` (${g.municipality})` : ""}: o registro dele não pode ser feito aqui.`,
        howToComply:
          "Apresentar o título ao Registro de Imóveis da situação do bem para o registro da garantia; nesta serventia seguem só os atos dos bens daqui.",
        basis: "Lei nº 6.015/1973, art. 169.",
        reference: bem,
      });
      continue;
    }
    // 3. A guarantee on an imóvel with no matrícula named.
    if (ON_IMOVEL.has(g.kind) && !g.registration.trim()) {
      out.push({
        key: `g${index}-matricula`,
        title: "Identificação do imóvel pela matrícula",
        description: `A ${bem.toLocaleLowerCase("pt-BR")} não indica a matrícula (ou o registro anterior) do imóvel dado em garantia.`,
        howToComply:
          "Indicar no título, ou em aditivo, o número da matrícula ou do registro anterior do imóvel e o cartório em que está.",
        basis: "Lei nº 6.015/1973, art. 222.",
        reference: bem,
      });
    }
    // 4. A penhor with no place for the bens: the competência depends on it.
    if (
      (g.kind === "penhor" || g.kind === "af-produto") &&
      !g.location.trim() &&
      !g.municipality.trim()
    ) {
      out.push({
        key: `g${index}-local`,
        title: "Local dos bens apenhados",
        description: `A ${bem.toLocaleLowerCase("pt-BR")} não diz onde estão os bens, o que define o Registro de Imóveis competente.`,
        howToComply:
          "Indicar no título, ou em aditivo, o imóvel (com a matrícula) e o município onde estão os bens dados em garantia.",
        basis: "Código Civil, arts. 1.438 e 1.448.",
        reference: bem,
      });
    }
    // 5. A married owner gives an imóvel without the spouse's consent.
    if (g.kind === "hipoteca" || g.kind === "af-imovel") {
      const givers = data.people.filter(
        (p) =>
          (p.role === "emitente" || p.role === "interveniente") &&
          married(p.qualification),
      );
      if (givers.length > 0 && !has("conjuge")) {
        out.push({
          key: `g${index}-conjuge`,
          title: "Outorga do cônjuge",
          description: `${givers.map((p) => p.name.trim().toLocaleUpperCase("pt-BR") || "O garantidor").join(" e ")} consta${givers.length > 1 ? "m" : ""} como casado(a) e não há a anuência do cônjuge para a ${bem.toLocaleLowerCase("pt-BR")}.`,
          howToComply:
            "Apresentar a anuência do cônjuge no título ou em instrumento próprio, ou comprovar o regime da separação absoluta de bens.",
          basis: "Código Civil, art. 1.647, I.",
          reference: bem,
        });
      }
    }
  }

  // 6. A cédula whose name and guarantees disagree.
  const kinds = new Set(data.guarantees.map((g) => g.kind));
  if (
    (data.kind === "rural-hipotecaria" ||
      data.kind === "rural-pignoraticia-hipotecaria") &&
    !kinds.has("hipoteca")
  ) {
    out.push({
      key: "sem-hipoteca",
      title: "Hipoteca não constituída",
      description:
        "A cédula se diz hipotecária, mas o título não descreve o imóvel dado em hipoteca.",
      howToComply:
        "Apresentar o título com a descrição do imóvel hipotecado e sua matrícula, ou retificá-lo por aditivo.",
      basis: `${REQUISITES[data.kind]}.`,
      reference: title,
    });
  }

  // 7. The CCI: série, custodiante, guarantee already registered.
  if (data.kind === "credito-imobiliario") {
    if (!data.series.trim() || !data.custodian.trim()) {
      out.push({
        key: "cci-serie",
        title: "Série e instituição custodiante da CCI",
        description:
          "A averbação da emissão da CCI deve trazer o número, a série e a instituição custodiante, que não constam do título apresentado.",
        howToComply:
          "Apresentar a CCI, ou declaração da instituição custodiante, com o número, a série e a custodiante.",
        basis: "Lei nº 10.931/2004, art. 18, § 5º.",
        reference: title,
      });
    }
    if (!kinds.has("hipoteca") && !kinds.has("af-imovel")) {
      out.push({
        key: "cci-garantia",
        title: "Garantia real registrada",
        description:
          "A emissão da CCI só se averba quando o crédito tem garantia real sobre imóvel registrada, e ela não foi indicada.",
        howToComply:
          "Indicar o registro da hipoteca ou da alienação fiduciária na matrícula, ou apresentar antes o título dessa garantia.",
        basis: "Lei nº 10.931/2004, art. 18, § 5º.",
        reference: title,
      });
    }
  }

  // 8. An aditivo that does not say what it changes: the requerente is
  // told and asked to clarify (decision of 21/11/2026).
  for (const [index, a] of data.addenda.entries()) {
    if (!addendumUnclear(a)) continue;
    const name = a.title || `${index + 1}º aditivo`;
    out.push({
      key: `a${index}-esclarecer`,
      title: "Alterações do aditivo",
      description: `O ${name} não diz com clareza o que altera na cédula (valor, vencimento, encargos, garantias ou partes), e sem isso não se sabe que ato praticar nem como cobrá-lo.`,
      howToComply:
        "Apresentar o aditivo, datado e assinado na forma da lei, com as cláusulas alteradas e os valores e datas de antes e de depois, ou declaração do credor que as esclareça.",
      basis:
        KIND_INFO[data.kind].family === "industrial"
          ? "Decreto-Lei nº 413/1969, arts. 12 e 36; Lei nº 6.015/1973, art. 198."
          : KIND_INFO[data.kind].family === "rural"
            ? "Decreto-Lei nº 167/1967, art. 12; Lei nº 6.015/1973, arts. 198 e 246."
            : "Lei nº 6.015/1973, arts. 198 e 246.",
      reference: name,
    });
  }

  // 9. Nothing to register here: a note says so, with what to do.
  const hereActs = plan.acts.filter((a) => !a.elsewhere && a.nature !== "fora");
  if (hereActs.length === 0 && data.kind === "nota-credito-rural") {
    out.push({
      key: "sem-ato",
      title: "Título sem ato no Registro de Imóveis",
      description:
        "A nota de crédito rural não constitui garantia real, e sua inscrição foi revogada pela Lei nº 13.986/2020 (art. 61, V, a): não há ato a praticar nesta serventia.",
      howToComply:
        "Havendo garantia real constituída em instrumento próprio (hipoteca, penhor rural), apresentar esse instrumento para o registro da garantia.",
      basis:
        "Lei nº 13.986/2020, art. 61, V, a (revogou os arts. 30 a 40 do Decreto-Lei nº 167/1967).",
      reference: title,
    });
  }
  return out;
}

/** "20/11/2026" to "2026-11-20"; "" when it is not a date. */
export function isoDay(value: string): string {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(value);
  if (!m) return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
  return `${m[3]}-${m[2]?.padStart(2, "0")}-${m[1]?.padStart(2, "0")}`;
}

/** What the clerk confirmed in the form, one per exigência kept. */
export interface ChosenRequirement {
  title: string;
  description: string;
  howToComply: string;
  basis: string;
  reference: string;
}

/**
 * The qualificação the nota de exigência is issued from (Registro de
 * Imóveis): the título, what is asked and the exigências the clerk kept,
 * already checked by a person (they are not the assistente's drafts).
 */
export function qualificationFromCedula(input: {
  data: CedulaData;
  plan: Plan;
  presenter: string;
  protocol: string;
  /** ISO day of today, when the protocol has no date. */
  today: string;
  requirements: ChosenRequirement[];
  newId: () => string;
}): QualificationData {
  const { data, plan } = input;
  const info = KIND_INFO[data.kind];
  const base = emptyQualification(
    "ri",
    isoDay(data.protocolDate) || input.today,
  );
  const here = plan.acts.filter((a) => !a.elsewhere && a.nature !== "fora");
  const creditor = data.people.find((p) => p.role === "credor")?.name.trim();
  const round = base.rounds[0];
  return {
    ...base,
    act: here.some((a) => a.nature === "registro") ? "registro" : "averbacao",
    presenter: { name: input.presenter.trim(), document: "", contact: "" },
    protocol: (input.protocol || data.protocolNumber).slice(0, 60),
    document: [
      `${info.label}${data.number ? ` nº ${data.number}` : ""}`,
      data.issuedOn ? `emitida em ${data.issuedOn}` : "",
      creditor ? `credor ${creditor}` : "",
      data.addenda.length
        ? `com ${data.addenda.length} ${data.addenda.length === 1 ? "aditivo" : "aditivos"}`
        : "",
    ]
      .filter(Boolean)
      .join(", "),
    object:
      here.map((a) => a.title).join("; ") ||
      "Registro das garantias constituídas na cédula.",
    rounds: round
      ? [
          {
            ...round,
            requirements: input.requirements.map((r) => ({
              ...emptyRequirement(input.newId(), 1),
              title: r.title.trim(),
              description: r.description.trim(),
              howToComply: r.howToComply.trim(),
              basis: r.basis.trim(),
              reference: r.reference.trim(),
              reviewed: true,
            })),
          },
        ]
      : base.rounds,
  };
}
