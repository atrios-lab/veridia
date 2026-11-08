import type { IsoDate } from "../scheduling/calendar.ts";
import type { NoticeSector } from "../tenant/gating.ts";
import {
  currentRun,
  type NoticeRun,
  type NoticeRunRule,
  type NoticeSchedule,
  noticeSchedule,
} from "./notice-schedule.ts";
import {
  PUBLICATION_KIND_LABELS,
  type PublicationKind,
} from "./publication.ts";

/**
 * One kind of edital the law names, with the rule its dates follow. The
 * operator picks it in the form; the site and the panel compute every run
 * and the term from it and from the first publication date, which may be in
 * the past (an edital published on paper a month ago is entered with that
 * date, and the site picks it up in the run it is in today).
 */
export interface NoticeType extends NoticeRunRule {
  sector: NoticeSector;
  /** Short name, shown after "Edital" on the site: "Usucapião, terceiros". */
  label: string;
  /** Where the rule comes from, cited on the site and in the form. */
  legalBasis: string;
  /** What the term is for: "Prazo para impugnação". */
  termLabel: string;
  /** The rule in one sentence, for the operator choosing the type. */
  summary: string;
}

/*
 * How the days are counted. Lei 6.015/1973, art. 9º, § 3º (Lei 14.382/2022)
 * sends every term in the public registries to the civil procedure rules:
 * business days, the start day excluded (CPC arts. 219 and 224). That is the
 * default here, the same choice `deadlineDate` already makes for requests.
 * Calendar days only where the law says so ("dias corridos", Lei 6.766
 * art. 19) or where the term is the Código Civil's own (proclamas).
 * Researched against the federal text and the CNJ's Código Nacional de
 * Normas (Prov. 149/2023, up to Prov. 258/2026) on 07/11/2026; the
 * CGJ-RN's Código de Normas was not read and may add to it.
 */
export const NOTICE_TYPES = {
  // REGISTRO CIVIL DAS PESSOAS NATURAIS
  "proclamas-casamento": {
    sector: "proclamas",
    label: "Proclamas de casamento",
    legalBasis: "Código Civil, art. 1.527; Lei 6.015/1973, art. 67, § 1º",
    termLabel: "Prazo para oposição de impedimentos",
    summary:
      "Uma publicação, que fica 15 dias no ar (CC, art. 1.527). Desde a Lei 14.382/2022 a publicidade é eletrônica e o certificado sai em até 5 dias; se a serventia já segue só esse prazo, ajuste a saída.",
    runs: 1,
    runIntervalDays: 0,
    graceDays: 0,
    termDays: 15,
    counting: "calendar",
  },

  // REGISTRO DE IMÓVEIS
  "usucapiao-terceiros": {
    sector: "registro-imoveis",
    label: "Usucapião, ciência de terceiros",
    legalBasis: "Lei 6.015/1973, art. 216-A, § 4º; CNN, art. 413",
    termLabel: "Prazo para manifestação",
    summary:
      "Uma publicação para terceiros eventualmente interessados, que podem se manifestar nos 15 dias seguintes. Vale também para imóvel sem matrícula ou sem proprietário tabular. O silêncio vale como anuência.",
    runs: 1,
    runIntervalDays: 0,
    graceDays: 0,
    termDays: 15,
    counting: "business",
  },
  "usucapiao-notificacao": {
    sector: "registro-imoveis",
    label: "Usucapião, notificação por edital",
    legalBasis: "Lei 6.015/1973, art. 216-A, § 13; CNN, art. 408",
    termLabel: "Prazo para manifestação",
    summary:
      "Titular de direito na matrícula (proprietário tabular), confrontante ou anuente não encontrado ou em lugar incerto: duas publicações, pelo prazo de 15 dias cada uma; a 2ª entra quando termina o prazo da 1ª. O silêncio vale como concordância.",
    runs: 2,
    runIntervalDays: 15,
    graceDays: 0,
    termDays: 15,
    counting: "business",
  },
  "retificacao-confrontante": {
    sector: "registro-imoveis",
    label: "Retificação, notificação de confrontante",
    legalBasis: "Lei 6.015/1973, art. 213, II, §§ 2º e 3º",
    termLabel: "Prazo para manifestação",
    summary:
      "Confrontante não encontrado ou em lugar incerto: duas publicações e 15 dias para se manifestar, contados aqui da 2ª. A lei não fixa intervalo entre elas: o cálculo as põe em dias seguidos. O silêncio vale como anuência.",
    runs: 2,
    runIntervalDays: 1,
    graceDays: 0,
    termDays: 15,
    counting: "business",
  },
  loteamento: {
    sector: "registro-imoveis",
    label: "Loteamento ou desmembramento",
    legalBasis: "Lei 6.766/1979, art. 19",
    termLabel: "Prazo para impugnação",
    summary:
      "Três publicações em dias consecutivos; impugnação em 15 dias corridos, contados da última.",
    runs: 3,
    runIntervalDays: 1,
    graceDays: 0,
    termDays: 15,
    counting: "calendar",
  },
  "lote-intimacao": {
    sector: "registro-imoveis",
    label: "Compromisso de compra de lote, intimação",
    legalBasis: "Lei 6.766/1979, art. 32, § 1º, e art. 49, § 2º",
    termLabel: "Prazo para pagamento",
    summary:
      "Adquirente de lote não encontrado: três publicações (na forma do art. 19); o prazo de 30 dias para pagar começa a correr 10 dias após a última.",
    runs: 3,
    runIntervalDays: 1,
    graceDays: 10,
    termDays: 30,
    counting: "business",
  },
  "alienacao-fiduciaria": {
    sector: "registro-imoveis",
    label: "Alienação fiduciária, intimação do devedor",
    legalBasis: "Lei 9.514/1997, art. 26, §§ 1º e 4º",
    termLabel: "Prazo para purgar a mora",
    summary:
      "Devedor em local ignorado, incerto ou inacessível: edital publicado por no mínimo 3 dias; 15 dias para pagar, contados da última publicação.",
    runs: 3,
    runIntervalDays: 1,
    graceDays: 0,
    termDays: 15,
    counting: "business",
  },
  "hipoteca-execucao": {
    sector: "registro-imoveis",
    label: "Execução de hipoteca, intimação do devedor",
    legalBasis: "Lei 14.711/2023, art. 9º, § 1º; Lei 9.514/1997, art. 26",
    termLabel: "Prazo para purgar a mora",
    summary:
      "Mesma forma da alienação fiduciária, por remissão da lei: edital por no mínimo 3 dias e 15 dias para pagar, contados da última publicação.",
    runs: 3,
    runIntervalDays: 1,
    graceDays: 0,
    termDays: 15,
    counting: "business",
  },
  "adjudicacao-compulsoria": {
    sector: "registro-imoveis",
    label: "Adjudicação compulsória, notificação por edital",
    legalBasis: "Lei 6.015/1973, art. 216-B; CNN, arts. 440-S e 440-X",
    termLabel: "Prazo para anuência ou impugnação",
    summary:
      "Requerido não encontrado: duas publicações com intervalo de 15 dias úteis; 15 dias úteis para anuir ou impugnar, contados aqui da 2ª (o CNN não fixa o termo inicial no edital).",
    runs: 2,
    runIntervalDays: 15,
    graceDays: 0,
    termDays: 15,
    counting: "business",
  },
  "bem-de-familia": {
    sector: "registro-imoveis",
    label: "Instituição de bem de família",
    legalBasis: "Lei 6.015/1973, arts. 261 e 262",
    termLabel: "Prazo para reclamação",
    summary:
      "Uma publicação na imprensa; quem se julgar prejudicado tem 30 dias, contados da publicação, para reclamar.",
    runs: 1,
    runIntervalDays: 0,
    graceDays: 0,
    termDays: 30,
    counting: "business",
  },

  // TABELIONATO DE PROTESTO
  "protesto-intimacao": {
    sector: "protesto",
    label: "Intimação para pagamento",
    legalBasis: "Lei 9.492/1997, arts. 12, 13, 14, § 5º, e 15",
    termLabel: "Prazo para pagamento",
    summary:
      "Devedor desconhecido, em local incerto ou fora da competência (ou aviso de recebimento que não volta em 7 dias úteis): uma publicação, afixada no tabelionato e na CENPROT. Pagamento até o dia da publicação; o protesto é tirado no primeiro dia útil seguinte.",
    runs: 1,
    runIntervalDays: 0,
    graceDays: 0,
    termDays: 0,
    counting: "business",
  },
} as const satisfies Record<string, NoticeType>;

