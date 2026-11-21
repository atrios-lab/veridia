import "server-only";
import type { CedulaData } from "@/core/cedulas/analise.ts";
import { allModels, type Model } from "@/core/cedulas/minutas.ts";
import type { RequerimentoDocument } from "@/core/request/requerimento.ts";
import { officialName } from "@/core/tenant/identification.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import type { AnalysisView } from "./cedulas.ts";

/** The models of an analysis, with the office's edits over the generated. */
export function modelsOf(
  tenant: Tenant,
  analysis: Pick<AnalysisView, "data" | "models">,
): (Model & { edited: boolean; generated: string })[] {
  return allModels(analysis.data as CedulaData, {
    city: tenant.location.city,
    state: tenant.location.state,
  }).map((model) => {
    const edited = analysis.models[model.id];
    return {
      ...model,
      generated: model.text,
      text: edited ?? model.text,
      edited: edited !== undefined,
    };
  });
}

/**
 * One model as a paper of the office (decision of 21/11/2026: "copiar,
 * imprimir ou baixar em Word"): the letterhead, the model's title and its
 * text, line by line. A minuta, to be checked and lavrada in the office's
 * own system.
 */
export function modelDocument(
  tenant: Tenant,
  model: Pick<Model, "title" | "text">,
): RequerimentoDocument {
  return {
    eyebrow: "Análise de cédula · minuta",
    title: model.title,
    subtitle:
      "Minuta para conferência: o ato é lavrado no sistema da serventia.",
    office: [officialName(tenant), tenant.subtitle].filter(Boolean),
    sections: [
      {
        heading: "Texto",
        paragraphs: model.text
          .split(/\n/)
          .map((line) => line.trimEnd())
          .filter((line, i, all) => line !== "" || all[i - 1] !== ""),
      },
    ],
    signature: [],
    footer: "",
  };
}
