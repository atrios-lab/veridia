import { addDays, type IsoDate } from "../scheduling/calendar.ts";
import { type Answers, CLASS_ONE_LIMIT, text } from "./sections.ts";

/**
 * Art. 16 of Provimento CN 213/2026, as rewritten by Provimento 243/2026:
 * the office's class follows its semestral gross revenue, and each class is
 * split in subclasses. Classe 1 reaches R$ 300.000, Classe 2 reaches
 * R$ 1.500.000, Classe 3 has no ceiling; Classe 1 and 2 split in three equal
 * bands, Classe 3 in multiples (3x, 6x, 12x) of its own floor.
 *
 * Art. 20 gives Etapa 1 a term of 300, 240 or 180 days from the day the
 * Provimento takes effect, and the whole programme 36, 30 or 24 months.
 * ponytail: the limits are updated yearly by the Corregedoria Nacional;
 * when a new table is published, change the two constants here.
 */
export const CLASS_TWO_LIMIT = 1_500_000;

/** Published in the DJe on 23/07/2026, in force thirty days later. */
export const PROVIMENTO_243_IN_FORCE: IsoDate = "2026-08-22";

export interface Classification {
  classe: 1 | 2 | 3;
  subclasse: string;
  stage1Days: number;
  completionMonths: number;
  stage1Deadline: IsoDate;
  completionDeadline: IsoDate;
}

const STAGE1_DAYS = { 1: 300, 2: 240, 3: 180 } as const;
const COMPLETION_MONTHS = { 1: 36, 2: 30, 3: 24 } as const;

function subclass(revenue: number): { classe: 1 | 2 | 3; subclasse: string } {
  if (revenue <= CLASS_ONE_LIMIT) {
    const band = CLASS_ONE_LIMIT / 3;
    const subclasse = revenue <= band ? "A" : revenue <= 2 * band ? "B" : "C";
    return { classe: 1, subclasse };
  }
  if (revenue <= CLASS_TWO_LIMIT) {
    const band = (CLASS_TWO_LIMIT - CLASS_ONE_LIMIT) / 3;
    const subclasse =
      revenue <= CLASS_ONE_LIMIT + band
        ? "D"
        : revenue <= CLASS_ONE_LIMIT + 2 * band
          ? "E"
          : "F";
    return { classe: 2, subclasse };
  }
  const times = revenue / CLASS_TWO_LIMIT;
  const subclasse =
    times <= 3 ? "G" : times <= 6 ? "H" : times <= 12 ? "I" : "J";
  return { classe: 3, subclasse };
}

function addMonths(date: IsoDate, months: number): IsoDate {
  const [y, m, d] = date.split("-").map(Number);
  const moved = new Date(Date.UTC(y, m - 1 + months, d));
  return moved.toISOString().slice(0, 10);
}

/** Null when the revenue is missing or not a positive number. */
export function classify(
  revenue: number,
  inForce: IsoDate = PROVIMENTO_243_IN_FORCE,
): Classification | null {
  if (!Number.isFinite(revenue) || revenue <= 0) return null;
  const { classe, subclasse } = subclass(revenue);
  return {
    classe,
    subclasse,
    stage1Days: STAGE1_DAYS[classe],
    completionMonths: COMPLETION_MONTHS[classe],
    stage1Deadline: addDays(inForce, STAGE1_DAYS[classe]),
    completionDeadline: addMonths(inForce, COMPLETION_MONTHS[classe]),
  };
}

export function classificationOf(answers: Answers): Classification | null {
  return classify(Number(text(answers, "serventia", "revenueLastSemester")));
}
