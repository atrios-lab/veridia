import type {
  RequerimentoDocument,
  RequerimentoSection,
} from "../request/requerimento.ts";
import { custasNoteFor } from "../ri/closing-notes.ts";
import { writtenDate } from "../scheduling/attendance.ts";
import { officialName } from "../tenant/identification.ts";
import type { Tenant } from "../tenant/schema.ts";
import {
  addDays,
  EFICACIA_DAYS,
  estadoCivilText,
  filiacaoText,
  HABILITACAO_KIND_LABELS,
  type HabilitacaoKind,
  type HabilitacaoValues,
  kindOf,
  REGIME_LABELS,
  type Regime,
  SEPARACAO_MOTIVOS,
} from "./habilitacao.ts";

/**
 * The documents of the habilitação, written for this panel from the law
 * (decision of 14/11/2026: better than the old system's templates, never a
 * copy of them). Each one comes from the processo's fields; the case
 * (procurador, a rogo, conversão, religioso) changes a sentence, not the
 * template. The edital carries only what the Código Nacional de Normas
 * allows (art. 122).
 */

export const HABILITACAO_DOCUMENTS = [
  "requerimento",
  "testemunhas",
  "edital",
  "certidao-edital",
  "certificado",
] as const;
export type HabilitacaoDocument = (typeof HABILITACAO_DOCUMENTS)[number];

export const DOCUMENT_LABELS: Record<HabilitacaoDocument, string> = {
  requerimento: "Requerimento e declaração dos nubentes",
  testemunhas: "Declaração das testemunhas",
  edital: "Edital de proclamas",
  "certidao-edital": "Certidão de proclamas",
  certificado: "Certificado de habilitação",
};

export interface HabilitacaoForDocument {
  number: string;
  values: HabilitacaoValues;
  /** The day the document is dated (ISO). */
  today: string;
}

type DocumentTenant = Pick<
  Tenant,
  | "officialName"
  | "name"
  | "subtitle"
  | "location"
  | "legalFooter"
  | "holderName"
  | "holderTitle"
>;

/** What stops a document from coming out, said in Portuguese, or null. */
export function documentBlocker(
  doc: HabilitacaoDocument,
  values: HabilitacaoValues,
): string | null {
  const kind = kindOf(values);
  if (doc === "certidao-edital" && !values.editalEm) {
    return "Publique o edital antes: a certidão diz quando ele foi publicado.";
  }
  if (doc === "certificado") {
    if (kind === "conversao") {
      return "Na conversão de união estável não há certificado: estando em termos o pedido, lavra-se o assento no Livro B (Lei nº 6.015/1973, art. 70-A, §§ 3º e 4º).";
    }
    if (!values.editalEm) {
      return "O certificado só sai depois da publicação do edital (Lei nº 6.015/1973, art. 67, § 1º).";
    }
    if (!values.certificadoEm) {
      return "Informe a data em que o certificado é extraído (ou use Extrair certificado hoje).";
    }
  }
  return null;
}

const v = (values: HabilitacaoValues, key: string) =>
  (values[key] ?? "").trim();

/** Typed text joined into a sentence: its own last period goes. */
const bare = (text: string) =>
  text.replace(/\n+/g, "; ").replace(/[\s.;,]+$/, "");

const dated = (iso: string) => (iso ? writtenDate(iso) : "");

function nome(values: HabilitacaoValues, n: 1 | 2): string {
  return v(values, `n${n}.nome`).toLocaleUpperCase("pt-BR");
}

function agree(
  values: HabilitacaoValues,
  n: 1 | 2,
  male: string,
  female: string,
): string {
  const sexo = v(values, `n${n}.sexo`);
  if (sexo === "M") return male;
  if (sexo === "F") return female;
  return `${male}(${female.slice(-1)})`;
}

