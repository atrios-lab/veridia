// A course's assessment, without a database: drawing an attempt, reading
// the answers back from what was shown, grading and the wait between
// attempts. The random source is a parameter, so tests can fix it.

/** A question as stored: four alternatives, one right. */
export interface Question {
  id: string;
  prompt: string;
  options: readonly string[];
  correctIndex: number;
}

/** An integer in [0, max): `crypto.randomInt` in production. */
export type RandomInt = (max: number) => number;

/** Fisher-Yates over a copy. */
export function shuffle<T>(items: readonly T[], random: RandomInt): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface Draw {
  /** The questions, in the order shown. */
  questionIds: string[];
  /** Per question shown, the original alternative indexes in the order
   * shown: `optionOrders[q][shown] = original`. */
  optionOrders: number[][];
}

/** A fresh order of the questions and of each one's alternatives. */
export function drawAttempt(
  questions: readonly Question[],
  random: RandomInt,
): Draw {
  const order = shuffle(questions, random);
  return {
    questionIds: order.map((q) => q.id),
    optionOrders: order.map((q) =>
      shuffle(
        q.options.map((_, index) => index),
        random,
      ),
    ),
  };
}

/** What the browser gets: prompts and alternatives in the drawn order,
 * never which one is right. */
export interface ShownQuestion {
  id: string;
  prompt: string;
  options: string[];
}

export function shownQuestions(
  draw: Draw,
  byId: ReadonlyMap<string, Question>,
): ShownQuestion[] {
  return draw.questionIds.flatMap((id, q) => {
    const question = byId.get(id);
    if (!question) return [];
    return [
      {
        id,
        prompt: question.prompt,
        options: draw.optionOrders[q].map(
          (original) => question.options[original],
        ),
      },
    ];
  });
}

/**
 * The answers as the original alternative indexes, from the position the
 * person picked in what was shown. Null when an answer is missing or out of
 * range: the attempt is refused whole rather than graded with a blank.
 */
export function originalAnswers(
  draw: Draw,
  shownPicks: readonly (number | null | undefined)[],
): number[] | null {
  if (shownPicks.length !== draw.questionIds.length) return null;
  const out: number[] = [];
  for (let q = 0; q < draw.questionIds.length; q++) {
    const pick = shownPicks[q];
    const order = draw.optionOrders[q];
    if (
      pick === null ||
      pick === undefined ||
      !Number.isInteger(pick) ||
      pick < 0 ||
      pick >= order.length
    ) {
      return null;
    }
    out.push(order[pick]);
  }
  return out;
}

export interface Grade {
  correct: number;
  total: number;
  /** Rounded down, so 69.9 never reads as passing 70. */
  percent: number;
  passed: boolean;
}

/** Grades against the right alternative as it stands now. */
export function grade(
  questionIds: readonly string[],
  answers: readonly number[],
  byId: ReadonlyMap<string, Question>,
  passingScore: number,
): Grade {
  let correct = 0;
  questionIds.forEach((id, q) => {
    if (byId.get(id)?.correctIndex === answers[q]) correct++;
  });
  const total = questionIds.length;
  const percent = total === 0 ? 0 : Math.floor((correct * 100) / total);
  return {
    correct,
    total,
    percent,
    passed: total > 0 && percent >= passingScore,
  };
}

export type StartCheck =
  | { kind: "can-start" }
  | { kind: "passed" }
  | { kind: "wait"; until: Date; remainingMs: number };

/** Whether a new attempt may start, from the last submitted one. */
export function canStart(
  last: { submittedAt: Date; passed: boolean } | undefined,
  now: Date,
  retryHours: number,
): StartCheck {
  if (!last) return { kind: "can-start" };
  if (last.passed) return { kind: "passed" };
  const until = new Date(last.submittedAt.getTime() + retryHours * 3_600_000);
  const remainingMs = until.getTime() - now.getTime();
  return remainingMs <= 0
    ? { kind: "can-start" }
    : { kind: "wait", until, remainingMs };
}

/** "3 h 12 min", "45 min", "menos de 1 min": what is left to wait. */
export function formatWait(ms: number): string {
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 1) return "menos de 1 min";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
