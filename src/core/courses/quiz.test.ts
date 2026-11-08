import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canStart,
  drawAttempt,
  formatWait,
  grade,
  originalAnswers,
  type Question,
  shownQuestions,
  shuffle,
} from "./quiz.ts";

const QUESTIONS: Question[] = ["q1", "q2", "q3"].map((id, i) => ({
  id,
  prompt: `Pergunta ${id}`,
  options: ["a", "b", "c", "d"],
  correctIndex: i,
}));
const BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));

/** A fixed sequence of "random" picks, cycling. */
function sequence(...values: number[]) {
  let i = 0;
  return (max: number) => values[i++ % values.length] % max;
}

test("shuffle keeps every item and leaves the input alone", () => {
  const input = [1, 2, 3, 4, 5];
  const out = shuffle(input, sequence(3, 0, 1, 0));
  assert.deepEqual([...out].sort(), [1, 2, 3, 4, 5]);
  assert.deepEqual(input, [1, 2, 3, 4, 5]);
});

test("two draws with different randomness differ", () => {
  const a = drawAttempt(QUESTIONS, sequence(0));
  const b = drawAttempt(QUESTIONS, sequence(1, 2, 0));
  assert.notDeepEqual(
    [a.questionIds, a.optionOrders],
    [b.questionIds, b.optionOrders],
  );
  for (const draw of [a, b]) {
    assert.deepEqual([...draw.questionIds].sort(), ["q1", "q2", "q3"]);
    for (const order of draw.optionOrders) {
      assert.deepEqual([...order].sort(), [0, 1, 2, 3]);
    }
  }
});

test("what the browser gets has no right answer in it", () => {
  const draw = drawAttempt(QUESTIONS, sequence(1, 2, 3));
  const shown = shownQuestions(draw, BY_ID);
  assert.equal(shown.length, 3);
  for (const question of shown) {
    assert.deepEqual(Object.keys(question).sort(), ["id", "options", "prompt"]);
  }
  // Alternatives come out in the drawn order.
  const first = BY_ID.get(draw.questionIds[0]);
  assert.deepEqual(
    shown[0].options,
    draw.optionOrders[0].map((i) => first?.options[i]),
  );
});

test("a pick on screen maps back to the original alternative", () => {
  const draw = {
    questionIds: ["q2", "q1"],
    optionOrders: [
      [3, 1, 0, 2],
      [2, 0, 3, 1],
    ],
  };
  assert.deepEqual(originalAnswers(draw, [2, 1]), [0, 0]);
});

test("a missing or out-of-range pick refuses the whole attempt", () => {
  const draw = {
    questionIds: ["q1", "q2"],
    optionOrders: [
      [0, 1, 2, 3],
      [0, 1, 2, 3],
    ],
  };
  assert.equal(originalAnswers(draw, [0]), null);
  assert.equal(originalAnswers(draw, [0, null]), null);
  assert.equal(originalAnswers(draw, [0, 4]), null);
  assert.equal(originalAnswers(draw, [0, -1]), null);
  assert.equal(originalAnswers(draw, [0, 1.5]), null);
});

test("grading counts right answers; 7 of 10 passes 70, 6 does not", () => {
  const ten = Array.from({ length: 10 }, (_, i) => ({
    id: `x${i}`,
    prompt: "",
    options: ["a", "b", "c", "d"],
    correctIndex: 1,
  }));
  const byId = new Map(ten.map((q) => [q.id, q]));
  const ids = ten.map((q) => q.id);
  const seven = ids.map((_, i) => (i < 7 ? 1 : 0));
  const six = ids.map((_, i) => (i < 6 ? 1 : 0));
  assert.deepEqual(grade(ids, seven, byId, 70), {
    correct: 7,
    total: 10,
    percent: 70,
    passed: true,
  });
  assert.equal(grade(ids, six, byId, 70).passed, false);
});

test("percent rounds down: 2 of 3 is 66, not 67", () => {
  assert.equal(grade(["q1", "q2", "q3"], [0, 1, 0], BY_ID, 70).percent, 66);
});

test("waiting: 5 hours after a failure, nothing after a pass", () => {
  const failed = {
    submittedAt: new Date("2026-11-07T10:00:00Z"),
    passed: false,
  };
  assert.deepEqual(canStart(undefined, new Date(), 5), { kind: "can-start" });
  const at14 = canStart(failed, new Date("2026-11-07T14:00:00Z"), 5);
  assert.equal(at14.kind, "wait");
  assert.equal(at14.kind === "wait" && at14.remainingMs, 3_600_000);
  assert.deepEqual(canStart(failed, new Date("2026-11-07T15:00:00Z"), 5), {
    kind: "can-start",
  });
  assert.deepEqual(
    canStart({ ...failed, passed: true }, new Date("2026-11-08T10:00:00Z"), 5),
    { kind: "passed" },
  );
});

test("the wait reads in hours and minutes", () => {
  assert.equal(formatWait(3_600_000), "1 h");
  assert.equal(formatWait(11_520_000), "3 h 12 min");
  assert.equal(formatWait(45 * 60_000), "45 min");
  assert.equal(formatWait(10_000), "1 min");
  assert.equal(formatWait(0), "menos de 1 min");
});