/** The nubente as the requerimento qualifies them, in one sentence. */
export function qualificacao(values: HabilitacaoValues, n: 1 | 2): string {
  const get = (k: string) => v(values, `n${n}.${k}`);
  const parts = [
    nome(values, n),
    get("nacionalidade").toLocaleLowerCase("pt-BR"),
    estadoCivilText(get("estadoCivil"), get("sexo")),
    get("profissao").toLocaleLowerCase("pt-BR"),
    get("nascimento") &&
      `${agree(values, n, "nascido", "nascida")} em ${dated(get("nascimento"))}`,
    get("naturalidade") && `natural de ${get("naturalidade")}`,
    get("documento") && `documento de identidade ${get("documento")}`,
    get("cpf") && `CPF ${get("cpf")}`,
    get("endereco") && `residente em ${get("endereco")}`,
    get("domicilio") &&
      `${agree(values, n, "domiciliado", "domiciliada")} em ${get("domicilio")}`,
    filiacaoText(values, n),
  ].filter(Boolean);
  return `${parts.join(", ")}.`;
}

function regimeSentence(values: HabilitacaoValues): string {
  const regime = v(values, "regime") as Regime;
  const label = REGIME_LABELS[regime] ?? REGIME_LABELS["comunhao-parcial"];
  if (regime === "separacao-obrigatoria") {
    const why =
      SEPARACAO_MOTIVOS[
        v(values, "motivoSeparacao") as keyof typeof SEPARACAO_MOTIVOS
      ];
    return `o regime da ${label}, por imposição legal${why ? `: ${why}` : ""}`;
  }
  const pacto = v(values, "pacto");
  if (pacto && regime !== "comunhao-parcial") {
    return `o regime da ${label}, conforme pacto antenupcial: ${bare(pacto)}`;
  }
  return `o regime da ${label}`;
}

function namesAfter(values: HabilitacaoValues): string {
  return ([1, 2] as const)
    .map((n) => {
      const after = v(values, `n${n}.nomeApos`);
      return after && after !== v(values, `n${n}.nome`)
        ? `${nome(values, n)} passará a usar o nome ${after.toLocaleUpperCase("pt-BR")}`
        : `${nome(values, n)} continuará a usar o mesmo nome`;
    })
    .join("; ");
}

function base(
  tenant: DocumentTenant,
  h: HabilitacaoForDocument,
  title: string,
  sections: RequerimentoSection[],
): RequerimentoDocument {
  const kind = kindOf(h.values);
  return {
    eyebrow: "Registro Civil das Pessoas Naturais",
    title,
    subtitle: `Processo nº ${h.number} · ${HABILITACAO_KIND_LABELS[kind]}`,
    office: [officialName(tenant), tenant.subtitle],
    sections,
    dateLine: `${tenant.location.city}/${tenant.location.state}, ${writtenDate(h.today)}.`,
    signature: [],
    footer: `${officialName(tenant)} · ${tenant.legalFooter}`,
    closingNotes: custasNoteFor(tenant.location.state)
      ? [{ text: custasNoteFor(tenant.location.state) as string }]
      : undefined,
  };
}

/** The office's signature: the holder, when the office named one. */
function officeSignee(
  tenant: DocumentTenant,
): Pick<RequerimentoDocument, "signee" | "signature"> {
  return {
    signee: tenant.holderName ?? officialName(tenant),
    signature: [tenant.holderTitle ?? "Oficial de Registro Civil"],
  };
}

function partySignatures(values: HabilitacaoValues) {
  return ([1, 2] as const).flatMap((n) => {
    const name = v(values, `n${n}.nome`) || `${n}º nubente`;
    const procurador = v(values, `n${n}.procurador`)
      .split("\n")[0]
      ?.split(",")[0]
      ?.trim();
    if (procurador) {
      return [{ name: procurador, role: `procurador(a) de ${name}` }];
    }
    if (v(values, `n${n}.assina`) === "sim") {
      return [
        {
          name: v(values, `n${n}.rogo`),
          role: `a rogo de ${name}, que não sabe ou não pode assinar`,
        },
        { name, role: "impressão digital", fingerprint: true },
      ];
    }
    return [{ name, role: `${n}º nubente` }];
  });
}

const PEDIDO: Record<HabilitacaoKind, string> = {
  civil:
    "Os requerentes acima qualificados vêm requerer a sua habilitação para o casamento civil e a expedição do certificado de habilitação, nos termos do art. 1.525 do Código Civil e do art. 67 da Lei nº 6.015/1973.",
  religioso:
    "Os requerentes acima qualificados vêm requerer a sua habilitação para o casamento religioso com efeito civil e a expedição da certidão de habilitação, a ser apresentada à autoridade ou ao ministro religioso que presidirá o ato, nos termos do art. 1.516 do Código Civil e dos arts. 67 e 71 da Lei nº 6.015/1973.",
  conversao:
    "Os requerentes acima qualificados, que vivem em união estável, vêm requerer a conversão dessa união em casamento, pelo mesmo rito da habilitação, nos termos do art. 1.726 do Código Civil, do art. 70-A da Lei nº 6.015/1973 e dos arts. 549 a 552 do Código Nacional de Normas.",
};

