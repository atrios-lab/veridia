import {
  addDays,
  type IsoDate,
  nextBusinessDays,
  type OfficeHolidays,
} from "../scheduling/calendar.ts";

/**
 * The book's dates during the year (decision of 11/11/2026). The national
 * code (art. 193, Provimento CNJ nº 259/2026) asks for the year's balance
 * "ao final de cada exercício" and leaves the dates to the state
 * (art. 195, parágrafo único). In RN (Provimento nº 156/2016-CGJ/RN):
 *
 * - art. 62: the balance of the year before by 15 January, sent to the
 *   Corregedoria Geral de Justiça within 5 days of being done;
 * - art. 61, parágrafo único: the judge's "visto" on the book by the 15th
 *   business day of February;
 * - interim offices: the accounts of the month to the judge by the 20th of
 *   the next (art. 21) and what goes over the ceiling paid to the FDJ by
 *   the 10th (art. 27).
 */

export type BookDutyId =
  | "balanco"
  | "remessa"
  | "visto"
  | "interino-fdj"
  | "interino-contas";

export interface BookDuty {
  id: BookDutyId;
  title: string;
  detail: string;
  due: IsoDate;
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
    /** The day the balance of last year was generated, if it was. */
    lastYearBalanceOn: IsoDate | null;
    interim?: boolean;
  },
): BookDuty[] {
  const year = Number(today.slice(0, 4));
  const last = year - 1;
  const month = Number(today.slice(5, 7));
  const day = Number(today.slice(8, 10));
  const duties: BookDuty[] = [];

  // Art. 62: the balance, January to March, until it is generated.
  if (!options.lastYearBalanceOn && month <= 3) {
    const due = `${year}-01-15`;
    duties.push({
      id: "balanco",
      title: `Balanço anual de ${last}`,
      detail: `Gere o balanço de ${last} (receita, despesa e resultado mês a mês) até ${br(due)} e envie à Corregedoria Geral de Justiça até 5 dias depois de concluído (CN art. 193; CGJ/RN art. 62).`,
      due,
      late: today > due,
    });
  }
  // Art. 62, parágrafo único: sent within 5 days of being done.
  if (options.lastYearBalanceOn) {
    const due = addDays(options.lastYearBalanceOn, 5);
    if (today <= due) {
      duties.push({
        id: "remessa",
        title: `Enviar o balanço de ${last} à Corregedoria`,
        detail: `O balanço foi gerado em ${br(options.lastYearBalanceOn)}: envie à Corregedoria Geral de Justiça até ${br(due)} (CGJ/RN art. 62, parágrafo único).`,
        due,
        late: false,
      });
    }
  }
  // Art. 61, parágrafo único: from the balance's deadline to the visto.
  const visto = februaryVisto(year, options.holidays);
  if (today > `${year}-01-15` && today <= visto) {
    duties.push({
      id: "visto",
      title: "Visto anual do Juiz Corregedor Permanente",
      detail: `O livro precisa ser visado pelo Juiz Corregedor Permanente até ${br(visto)}, o 15º dia útil de fevereiro (CGJ/RN art. 61, parágrafo único). Leve o balanço de ${last} e as páginas do livro.`,
      due: visto,
      late: false,
    });
  }
  if (options.interim) {
    const ym = today.slice(0, 7);
    if (day <= 10) {
      duties.push({
        id: "interino-fdj",
        title: "Excedente ao teto para o FDJ",
        detail: `Se a receita líquida de ${previousMonth(today)} passou do teto do interino (90,25% do subsídio dos Ministros do STF), recolha o excedente ao FDJ até ${br(`${ym}-10`)} (CGJ/RN arts. 19 e 27). A apuração do mês mostra o valor.`,
        due: `${ym}-10`,
        late: false,
      });
    }
    if (day <= 20) {
      duties.push({
        id: "interino-contas",
        title: "Prestação de contas do interino",
        detail: `Preste contas de ${previousMonth(today)} ao Juiz Corregedor Permanente até ${br(`${ym}-20`)}, com receitas, despesas e comprovantes (CGJ/RN art. 21).`,
        due: `${ym}-20`,
        late: false,
      });
    }
  }
  return duties;
}

/**
 * Interim offices (CGJ/RN arts. 19, 26 and 27): the month's net result
 * before the interim's pay; up to the ceiling it is the interim's pay
 * (booked as an expense), above it goes to the FDJ.
 */
export function interimSplit(
  netCents: number,
  ceilingCents: number,
): { payCents: number; excessCents: number } {
  const net = Math.max(0, netCents);
  if (ceilingCents <= 0) return { payCents: net, excessCents: 0 };
  return {
    payCents: Math.min(net, ceilingCents),
    excessCents: Math.max(0, net - ceilingCents),
  };
}
