import type { RequerimentoDocument } from "../request/requerimento.ts";
import { officialName } from "../tenant/identification.ts";
import type { Tenant } from "../tenant/schema.ts";
import {
  actNames,
  actProblems,
  actTitle,
  actWhere,
  CENTRALS,
  type CensecAct,
  type Central,
  quinzenaLabel,
} from "./censec.ts";

/**
 * The quinzena's report (decision of 14/11/2026: "ao final gerar o
 * relatório de quantos eram e quantos foram"): how many acts were
 * launched in each central, how many are ready for the file and how many
 * still have pendência, and the fechamento of each. For checking and
 * keeping; it is not a document the office signs.
 */

export interface ReportClosing {
  central: Central;
  sentOn: string;
  acts: number;
  protocol: string;
}

const br = (iso: string) =>
  iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "";

export function buildCensecReport(
  tenant: Tenant,
  quinzena: string,
  acts: CensecAct[],
  closings: ReportClosing[],
  issuedOn: string,
): RequerimentoDocument {
  const centrals = Object.keys(CENTRALS) as Central[];
  const ready = acts.filter((a) => actProblems(a).length === 0).length;
  return {
    eyebrow: "Cargas da CENSEC",
    title: "Relatório da quinzena",
    subtitle: `${quinzenaLabel(quinzena)} · ${acts.length} ${acts.length === 1 ? "ato" : "atos"}`,
    office: [officialName(tenant), tenant.subtitle],
    sections: [
      {
        heading: "Resumo",
        rows: [
          { label: "Atos lançados", value: String(acts.length) },
          { label: "Prontos para o arquivo", value: String(ready) },
          { label: "Com pendência", value: String(acts.length - ready) },
        ],
      },
      {
        heading: "Por central",
        table: {
          columns: [
            { label: "Central", weight: 1 },
            { label: "Lançados", weight: 0.7 },
            { label: "Prontos", weight: 0.7 },
            { label: "Fechamento", weight: 2 },
          ],
          rows: centrals.map((c) => {
            const mine = acts.filter((a) => a.central === c);
            const closing = closings.find((x) => x.central === c);
            return [
              CENTRALS[c].short,
              String(mine.length),
              String(mine.filter((a) => actProblems(a).length === 0).length),
              closing
                ? `${br(closing.sentOn)}${closing.acts === 0 ? ", negativo" : `, ${closing.acts} ato(s)`}${closing.protocol ? `, ${closing.protocol}` : ""}`
                : "Não registrado",
            ];
          }),
        },
      },
      ...centrals
        .filter((c) => acts.some((a) => a.central === c))
        .map((c) => ({
          heading: `${CENTRALS[c].short}: ${CENTRALS[c].label}`,
          table: {
            columns: [
              { label: "Nº", weight: 0.4 },
              { label: "Data", weight: 0.9 },
              { label: "Ato", weight: 1.8 },
              { label: "Livro e folha", weight: 1.2 },
              { label: "Partes", weight: 2.2 },
              { label: "Situação", weight: 1 },
            ],
            rows: acts
              .filter((a) => a.central === c)
              .map((a, i) => [
                String(i + 1),
                br(a.date),
                actTitle(a),
                actWhere(a),
                actNames(a),
                actProblems(a).length === 0 ? "Pronto" : "Pendente",
              ]),
          },
        })),
      {
        heading: "Fundamento",
        paragraphs: [
          "Código Nacional de Normas da Corregedoria Nacional de Justiça (Provimento CNJ nº 149/2023), arts. 265 a 272: as informações do RCTO, do CESDI e do CEP são remetidas quinzenalmente ao Colégio Notarial do Brasil, Conselho Federal, por meio da CENSEC, até o dia 20 quanto à primeira quinzena do mês e até o dia 5 do mês seguinte quanto à segunda, ou no dia útil subsequente; não havendo ato, presta-se a informação negativa.",
        ],
      },
    ],
    dateLine: `${tenant.location.city}/${tenant.location.state}, ${br(issuedOn)}.`,
    signature: [],
    footer: `${officialName(tenant)} · ${tenant.legalFooter}`,
  };
}