export function requerimentoDocument(
  tenant: DocumentTenant,
  h: HabilitacaoForDocument,
): RequerimentoDocument {
  const { values } = h;
  const kind = kindOf(values);
  const representation = ([1, 2] as const).flatMap((n) => {
    const name = v(values, `n${n}.nome`);
    const procurador = v(values, `n${n}.procurador`);
    const rogo = v(values, `n${n}.rogo`);
    const lines: string[] = [];
    if (procurador) {
      lines.push(
        `${name} é representado(a) por procurador(a): ${bare(procurador)}.`,
      );
    } else if (v(values, `n${n}.assina`) === "sim") {
      lines.push(
        `${name} declara não saber ou não poder assinar; assina a seu rogo ${rogo}, e apõe a impressão digital.`,
      );
    }
    const autorizacao = v(values, `n${n}.autorizacao`);
    if (autorizacao) {
      lines.push(
        `Autorização para o casamento de ${name}: ${bare(autorizacao)}.`,
      );
    }
    const dissolucao = v(values, `n${n}.dissolucao`);
    if (dissolucao) {
      lines.push(`Casamento anterior de ${name}: ${bare(dissolucao)}.`);
    }
    return lines;
  });
  const pais = ([1, 2] as const)
    .map(
      (n) =>
        v(values, `n${n}.pais`) &&
        `dos pais de ${v(values, `n${n}.nome`)}: ${bare(v(values, `n${n}.pais`))}`,
    )
    .filter(Boolean);
  const documentos = v(values, "documentos")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const title =
    kind === "conversao"
      ? "Requerimento de conversão de união estável em casamento"
      : "Requerimento de habilitação para o casamento";
  return {
    ...base(tenant, h, title, [
      {
        heading: "Dos requerentes",
        paragraphs: [
          `1º nubente: ${qualificacao(values, 1)}`,
          `2º nubente: ${qualificacao(values, 2)}`,
        ],
      },
      { heading: "Do pedido", paragraphs: [PEDIDO[kind]] },
      {
        heading: "Das declarações",
        paragraphs: [
          "Os requerentes declaram, sob as penas da lei:",
          `I. que o estado civil, o domicílio e a residência de cada um são os indicados acima${pais.length ? `; e o estado civil, o domicílio e a residência ${pais.join("; ")}` : ""} (Código Civil, art. 1.525, IV);`,
          "II. que não há entre eles impedimento para o casamento (Código Civil, art. 1.521) nem causa suspensiva (art. 1.523), ou que a declararam ao oficial;",
          `III. que adotam ${regimeSentence(values)};`,
          `IV. que, depois do casamento, ${namesAfter(values)} (Código Civil, art. 1.565, § 1º);`,
          "V. que foram esclarecidos pelo oficial sobre os fatos que podem invalidar o casamento e sobre os regimes de bens (Código Civil, art. 1.528), e que lhes foi oferecido o material informativo de preparação para o casamento (Código Nacional de Normas, arts. 531 e 532).",
        ],
      },
      ...(representation.length
        ? [
            {
              heading: "Representação, autorização e casamento anterior",
              paragraphs: representation,
            },
          ]
        : []),
      ...(documentos.length
        ? [
            {
              heading: "Documentos apresentados",
              paragraphs: documentos.map((d) => `• ${d}`),
            },
          ]
        : []),
    ]),
    dateLine: `${tenant.location.city}/${tenant.location.state}, ${writtenDate(v(values, "requeridoEm") || h.today)}.`,
    signatures: partySignatures(values),
  };
}

