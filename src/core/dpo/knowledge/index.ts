import { ANPD } from "./anpd.ts";
import { CGJ_RN } from "./cgj-rn.ts";
import { CNN } from "./cnn.ts";
import { LGPD } from "./lgpd.ts";
import { ORIENTACAO } from "./orientacao.ts";
import { PROV213 } from "./prov213.ts";
import type {
  KnowledgeProvision,
  KnowledgeSource,
  KnowledgeSourceId,
} from "./types.ts";

export type { KnowledgeProvision, KnowledgeSource, KnowledgeSourceId };

/**
 * When the base was last reviewed against its sources. The screen shows it
 * ("Base de normas atualizada em ..."); bump it with every change here.
 */
export const KNOWLEDGE_BASE_UPDATED_AT = "2026-11-15";

export const SOURCES: Record<KnowledgeSourceId, KnowledgeSource> = {
  lgpd: {
    id: "lgpd",
    name: "Lei nº 13.709/2018 (LGPD)",
    url: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm",
    kind: "norm",
  },
  prov213: {
    id: "prov213",
    name: "Provimento CNJ nº 213/2026, com as alterações dos Provimentos 214/2026 e 243/2026",
    url: "https://atos.cnj.jus.br/",
    kind: "norm",
  },
  cnn: {
    id: "cnn",
    name: "Código Nacional de Normas do Foro Extrajudicial (Provimento CNJ nº 149/2023)",
    url: "https://atos.cnj.jus.br/",
    kind: "norm",
  },
  anpd: {
    id: "anpd",
    name: "Resoluções do Conselho Diretor da ANPD",
    url: "https://www.gov.br/anpd/",
    kind: "norm",
  },
  "cgj-rn": {
    id: "cgj-rn",
    name: "Corregedoria Geral de Justiça do RN",
    url: "https://corregedoria.tjrn.jus.br/",
    kind: "norm",
  },
  orientacao: {
    id: "orientacao",
    name: "Orientação da plataforma",
    url: "",
    kind: "guidance",
  },
};

export const KNOWLEDGE_BASE: readonly KnowledgeProvision[] = [
  ...LGPD,
  ...PROV213,
  ...CNN,
  ...ANPD,
  ...CGJ_RN,
  ...ORIENTACAO,
];

const BY_ID = new Map(KNOWLEDGE_BASE.map((p) => [p.id, p]));

export function provisionById(id: string): KnowledgeProvision | undefined {
  return BY_ID.get(id);
}
