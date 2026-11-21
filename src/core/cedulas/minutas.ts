import {
  type CedulaAddendum,
  type CedulaData,
  type CedulaGuarantee,
  type CedulaPerson,
  CHANGE_LABELS,
  formatMoney,
  inferChanges,
  moneyCents,
  type PersonRole,
  type PlannedAct,
  planActs,
} from "./analise.ts";
import { GUARANTEE_LABELS, KIND_INFO } from "./especies.ts";

/**
 * The models of the acts (decision of 21/11/2026: "gera modelos de
 * certidão, averbação, registro e outras, mas tenha os botões para o
 * cartório decidir o que quer"). Written for this panel in its own words,
 * in the order the law asks the act to say things (title, parties, value,
 * due date, guarantee, protocol); the Caderno IRIB nº 9 is a cited
 * reference, never copied. A missing piece reads "[preencher: ...]", so
 * nothing is invented.
 */

export interface OfficePlace {
  city: string;
  state: string;
}

export interface Model {
  id: string;
  title: string;
  /** "Registro", "Averbação", "Certidão"... for the button. */
  group: "registro" | "averbacao" | "remissao" | "certidao" | "posterior";
  text: string;
}

const fill = (value: string, what: string) =>
  value.trim() ? value.trim() : `[preencher: ${what}]`;

const upper = (value: string) => value.trim().toLocaleUpperCase("pt-BR");

function person(p: CedulaPerson): string {
  const parts = [
    upper(p.name) || "[preencher: nome]",
    p.taxId.trim() ? `inscrito(a) no CPF/CNPJ sob o nº ${p.taxId.trim()}` : "",
    p.qualification.trim(),
  ].filter(Boolean);
  return parts.join(", ");
}

function people(data: CedulaData, role: PersonRole): string {
  const list = data.people.filter((p) => p.role === role);
  return list.map(person).join("; ");
}

function partyLines(data: CedulaData, emitterLabel = "EMITENTE"): string[] {
  const emitters = people(data, "emitente");
  const lines = [`${emitterLabel}: ${emitters || "[preencher: emitente]"}.`];
  const intervening = people(data, "interveniente");
  if (intervening) lines.push(`INTERVENIENTE GARANTIDOR: ${intervening}.`);
  const keeper = people(data, "fiel-depositario");
  if (keeper) lines.push(`FIEL DEPOSITÁRIO: ${keeper}.`);
  lines.push(
    `CREDOR: ${people(data, "credor") || "[preencher: credor]"}, ou à sua ordem.`,
  );
  const guarantors = people(data, "avalista");
  if (guarantors) lines.push(`AVALISTA: ${guarantors}.`);
  const spouses = people(data, "conjuge");
  if (spouses) lines.push(`CÔNJUGE ANUENTE: ${spouses}.`);
  return lines;
}

function titleLine(data: CedulaData): string {
  const info = KIND_INFO[data.kind];
  return `${upper(info.label)} nº ${fill(data.number, "número")}, emitida em ${fill(data.issuedOn, "data da emissão")}${data.issuePlace ? `, em ${data.issuePlace.trim()}` : ""}`;
}

function creditLines(data: CedulaData): string[] {
  const lines = [
    `VALOR: ${fill(data.amount, "valor do crédito")}.`,
    `VENCIMENTO: ${fill(data.dueOn, "vencimento")}.`,
  ];
  if (data.paymentPlace)
    lines.push(`PRAÇA DE PAGAMENTO: ${data.paymentPlace.trim()}.`);
  if (data.paymentTerms)
    lines.push(`FORMA DE PAGAMENTO: ${data.paymentTerms.trim()}.`);
  lines.push(`ENCARGOS: ${data.charges.trim() || "os constantes do título"}.`);
  if (data.product) lines.push(`PRODUTO: ${data.product.trim()}.`);
  return lines;
}

