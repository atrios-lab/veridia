import {
  addDays,
  type IsoDate,
  nextBusinessDays,
  type OfficeHolidays,
} from "../scheduling/calendar.ts";
import type { InterimPeriod } from "./book.ts";

/**
 * The book's dates during the year, each one written in a rule (decision
 * of 11/11/2026: the law, nothing of our own). The text of each rule is in
 * docs/livro-diario-auxiliar.md.
 *
 * National (Código Nacional de Normas, Provimento CNJ nº 149/2023):
 * - art. 194, I and VI: an interim deposits what goes over the ceiling and
 *   books it; quarterly, "não havendo lei estadual que estabeleça
 *   periodicidade diversa";
 * - Provimento CNJ nº 24/2012, art. 2º: every office, held or interim,
 *   feeds "Justiça Aberta" by the 15th of January and of July (or the next
 *   business day), productivity and revenue included (parágrafo único);
 *   art. 194, V adds the interim's deposits, in fields of their own.
 *
 * RN (Provimento nº 156/2016-CGJ/RN, kept by art. 195, parágrafo único):
 * - art. 62: the balance of the year before by 15 January, sent to the
 *   Corregedoria Geral de Justiça within 5 days of being done;
 * - art. 61, parágrafo único: the judge's visto by the 15th business day of
 *   February;
 * - art. 21: the interim's accounts by the 20th of the next month;
 * - art. 27: the excess paid to the FDJ by the 10th of the next month.
 */

export type BookDutyId =
  | "balanco"
  | "remessa"
  | "visto"
  | "justica-aberta"
  | "interino-deposito"
  | "interino-fdj"
  | "interino-contas";

export interface BookDuty {
  id: BookDutyId;
  title: string;
  detail: string;
  /** Null when the rule names no day. */
  due: IsoDate | null;
  late: boolean;
}

/** The 15th business day of February, holidays and Carnival counted. */
export function februaryVisto(
  year: number,
  holidays: OfficeHolidays = {},
): IsoDate {
  const days = nextBusinessDays(`${year}-02-01`, 15, holidays);
  return days[14] ?? `${year}-02-28`;
}

/** "Até o dia 15 ... (ou até o próximo dia útil subsequente)". */
export function fifteenthOrNextBusinessDay(
  year: number,
  month: number,
  holidays: OfficeHolidays = {},
): IsoDate {
  const day = `${year}-${String(month).padStart(2, "0")}-15`;
  return nextBusinessDays(day, 1, holidays)[0] ?? day;
}

const br = (iso: string) =>
  `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function previousMonth(today: IsoDate): string {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  return m === 1 ? `dezembro de ${y - 1}` : `${MONTHS[m - 2] ?? ""} de ${y}`;
}

export function bookDuties(
  today: IsoDate,
  options: {
    holidays?: OfficeHolidays;
    /** The office's state: the state's own rules apply only there. */
    state?: string;
    /** The day the balance of last year was generated, if it was. */
    lastYearBalanceOn: IsoDate | null;
    interim?: boolean;
    interimPeriod?: InterimPeriod;
  },
): BookDuty[] {
  const year = Number(today.slice(0, 4));
  const last = year - 1;
  const month = Number(today.slice(5, 7));
  const day = Number(today.slice(8, 10));
  const rn = (options.state ?? "RN") === "RN";
  const duties: BookDuty[] = [];

  if (rn && !options.lastYearBalanceOn && month <= 3) {
    const due = `${year}-01-15`;
    duties.push({
      id: "balanco",
      title: `Balanço anual de ${last}`,
      detail: `"Ao final de cada exercício será elaborado o balanço anual" (CN art. 193). No RN, até ${br(due)}, remetido à Corregedoria Geral de Justiça até 5 dias depois de sua conclusão (CGJ/RN art. 62).`,
      due,
      late: today > due,
    });
  }
  if (rn && options.lastYearBalanceOn) {
    const due = addDays(options.lastYearBalanceOn, 5);
    if (today <= due) {
      duties.push({
        id: "remessa",
        title: `Remeter o balanço de ${last} à Corregedoria`,
        detail: `Balanço concluído em ${br(options.lastYearBalanceOn)}: remessa à Corregedoria Geral de Justiça até ${br(due)} (CGJ/RN art. 62, parágrafo único).`,
        due,
        late: false,
      });
    }
  }
  const visto = februaryVisto(year, options.holidays);
  if (rn && today > `${year}-01-15` && today <= visto) {
    duties.push({
      id: "visto",
      title: "Visto anual do Juiz Corregedor Permanente",
      detail: `"Anualmente, até o 15º (décimo quinto) dia útil do mês de fevereiro, o Livro de Registro Diário Auxiliar da Receita e da Despesa será visado pelo Juiz Corregedor Permanente" (CGJ/RN art. 61, parágrafo único): ${br(visto)}.`,
      due: visto,
      late: false,
    });
  }

  // Every office, not only an interim (decision of 12/11/2026): the
  // Provimento nº 24/2012 speaks of "os responsáveis pelos serviços
  // notariais e de registro".
  if (month === 1 || month === 7) {
    const due = fifteenthOrNextBusinessDay(year, month, options.holidays);
    if (today <= due) {
      const semester =
        month === 1
          ? `01/07/${last} a 31/12/${last}`
          : `01/01/${year} a 30/06/${year}`;
      duties.push({
        id: "justica-aberta",
        title: "Justiça Aberta: dados do semestre",
        detail: `Alimentar o sistema "Justiça Aberta" com os dados do semestre de ${semester}, inclusive produtividade e arrecadação, até ${br(due)} (Provimento CNJ nº 24/2012, art. 2º e parágrafo único).${
          options.interim
            ? " O responsável interino lança também, em campos próprios, os valores depositados à disposição do Tribunal de Justiça (Código Nacional de Normas, art. 194, V)."
            : ""
        }`,
        due,
        late: false,
      });
    }
  }

  if (!options.interim) return duties;
  const period = options.interimPeriod ?? "trimestral";
  if (period === "trimestral" && [1, 4, 7, 10].includes(month)) {
    duties.push({
      id: "interino-deposito",
      title: "Excedente do trimestre (interino)",
      detail:
        'A página de março, junho, setembro ou dezembro apura a renda líquida do trimestre. O excedente a 90,25% dos subsídios de ministro do STF é depositado à disposição do Tribunal de Justiça, conforme as normas do Tribunal, e lançado no livro com a data do depósito e a conta (CN art. 194, I e VI). Use "Lançar" › "Depósito do excedente".',
      due: null,
      late: false,
    });
  }
  if (rn && period === "mensal" && day <= 10) {
    const due = `${today.slice(0, 7)}-10`;
    duties.push({
      id: "interino-fdj",
      title: "Excedente ao teto para o FDJ (interino)",
      detail: `O excedente de ${previousMonth(today)} é recolhido ao FDJ até ${br(due)} (CGJ/RN art. 27) e lançado no livro (CN art. 194, I).`,
      due,
      late: false,
    });
  }
  if (rn && day <= 20) {
    const due = `${today.slice(0, 7)}-20`;
    duties.push({
      id: "interino-contas",
      title: "Prestação de contas do interino",
      detail: `"O interino prestará contas ao Juiz Corregedor Permanente, até o dia 20 (vinte) do mês subsequente ao vencido" (CGJ/RN art. 21): ${previousMonth(today)}, até ${br(due)}.`,
      due,
      late: false,
    });
  }
  return duties;
}