export type NoticeTypeKey = keyof typeof NOTICE_TYPES;

export function isNoticeTypeKey(value: unknown): value is NoticeTypeKey {
  return typeof value === "string" && Object.hasOwn(NOTICE_TYPES, value);
}

export function noticeTypeOf(
  key: string | null | undefined,
): NoticeType | undefined {
  return isNoticeTypeKey(key) ? NOTICE_TYPES[key] : undefined;
}

/** The types an edital of `sector` can be, in catalog order. */
export function noticeTypesOf(sector: NoticeSector): NoticeTypeKey[] {
  return (Object.keys(NOTICE_TYPES) as NoticeTypeKey[]).filter(
    (key) => NOTICE_TYPES[key].sector === sector,
  );
}

/** Banns have one rule only, so the form never asks: the schema writes it. */
export const MARRIAGE_BANNS_NOTICE_TYPE: NoticeTypeKey = "proclamas-casamento";

/** The full schedule of a publication with a rule and an entry date. */
export function publicationSchedule(pub: {
  noticeType: string | null;
  publishAt: IsoDate | null;
}): NoticeSchedule | undefined {
  const type = noticeTypeOf(pub.noticeType);
  if (!type || !pub.publishAt) return undefined;
  return noticeSchedule(type, pub.publishAt);
}

export interface PublicationHeadline {
  /** "Proclamas", "Aviso", "Edital · Usucapião, terceiros · 2ª publicação". */
  label: string;
  /** The date the site shows: the current run's, or the entry date. */
  date: IsoDate | null;
  run?: NoticeRun;
  termLabel?: string;
  termEndsOn?: IsoDate;
}

/**
 * How a live publication introduces itself on the site today: its kind as
 * the office published it (proclamas, aviso, edital), the edital's own type,
 * and, when the rule asks for more than one run, which one is up and its
 * date. A second run is a republication, so it carries its own date.
 */
export function publicationHeadline(
  pub: {
    kind: string;
    noticeType: string | null;
    publishAt: IsoDate | null;
  },
  today: IsoDate,
): PublicationHeadline {
  const kindLabel =
    PUBLICATION_KIND_LABELS[pub.kind as PublicationKind] ?? "Publicação";
  const type = noticeTypeOf(pub.noticeType);
  const schedule = publicationSchedule(pub);
  if (!type || !schedule) {
    return { label: kindLabel, date: pub.publishAt };
  }
  const run = currentRun(schedule, today);
  const parts = [kindLabel];
  // Banns already say what they are; "Proclamas · Proclamas de casamento"
  // would only repeat it.
  if (pub.kind === "publicNotice") parts.push(type.label);
  if (run && type.runs > 1) parts.push(`${run.number}ª publicação`);
  return {
    label: parts.join(" · "),
    date: run?.date ?? pub.publishAt,
    run,
    termLabel: type.termLabel,
    termEndsOn: schedule.termEndsOn,
  };
}
