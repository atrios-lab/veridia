import assert from "node:assert/strict";
import { test } from "node:test";
import { publicationState } from "./state.ts";

const TODAY = "2026-08-08";

test("no entry date is a draft", () => {
  const state = publicationState(
    { publishAt: null, expireAt: null, archivedAt: null },
    TODAY,
  );
  assert.equal(state, "draft");
});

test("entry date in the future is scheduled", () => {
  const state = publicationState(
    { publishAt: "2026-08-20", expireAt: "2026-09-04", archivedAt: null },
    TODAY,
  );
  assert.equal(state, "scheduled");
});

test("entry date reached, exit date ahead is live", () => {
  const state = publicationState(
    { publishAt: "2026-08-01", expireAt: "2026-08-16", archivedAt: null },
    TODAY,
  );
  assert.equal(state, "live");
});

test("entry date is today counts as live", () => {
  const state = publicationState(
    { publishAt: TODAY, expireAt: TODAY, archivedAt: null },
    TODAY,
  );
  assert.equal(state, "live");
});

test("exit date already passed is archived automatically", () => {
  const state = publicationState(
    { publishAt: "2026-07-01", expireAt: "2026-08-07", archivedAt: null },
    TODAY,
  );
  assert.equal(state, "archived");
});

test("manual archive wins over any date", () => {
  const state = publicationState(
    {
      publishAt: "2026-08-01",
      expireAt: "2026-08-16",
      archivedAt: new Date("2026-08-05T12:00:00Z"),
    },
    TODAY,
  );
  assert.equal(state, "archived");
});
