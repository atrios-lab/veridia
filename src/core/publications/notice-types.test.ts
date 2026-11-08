import assert from "node:assert/strict";
import { test } from "node:test";
import { noticeSchedule } from "./notice-schedule.ts";
import { NOTICE_TYPES, publicationHeadline } from "./notice-types.ts";
import { publicationSectionTitle } from "./publication.ts";

test("usucapião by edital: second run when the first's 15 business days end", () => {
  const schedule = noticeSchedule(
    NOTICE_TYPES["usucapiao-notificacao"],
    "2026-10-01",
  );
  assert.deepEqual(
    schedule.runs.map((run) => run.date),
    ["2026-10-01", "2026-10-23"],
  );
  // Business days, skipping 10-12 (Aparecida) and 11-02 (Finados).
  assert.equal(schedule.termEndsOn, "2026-11-16");
});

test("loteamento: three consecutive days, fifteen calendar days from the last", () => {
  const schedule = noticeSchedule(NOTICE_TYPES.loteamento, "2026-09-01");
  assert.deepEqual(
    schedule.runs.map((run) => run.date),
    ["2026-09-01", "2026-09-02", "2026-09-03"],
  );
  assert.equal(schedule.termEndsOn, "2026-09-18");
});

test("a retroactive edital is dated by the run it is in today", () => {
  const row = {
    kind: "publicNotice",
    noticeType: "usucapiao-notificacao",
    publishAt: "2026-10-01",
  };
  const first = publicationHeadline(row, "2026-10-10");
  assert.equal(first.date, "2026-10-01");
  assert.match(first.label, /1ª publicação/);

  const second = publicationHeadline(row, "2026-10-26");
  assert.equal(second.date, "2026-10-23");
  assert.match(second.label, /^Edital · Usucapião.* · 2ª publicação$/);
  assert.equal(second.termEndsOn, "2026-11-16");
});

test("banns and notices keep their own name on the site", () => {
  assert.equal(
    publicationHeadline(
      {
        kind: "marriageBanns",
        noticeType: "proclamas-casamento",
        publishAt: "2026-11-02",
      },
      "2026-11-07",
    ).label,
    "Proclamas",
  );
  assert.equal(
    publicationHeadline(
      { kind: "notice", noticeType: null, publishAt: "2026-11-07" },
      "2026-11-07",
    ).label,
    "Aviso",
  );
});

test("home heading names only what is live", () => {
  assert.equal(publicationSectionTitle(["marriageBanns"]), "Proclamas");
  assert.equal(publicationSectionTitle(["notice", "notice"]), "Avisos");
  assert.equal(publicationSectionTitle(["publicNotice"]), "Editais");
  assert.equal(
    publicationSectionTitle(["publicNotice", "notice"]),
    "Avisos e editais",
  );
  assert.equal(
    publicationSectionTitle(["publicNotice", "notice", "marriageBanns"]),
    "Proclamas, avisos e editais",
  );
});

test("protesto: payment until the edital day, which lands on a business day", () => {
  // Saturday edital: the due day moves to Monday.
  assert.equal(
    noticeSchedule(NOTICE_TYPES["protesto-intimacao"], "2026-11-07").termEndsOn,
    "2026-11-09",
  );
});