function guaranteeText(g: CedulaGuarantee): string {
  const grade = g.grade.trim() ? ` DE ${upper(g.grade)} GRAU` : "";
  const kind = {
    penhor: `PENHOR CEDULAR${grade}`,
    hipoteca: `HIPOTECA CEDULAR${grade}`,
    "af-imovel": "ALIENAÇÃO FIDUCIÁRIA DE IMÓVEL",
    "af-movel": "ALIENAÇÃO FIDUCIÁRIA DE BEM MÓVEL",
    "af-produto": "ALIENAÇÃO FIDUCIÁRIA DE PRODUTOS AGROPECUÁRIOS",
    afetacao: "PATRIMÔNIO RURAL EM AFETAÇÃO",
    pessoal: "GARANTIA PESSOAL",
  }[g.kind];
  return [
    `${kind}: ${fill(g.description, "descrição dos bens")}`,
    g.owner ? `de propriedade de ${upper(g.owner)}` : "",
    g.location ? `localizados em ${g.location.trim()}` : "",
    g.registration ? `objeto da ${g.registration.trim()}` : "",
  ]
    .filter(Boolean)
    .join(", ");
}

function closing(
  data: CedulaData,
  place: OfficePlace,
  basis: string,
): string[] {
  return [
    "CONDIÇÕES: as demais constam do título, cuja via não negociável fica arquivada nesta serventia.",
    `PROTOCOLO: nº ${fill(data.protocolNumber, "número do protocolo")}, de ${fill(data.protocolDate, "data do protocolo")}.`,
    `FUNDAMENTO: ${basis}`,
    "",
    `${place.city}/${place.state}, [preencher: data].`,
    "O(A) Oficial(a): ______________________________",
    "Emolumentos: [preencher]. Selo: [preencher].",
  ];
}

const join = (lines: string[]) => lines.join("\n");

function guaranteeOf(
  data: CedulaData,
  act: PlannedAct,
): CedulaGuarantee | null {
  return act.guaranteeIndex === undefined
    ? null
    : (data.guarantees[act.guaranteeIndex] ?? null);
}

function addendumOf(data: CedulaData, act: PlannedAct): CedulaAddendum | null {
  return act.addendumIndex === undefined
    ? null
    : (data.addenda[act.addendumIndex] ?? null);
}

/** The text that says what an aditivo changed, change by change. */
export function addendumChanges(a: CedulaAddendum): string[] {
  const changes = inferChanges(a);
  const lines: string[] = [];
  if (changes.includes("prazo")) {
    lines.push(
      `o vencimento passou ${a.previousDue ? `de ${a.previousDue.trim()} ` : ""}para ${fill(a.newDue, "novo vencimento")}`,
    );
  }
  if (changes.includes("valor-aumento") || changes.includes("valor-reducao")) {
    const before = moneyCents(a.previousAmount);
    const after = moneyCents(a.newAmount);
    const diff =
      before !== null && after !== null && after !== before
        ? ` (${after > before ? "acréscimo" : "redução"} de ${formatMoney(Math.abs(after - before))})`
        : "";
    lines.push(
      `o valor do crédito passou ${a.previousAmount ? `de ${a.previousAmount.trim()} ` : ""}para ${fill(a.newAmount, "novo valor")}${diff}`,
    );
  }
  for (const change of changes) {
    if (["prazo", "valor-aumento", "valor-reducao"].includes(change)) continue;
    if (change.startsWith("garantia")) {
      lines.push(
        `${CHANGE_LABELS[change].toLocaleLowerCase("pt-BR")}: ${fill(a.guaranteeChange, "bens incluídos, substituídos ou liberados")}`,
      );
    } else if (change !== "outro") {
      lines.push(
        `${CHANGE_LABELS[change].toLocaleLowerCase("pt-BR")}: ${fill(a.description, "o que mudou")}`,
      );
    }
  }
  if (changes.includes("outro") || (changes.length === 0 && a.description)) {
    lines.push(fill(a.description, "o que mudou"));
  }
  return lines;
}