export function testemunhasDocument(
  tenant: DocumentTenant,
  h: HabilitacaoForDocument,
): RequerimentoDocument {
  const { values } = h;
  const witness = (n: 1 | 2) => {
    const get = (k: string) => v(values, `t${n}.${k}`);
    return [
      get("nome").toLocaleUpperCase("pt-BR"),
      get("nacionalidade").toLocaleLowerCase("pt-BR"),
      get("estadoCivil").toLocaleLowerCase("pt-BR"),
      get("profissao").toLocaleLowerCase("pt-BR"),
      get("documento") && `documento ${get("documento")}`,
      get("endereco") && `residente em ${get("endereco")}`,
    ]
      .filter(Boolean)
      .join(", ");
  };
  const purpose =
    kindOf(values) === "conversao"
      ? "que requereram a conversão de sua união estável em casamento"
      : "pretendentes ao casamento";
  return {
    ...base(tenant, h, "Declaração de testemunhas", [
      {
        heading: "Declaração",
        paragraphs: [
          `Nós, ${witness(1)}; e ${witness(2)}; maiores e capazes, declaramos, sob as penas da lei, que conhecemos ${nome(values, 1)} e ${nome(values, 2)}, ${purpose}, e afirmamos não existir impedimento que os iniba de casar (Código Civil, arts. 1.521 e 1.525, III).`,
          "Declaramos também estar cientes de que a declaração falsa sujeita quem a faz às sanções da lei penal.",
        ],
      },
    ]),
    dateLine: `${tenant.location.city}/${tenant.location.state}, ${writtenDate(v(values, "requeridoEm") || h.today)}.`,
    signatures: [
      { name: v(values, "t1.nome") || "1ª testemunha", role: "1ª testemunha" },
      { name: v(values, "t2.nome") || "2ª testemunha", role: "2ª testemunha" },
    ],
  };
}

/**
 * Each nubente as the edital may show them: name, estado civil, filiação,
 * city and circunscrição of the domicile, and nothing else (Código
 * Nacional de Normas, art. 122).
 */
function editalLine(values: HabilitacaoValues, n: 1 | 2): string {
  const get = (k: string) => v(values, `n${n}.${k}`);
  return [
    nome(values, n),
    estadoCivilText(get("estadoCivil"), get("sexo")),
    filiacaoText(values, n),
    get("domicilio") &&
      `${agree(values, n, "domiciliado", "domiciliada")} em ${get("domicilio")}`,
  ]
    .filter(Boolean)
    .join(", ");
}

/** The edital's text, the same on paper and on the site. */
export function editalParagraphs(
  tenant: DocumentTenant,
  h: Pick<HabilitacaoForDocument, "values" | "number">,
): string[] {
  const { values } = h;
  const conversion = kindOf(values) === "conversao";
  return [
    `${tenant.holderName ? `${tenant.holderName}, ${(tenant.holderTitle ?? "oficial").toLocaleLowerCase("pt-BR")} do ` : "O "}${officialName(tenant)}, na forma da lei, faz saber que ${
      conversion
        ? "requereram a conversão de sua união estável em casamento (Lei nº 6.015/1973, art. 70-A, § 1º)"
        : "pretendem casar-se"
    }:`,
    `${editalLine(values, 1)};`,
    `e ${editalLine(values, 2)}.`,
    "Quem souber de impedimento (Código Civil, art. 1.521) ou de causa suspensiva (art. 1.523) deverá opô-lo por escrito, em declaração assinada, instruída com as provas do fato alegado ou com a indicação do lugar onde possam ser obtidas (Código Civil, art. 1.529).",
    `Processo de habilitação nº ${h.number}. Edital publicado em meio eletrônico (Lei nº 6.015/1973, art. 67, § 1º).`,
  ];
}

export function editalDocument(
  tenant: DocumentTenant,
  h: HabilitacaoForDocument,
): RequerimentoDocument {
  return {
    ...base(tenant, h, "Edital de proclamas", [
      { heading: "Proclamas", paragraphs: editalParagraphs(tenant, h) },
    ]),
    dateLine: `${tenant.location.city}/${tenant.location.state}, ${writtenDate(v(h.values, "editalEm") || h.today)}.`,
    ...officeSignee(tenant),
  };
}

/** The edital for the site: a title and the text, one paragraph per line. */
export function editalForSite(
  tenant: DocumentTenant,
  h: Pick<HabilitacaoForDocument, "values" | "number">,
): { title: string; body: string } {
  return {
    title: `Edital de proclamas nº ${h.number}: ${v(h.values, "n1.nome")} e ${v(h.values, "n2.nome")}`,
    body: editalParagraphs(tenant, h).join("\n\n"),
  };
}

