import assert from "node:assert/strict";
import { test } from "node:test";
import {
  awaitingOffice,
  citizenMayWrite,
  openRequirements,
  questionsOpen,
} from "./conversation.ts";

const at = (minute: number) => new Date(Date.UTC(2026, 10, 24, 12, minute));
const row = (
  kind: string,
  minute: number,
  extra: Partial<{
    authorType: string;
    resolvedAt: Date | null;
    hiddenAt: Date | null;
  }> = {},
) => ({
  id: `${kind}-${minute}`,
  kind,
  authorType: "office",
  authorName: "Escrevente Fictícia",
  body: "",
  resolvedAt: null,
  editedAt: null,
  hiddenAt: null,
  createdAt: at(minute),
  ...extra,
});

test("the questions are closed until the office opens them, and close again", () => {
  assert.equal(questionsOpen([]), false);
  const opened = [row("open", 1)];
  assert.equal(questionsOpen(opened), true);
  assert.equal(citizenMayWrite(opened, true), true);
  // A past or cancelled appointment takes no more messages.
  assert.equal(citizenMayWrite(opened, false), false);
  const closed = [...opened, row("close", 5)];
  assert.equal(questionsOpen(closed), false);
  assert.equal(citizenMayWrite(closed, true), false);
  // An "open" hidden by the office does not count.
  assert.equal(questionsOpen([row("open", 1, { hiddenAt: at(2) })]), false);
});

test("open exigências are the shown ones not yet met", () => {
  const rows = [
    row("requirement", 1),
    row("requirement", 2, { resolvedAt: at(9) }),
    row("requirement", 3, { hiddenAt: at(4) }),
  ];
  assert.deepEqual(
    openRequirements(rows).map((r) => r.id),
    ["requirement-1"],
  );
});

test("the panel flags a citizen's message left without an answer", () => {
  const asked = [
    row("open", 1),
    row("message", 2),
    row("message", 3, { authorType: "citizen" }),
  ];
  assert.equal(awaitingOffice(asked), true);
  assert.equal(awaitingOffice([...asked, row("message", 4)]), false);
});