/** The declared value of an aditivo, as the averbação states it. */
function declaredValue(
  a: CedulaAddendum | null,
  charge: PlannedAct["charge"],
): string {
  if (!a) return "[preencher: valor]";
  const before = moneyCents(a.previousAmount);
  const after = moneyCents(a.newAmount);
  if (before === null || after === null) {
    return "[preencher: valor alterado pelo aditivo]";
  }
  const diff = formatMoney(Math.abs(after - before));
  return charge === "valor-suplementar"
    ? `${diff}, crédito suplementar (o crédito passou de ${formatMoney(before)} para ${formatMoney(after)})`
    : `${formatMoney(after)}, novo valor do crédito (${after > before ? "acréscimo" : "redução"} de ${diff} sobre ${formatMoney(before)})`;
}

/** The model of one planned act; null for an act with no paper here. */
export function modelFor(
  data: CedulaData,
  act: PlannedAct,
  place: OfficePlace,
): Model | null {
  if (!act.model || act.elsewhere) return null;
  const info = KIND_INFO[data.kind];
  const g = guaranteeOf(data, act);
  const a = addendumOf(data, act);
  switch (act.model) {
    case "cedula-livro-3":
      return {
        id: act.id,
        title: act.title,
        group: "registro",
        text: join([
          "REGISTRO NO LIVRO Nº 3, REGISTRO AUXILIAR",
          "R.[preencher: nº], em [preencher: data].",
          `TÍTULO: ${titleLine(data)}.`,
          ...partyLines(data),
          ...creditLines(data),
          `GARANTIAS: ${
            data.guarantees
              .filter((x) => x.kind !== "pessoal")
              .map(guaranteeText)
              .join("; ") || "[preencher: garantias]"
          }.`,
          ...closing(data, place, act.basis),
        ]),
      };
    case "penhor-livro-3":
    case "af-produto-livro-3":
      return {
        id: act.id,
        title: act.title,
        group: "registro",
        text: join([
          "REGISTRO NO LIVRO Nº 3, REGISTRO AUXILIAR",
          "R.[preencher: nº], em [preencher: data].",
          `TÍTULO: ${g ? guaranteeText(g).split(":")[0] : "GARANTIA"} constituído(a) na ${titleLine(data)}.`,
          ...partyLines(data, "EMITENTE/DEVEDOR"),
          ...creditLines(data),
          `BENS: ${g ? guaranteeText(g) : "[preencher: bens]"}.`,
          ...closing(data, place, act.basis),
        ]),
      };
    case "hipoteca-matricula":
    case "af-imovel-matricula":
    case "afetacao-matricula":
      return {
        id: act.id,
        title: act.title,
        group: "registro",
        text: join([
          `R.[preencher: nº]/${fill(g?.registration.replace(/\D+/g, "") ?? "", "matrícula")}, em [preencher: data].`,
          `TÍTULO: ${g ? guaranteeText(g).split(":")[0] : "GARANTIA"}, constituída na ${titleLine(data)}.`,
          ...partyLines(
            data,
            act.model === "afetacao-matricula" ? "PROPRIETÁRIO" : "DEVEDOR",
          ),
          ...creditLines(data),
          "GARANTIA: o imóvel objeto desta matrícula.",
          ...(info.cedulaAct.where === "livro-3"
            ? [
                "REGISTRO DA CÉDULA: R.[preencher: nº] do Livro nº 3, Registro Auxiliar, desta serventia.",
              ]
            : []),
          ...closing(data, place, act.basis),
        ]),
      };
    case "averbacao-emissao-cci":
      return {
        id: act.id,
        title: act.title,
        group: "averbacao",
        text: join([
          `AV.[preencher: nº]/${fill(g?.registration.replace(/\D+/g, "") ?? "", "matrícula")}, em [preencher: data].`,
          `EMISSÃO DE CÉDULA DE CRÉDITO IMOBILIÁRIO: averba-se a emissão da CCI nº ${fill(data.number, "número")}, série ${fill(data.series, "série")}, tendo como instituição custodiante ${fill(data.custodian, "instituição custodiante")}, representativa do crédito garantido pelo R.[preencher: nº] desta matrícula.`,
          `PROTOCOLO: nº ${fill(data.protocolNumber, "número do protocolo")}, de ${fill(data.protocolDate, "data do protocolo")}.`,
          `FUNDAMENTO: ${act.basis}`,
          "",
          `${place.city}/${place.state}, [preencher: data].`,
          "O(A) Oficial(a): ______________________________",
        ]),
      };
    case "averbacao-localizacao-penhor":
      return {
        id: act.id,
        title: act.title,
        group: "averbacao",
        text: join([
          "AV.[preencher: nº]/[preencher: matrícula do imóvel de localização], em [preencher: data].",
          `LOCALIZAÇÃO DE BENS APENHADOS: a requerimento de [preencher: requerente], averba-se que neste imóvel se encontram bens dados em penhor na ${titleLine(data)}, registrado sob o nº [preencher] no Livro nº 3, Registro Auxiliar, desta serventia, a saber: ${g ? fill(g.description, "bens") : "[preencher: bens]"}.`,
          `CREDOR: ${people(data, "credor") || "[preencher: credor]"}.`,
          `FUNDAMENTO: ${act.basis}`,
          "",
          `${place.city}/${place.state}, [preencher: data].`,
          "O(A) Oficial(a): ______________________________",
        ]),
      };
    case "remissao":
      return {
        id: act.id,
        title: act.title,
        group: "remissao",
        text: join([
          "No registro do Livro nº 3:",
          "AV.[preencher: nº] ao R.[preencher: nº], em [preencher: data]. REMISSÃO: a hipoteca (ou alienação fiduciária) constituída por este título foi registrada sob o R.[preencher: nº] da matrícula nº [preencher].",
          "",
          "Na matrícula:",
          "AV.[preencher: nº]/[preencher: matrícula], em [preencher: data]. REMISSÃO: o título que deu origem ao R.[preencher: nº] desta matrícula foi registrado sob o nº [preencher] no Livro nº 3, Registro Auxiliar, desta serventia.",
          "",
          `FUNDAMENTO: ${act.basis}`,
        ]),
      };
    case "aditivo":
      return {
        id: act.id,
        title: act.title,
        group: "averbacao",
        text: join([
          `AV.[preencher: nº] ao [preencher: registro ou matrícula], em [preencher: data].`,
          `ADITIVO: nos termos do ${fill(a?.title ?? "", "aditivo")}, de ${fill(a?.date ?? "", "data do aditivo")}, à ${titleLine(data)}, ${
            a ? addendumChanges(a).join("; ") : "[preencher: o que mudou]"
          }. Permanecem inalteradas as demais condições.`,
          // Said in the act itself (decision of 21/11/2026): a change of
          // value is an averbação com valor declarado.
          act.charge === "sem-conteudo"
            ? "ATO SEM VALOR DECLARADO."
            : `VALOR DECLARADO: ${declaredValue(a, act.charge)}.`,
          `PROTOCOLO: nº ${fill(data.protocolNumber, "número do protocolo")}, de ${fill(data.protocolDate, "data do protocolo")}.`,
          `FUNDAMENTO: ${act.basis}`,
          "",
          `${place.city}/${place.state}, [preencher: data].`,
          "O(A) Oficial(a): ______________________________",
          "Emolumentos: [preencher]. Selo: [preencher].",
        ]),
      };
    case "aditivo-garantia-nova":
      return {
        id: act.id,
        title: act.title,
        group: "registro",
        text: join([
          "R.[preencher: nº]/[preencher: matrícula, ou nº do Livro nº 3 se penhor], em [preencher: data].",
          `TÍTULO: garantia vinculada à ${titleLine(data)} pelo ${fill(a?.title ?? "", "aditivo")}, de ${fill(a?.date ?? "", "data do aditivo")}.`,
          ...partyLines(data, "DEVEDOR"),
          `VALOR: ${fill(a?.newAmount || data.amount, "valor garantido")}.`,
          `BENS: ${fill(a?.guaranteeChange ?? "", "bens vinculados")}.`,
          ...closing(data, place, act.basis),
        ]),
      };
  }
}