export function certidaoEditalDocument(
  tenant: DocumentTenant,
  h: HabilitacaoForDocument,
): RequerimentoDocument {
  const { values } = h;
  return {
    ...base(tenant, h, "Certidão de proclamas", [
      {
        heading: "Certidão",
        paragraphs: [
          `Certifico que o edital de proclamas do processo de habilitação nº ${h.number}, de ${nome(values, 1)} e ${nome(values, 2)}, foi publicado em meio eletrônico em ${dated(v(values, "editalEm"))} (Lei nº 6.015/1973, art. 67, § 1º), e que, até a presente data, não foi oposto impedimento nem causa suspensiva (Código Civil, arts. 1.529 e 1.530).`,
          "O referido é verdade e dou fé.",
        ],
      },
    ]),
    ...officeSignee(tenant),
  };
}

export function certificadoDocument(
  tenant: DocumentTenant,
  h: HabilitacaoForDocument,
): RequerimentoDocument {
  const { values } = h;
  const kind = kindOf(values);
  const issued = v(values, "certificadoEm") || h.today;
  const validUntil = addDays(issued, EFICACIA_DAYS);
  const where =
    kind === "religioso"
      ? "Esta certidão destina-se à celebração do casamento perante a autoridade ou o ministro religioso, que a arquivará e nela anotará a data da celebração (Lei nº 6.015/1973, arts. 71 e 73, § 3º). O registro civil do casamento religioso deve ser promovido dentro de 90 (noventa) dias da celebração; depois disso, dependerá de nova habilitação (Código Civil, art. 1.516, § 1º)."
      : "O casamento poderá ser celebrado perante qualquer serventia de registro civil das pessoas naturais, à escolha dos nubentes (Lei nº 6.015/1973, art. 67, § 1º).";
  const celebracao =
    kind === "civil" && v(values, "celebracaoData")
      ? `Celebração designada para ${dated(v(values, "celebracaoData"))}${v(values, "celebracaoHora") ? `, às ${v(values, "celebracaoHora")}` : ""}${v(values, "celebracaoLocal") ? `, em ${v(values, "celebracaoLocal")}` : ""} (Lei nº 6.015/1973, art. 67, § 7º).`
      : "";
  const title =
    kind === "religioso"
      ? "Certidão de habilitação para casamento religioso com efeito civil"
      : "Certificado de habilitação para o casamento";
  return {
    ...base(tenant, h, title, [
      {
        heading: "Certificado",
        paragraphs: [
          `Certifico que ${qualificacao(values, 1).replace(/\.$/, "")}; e ${qualificacao(values, 2).replace(/\.$/, "")}; requereram a habilitação para o casamento no processo nº ${h.number}, e que, apresentados os documentos exigidos pela lei civil, publicado o edital de proclamas em meio eletrônico em ${dated(v(values, "editalEm"))} e não havendo fato obstativo, estão HABILITADOS para o casamento (Código Civil, art. 1.531; Lei nº 6.015/1973, art. 67, § 1º).`,
          `Regime de bens declarado: ${regimeSentence(values)}.`,
          `Nomes depois do casamento: ${namesAfter(values)}.`,
          `Esta habilitação tem eficácia de 90 (noventa) dias, a contar de ${dated(issued)}, até ${dated(validUntil)} (Código Civil, art. 1.532).`,
          where,
          ...(celebracao ? [celebracao] : []),
          "O referido é verdade e dou fé.",
        ],
      },
    ]),
    dateLine: `${tenant.location.city}/${tenant.location.state}, ${writtenDate(issued)}.`,
    ...officeSignee(tenant),
  };
}

export function buildHabilitacaoDocument(
  doc: HabilitacaoDocument,
  tenant: DocumentTenant,
  h: HabilitacaoForDocument,
): RequerimentoDocument {
  switch (doc) {
    case "requerimento":
      return requerimentoDocument(tenant, h);
    case "testemunhas":
      return testemunhasDocument(tenant, h);
    case "edital":
      return editalDocument(tenant, h);
    case "certidao-edital":
      return certidaoEditalDocument(tenant, h);
    case "certificado":
      return certificadoDocument(tenant, h);
  }
}
