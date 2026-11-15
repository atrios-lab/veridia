import type {
  RequerimentoDocument,
  RequerimentoSection,
} from "../request/requerimento.ts";
import { writtenDate } from "../scheduling/attendance.ts";
import { officialName } from "../tenant/identification.ts";
import type { Tenant } from "../tenant/schema.ts";
import {
  ATTRIBUTIONS,
  actName,
  byReference,
  pendingOf,
  type QualificationData,
  type Requirement,
  reexamView,
} from "./qualificacao.ts";

/**
 * The nota devolutiva and the termo de qualificação positiva, written for
 * this panel from Lei nº 6.015/1973, art. 198 (the exigências all at
 * once, articulated, clear, with the date, the identification and the
 * signature of who qualified, and the right to the dúvida). The structure
 * follows the office's own models (decision of 15/11/2026), with its
 * wording rewritten: no client's data, no copy.
 */

export interface NoteInput {
  /** "12/2026". */
  number: string;
  data: QualificationData;
  /** Which round the note answers (0 is the first qualificação). */
  roundIndex: number;
  /** ISO day the note is dated. */
  issuedOn: string;
  /** Who qualified and signs (the oficial or the preposto). */
  signer?: { name: string; role: string };
}

const isoDate = (iso: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
    : "";

function presentationRows(data: QualificationData) {
  return [
    { label: "Apresentante", value: data.presenter.name },
    ...(data.presenter.document
      ? [{ label: "Documento do apresentante", value: data.presenter.document }]
      : []),
    { label: "Título apresentado", value: data.document },
    { label: "Ato pedido", value: actName(data) },
    { label: "Atribuição", value: ATTRIBUTIONS[data.attribution] },
    ...(data.protocol ? [{ label: "Protocolo", value: data.protocol }] : []),
    { label: "Apresentado em", value: isoDate(data.receivedOn) },
  ];
}

/** "1. Título. Descrição. Fundamento: ...". */
function requirementParagraphs(list: Requirement[], start = 1): string[] {
  return list.map((r, i) =>
    [
      `${start + i}. ${r.title.trim()}.`,
      r.description.trim(),
      r.status === "parcial" && r.note.trim()
        ? `Cumprida em parte: ${r.note.replace(/^Sugestão do Assistente Virtual:\s*/, "").trim()}`
        : "",
      `Fundamento: ${r.basis.trim()}`,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

/** The exigências grouped by what they refer to, numbered straight through. */
function requirementSections(
  heading: string,
  list: Requirement[],
): RequerimentoSection[] {
  const sections: RequerimentoSection[] = [];
  let count = 1;
  for (const [reference, items] of byReference(list)) {
    sections.push({
      heading: reference ? `${heading}: ${reference}` : heading,
      paragraphs: requirementParagraphs(items, count),
    });
    count += items.length;
  }
  return sections;
}

function signerLines(
  tenant: Pick<Tenant, "holderName" | "holderTitle" | "officialName" | "name">,
  signer?: NoteInput["signer"],
) {
  return signer?.name
    ? { signee: signer.name, signature: [signer.role || "Preposto(a)"] }
    : {
        signee: tenant.holderName ?? officialName(tenant),
        signature: [tenant.holderTitle ?? "Oficial(a) e Tabelião(ã)"],
      };
}

/**
 * The right to the dúvida, as the law gives it to each attribution: the
 * registros by the Lei nº 6.015/1973 (art. 198, II, and art. 296 for the
 * registros other than the imóveis, as the Código Nacional de Normas
 * itself applies it); notas and protesto, before the competent juízo.
 */
function doubtLine(attribution: QualificationData["attribution"]): string {
  const ask =
    "Não se conformando com as exigências, ou não sendo possível cumpri-las, o interessado pode requerer que o título e a declaração de dúvida sejam remetidos ao juízo competente para dirimi-la";
  if (attribution === "ri") return `${ask} (Lei nº 6.015/1973, art. 198, II).`;
  if (
    attribution === "rcpn" ||
    attribution === "rtd" ||
    attribution === "rcpj"
  ) {
    return `${ask} (Lei nº 6.015/1973, art. 198, II, e art. 296).`;
  }
  return "Não se conformando com as exigências, ou não sendo possível cumpri-las, o interessado pode levar a questão ao juízo competente.";
}

/** The nota devolutiva: the first qualificação or a reexame. */
export function buildNote(
  tenant: Tenant,
  input: NoteInput,
): RequerimentoDocument {
  const { data } = input;
  const round = data.rounds[input.roundIndex];
  if (!round) throw new Error("Rodada da qualificação inexistente.");
  const pending = pendingOf(round);
  const reexam = round.n > 1;
  const view = reexam ? reexamView(data, input.roundIndex) : null;
  const providencias = pending.map(
    (r, i) =>
      `${i + 1}. ${r.howToComply.trim()}${r.status === "parcial" ? " (cumprida em parte)" : ""}`,
  );

  const sections: RequerimentoSection[] = [
    { heading: "Apresentação", rows: presentationRows(data) },
    {
      heading: "Objeto",
      paragraphs: [
        data.object.trim() ||
          `Qualificação do título apresentado para ${actName(data).toLowerCase()}.`,
      ],
    },
  ];

  if (view) {
    sections.push({
      heading: "Reexame após reapresentação",
      paragraphs: [
        `O título foi reapresentado em ${isoDate(round.date)}${round.newDocuments ? `, com: ${round.newDocuments}` : ""}. Reexaminado, resultou o seguinte.`,
      ],
    });
    if (view.met.length) {
      sections.push({
        heading: "Exigências atendidas",
        paragraphs: view.met.map((r, i) => `${i + 1}. ${r.title.trim()}.`),
      });
    }
    sections.push(
      ...requirementSections("Exigências que permanecem", view.remaining),
    );
    if (view.added.length) {
      sections.push(...requirementSections("Exigências novas", view.added));
    }
  } else {
    sections.push({
      heading: "Natureza da devolução",
      paragraphs: [
        "Examinado o título, verificou-se que o ato pedido não pode ser praticado sem o cumprimento das exigências abaixo, formuladas de uma só vez, por escrito e com o respectivo fundamento.",
      ],
    });
  }

  if (data.fundamentals.length) {
    sections.push({
      heading: "Fundamentos",
      paragraphs: data.fundamentals.map((f) => f.trim()).filter(Boolean),
    });
  }
  if (!view) sections.push(...requirementSections("Exigências", pending));

  sections.push(
    {
      heading: "Forma de cumprimento",
      paragraphs: [
        "Para cumprir as exigências, o apresentante deve providenciar:",
        ...providencias,
        "Os documentos devem ser reapresentados à serventia junto com esta nota, para reexame.",
      ],
    },
    {
      heading: "Conclusão",
      paragraphs: [
        "Pelo exposto, o título é devolvido sem a prática do ato pedido, até o cumprimento das exigências acima.",
      ],
      highlight: doubtLine(data.attribution),
    },
  );
  if (data.observations.trim()) {
    sections.push({
      heading: "Observações",
      paragraphs: data.observations
        .split(/\n+/)
        .map((p) => p.trim())
        .filter(Boolean),
    });
  }

  return {
    eyebrow: ATTRIBUTIONS[data.attribution],
    title: `Nota devolutiva nº ${input.number}`,
    subtitle: reexam
      ? `Reexame (${round.n}ª qualificação) · ${actName(data)}`
      : `Qualificação do título · ${actName(data)}`,
    office: [officialName(tenant), tenant.subtitle],
    sections,
    dateLine: `${tenant.location.city}/${tenant.location.state}, ${writtenDate(input.issuedOn)}.`,
    ...signerLines(tenant, input.signer),
    footer: footerOf(tenant, `Nota devolutiva nº ${input.number}`, data),
  };
}

/** The footer of every page, as the other documents of the panel. */
function footerOf(tenant: Tenant, label: string, data: QualificationData) {
  const protocol = data.protocol.trim();
  return `${officialName(tenant)} · ${label}${protocol ? ` · Protocolo ${protocol}` : ""} · ${tenant.legalFooter}`;
}

/** The termo de qualificação positiva: the título is fit for the act. */
export function buildPositive(
  tenant: Tenant,
  input: Omit<NoteInput, "roundIndex">,
): RequerimentoDocument {
  const { data } = input;
  const rounds = data.rounds.length;
  return {
    eyebrow: ATTRIBUTIONS[data.attribution],
    title: `Qualificação positiva nº ${input.number}`,
    subtitle: `Título apto · ${actName(data)}`,
    office: [officialName(tenant), tenant.subtitle],
    sections: [
      { heading: "Apresentação", rows: presentationRows(data) },
      {
        heading: "Qualificação",
        paragraphs: [
          rounds > 1
            ? `Reexaminado o título, após ${rounds - 1} ${rounds - 1 === 1 ? "nota devolutiva" : "notas devolutivas"} e o cumprimento das exigências formuladas, verificou-se que ele atende aos requisitos legais e normativos.`
            : "Examinado o título, verificou-se que ele atende aos requisitos legais e normativos, sem exigência a formular.",
        ],
        highlight: `O título está apto a ${actName(data).toLowerCase()}, que será praticado na forma da lei.`,
      },
      ...(data.observations.trim()
        ? [
            {
              heading: "Observações",
              paragraphs: data.observations
                .split(/\n+/)
                .map((p) => p.trim())
                .filter(Boolean),
            },
          ]
        : []),
    ],
    dateLine: `${tenant.location.city}/${tenant.location.state}, ${writtenDate(input.issuedOn)}.`,
    ...signerLines(tenant, input.signer),
    footer: footerOf(tenant, `Qualificação positiva nº ${input.number}`, data),
  };
}

/**
 * The nota devolutiva as the text of an exigência in the pedido (decision
 * of 15/11/2026: "a opção de enviar o texto direto na exigência, como já
 * escrevemos hoje"): what is missing, numbered, how to comply and on which
 * basis, and the right to the dúvida. The office can still edit it.
 */
export function requirementTextFromNote(input: {
  number: string;
  data: QualificationData;
  roundIndex: number;
}): string {
  const round = input.data.rounds[input.roundIndex];
  if (!round) return "";
  const items = pendingOf(round).map((r, i) => {
    const lines = [`${i + 1}. ${r.title.trim().replace(/\.$/, "")}.`];
    if (r.description.trim()) lines.push(r.description.trim());
    if (r.howToComply.trim())
      lines.push(`Como cumprir: ${r.howToComply.trim()}`);
    if (r.basis.trim()) lines.push(`Fundamento: ${r.basis.trim()}`);
    if (r.status === "parcial" && r.note.trim())
      lines.push(`Cumprida em parte: ${r.note.trim()}`);
    return lines.join("\n");
  });
  return [
    `Nota devolutiva nº ${input.number}`,
    "Para seguir com o pedido, é preciso atender às exigências abaixo.",
    ...items,
    "Caso não consiga cumprir alguma exigência, anexe aqui a justificativa da impossibilidade, para que seja analisada pela serventia.",
    "Não cumpridas as exigências, o documento poderá ser enviado para decisão de dúvida junto ao juízo competente.",
  ].join("\n\n");
}