/** Acts that come later and are always offered, filled with the data. */
export function laterModels(data: CedulaData, place: OfficePlace): Model[] {
  const ref = titleLine(data);
  const sign = [
    "",
    `${place.city}/${place.state}, [preencher: data].`,
    "O(A) Oficial(a): ______________________________",
  ];
  const real = data.guarantees.filter((g) => g.kind !== "pessoal");
  const guarantees =
    real
      .map((g) => GUARANTEE_LABELS[g.kind].toLocaleLowerCase("pt-BR"))
      .join(", ") || "[preencher: garantia]";
  const family = KIND_INFO[data.kind].family;
  return [
    {
      id: "certidao",
      title: "Certidão dos atos praticados",
      group: "certidao",
      text: join([
        "CERTIDÃO",
        "",
        `CERTIFICO, a requerimento de [preencher: requerente], que, revendo os livros desta serventia, deles consta: ${
          planActs(data)
            .acts.filter((a) => !a.elsewhere && a.nature !== "fora")
            .map(
              (a) =>
                `${a.title.toLocaleLowerCase("pt-BR")}, sob o nº [preencher]`,
            )
            .join("; ") || "[preencher: atos registrados]"
        }, relativos à ${ref}, tendo como credor ${people(data, "credor") || "[preencher: credor]"}. O referido é verdade e dou fé.`,
        ...sign,
      ]),
    },
    {
      id: "endosso",
      title: "Averbação de endosso ou cessão do crédito",
      group: "posterior",
      text: join([
        "AV.[preencher: nº] ao [preencher: registro], em [preencher: data].",
        `ENDOSSO: a ${ref} foi endossada (ou cedida) a [preencher: novo credor], conforme [preencher: endosso lançado no título ou instrumento de cessão].`,
        `FUNDAMENTO: ${family === "industrial" ? "Decreto-Lei nº 413/1969, art. 36." : "Lei nº 6.015/1973, art. 246."}`,
        ...sign,
      ]),
    },
    {
      id: "liberacao-parcial",
      title: "Averbação de liberação parcial de garantia",
      group: "posterior",
      text: join([
        "AV.[preencher: nº] ao [preencher: registro], em [preencher: data].",
        `LIBERAÇÃO PARCIAL: por autorização do credor, de [preencher: data], com firma reconhecida, fica liberado da ${guarantees} constituída na ${ref} o seguinte bem: [preencher: bem liberado], permanecendo os demais.`,
        "FUNDAMENTO: Lei nº 6.015/1973, arts. 167, II, item 2, e 250; prazo de 5 dias (art. 188, § 1º, I).",
        ...sign,
      ]),
    },
    {
      id: "cancelamento",
      title: "Averbação de cancelamento (quitação ou ordem judicial)",
      group: "posterior",
      text: join([
        "AV.[preencher: nº] ao [preencher: registro], em [preencher: data].",
        `CANCELAMENTO: fica cancelado o registro da ${guarantees} constituída na ${ref}, em virtude de [preencher: quitação dada pelo credor em instrumento público ou particular, ou ordem judicial de (juízo e processo)].`,
        `FUNDAMENTO: ${family === "industrial" ? "Decreto-Lei nº 413/1969, art. 39; " : ""}Lei nº 6.015/1973, arts. 167, II, item 2, 250 e 251; prazo de 5 dias (art. 188, § 1º, I).`,
        ...sign,
      ]),
    },
  ];
}

/** Every model the analysis offers, in the order of the plan. */
export function allModels(data: CedulaData, place: OfficePlace): Model[] {
  const plan = planActs(data);
  const own = plan.acts.flatMap((act) => {
    const model = modelFor(data, act, place);
    return model ? [model] : [];
  });
  return [...own, ...laterModels(data, place)];
}
