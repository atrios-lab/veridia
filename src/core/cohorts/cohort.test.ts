import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cohortCode,
  cohortCreateSchema,
  cohortJoinSchema,
  cohortState,
  cohortUpdateSchema,
  expiryAfter,
  lastValidDay,
  normalizeCohortCode,
  seatsFit,
} from "./cohort.ts";
import { learnerStatus } from "./progress.ts";

// The cohort's rules with no database: the link code, the link's state, the
// two forms the platform account fills in and the one a learner does.

const NOW = new Date("2026-11-09T15:00:00Z");
const LATER = new Date("2026-12-09T03:00:00Z");

test("a code has eight characters of the certificate's alphabet", () => {
  const code = cohortCode(new Uint8Array([0xff, 0x00, 0xaa, 0x55, 0x0f]));
  assert.match(code, /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
  assert.equal(cohortCode(new Uint8Array(5)), "0000-0000");
});

test("a code is read back however it was typed", () => {
  assert.equal(normalizeCohortCode("k7qm-2xpa"), "K7QM-2XPA");
  assert.equal(normalizeCohortCode("K7QM2XPA"), "K7QM-2XPA");
  assert.equal(normalizeCohortCode(" k7qm 2xpa "), "K7QM-2XPA");
  // Crockford decoding: O is zero, I and L are one.
  assert.equal(normalizeCohortCode("KOQM-2XPI"), "K0QM-2XP1");
  assert.equal(normalizeCohortCode("KLQM-2XPA"), "K1QM-2XPA");
});

test("a code of the wrong size or with U is refused", () => {
  assert.equal(normalizeCohortCode("K7QM-2XP"), null);
  assert.equal(normalizeCohortCode("K7QM-2XPAA"), null);
  assert.equal(normalizeCohortCode("K7QM-2XPU"), null);
  assert.equal(normalizeCohortCode(""), null);
});

test("a link valid through a day works until the office's midnight", () => {
  const expiresAt = expiryAfter("2026-12-09");
  // Midnight in Natal is 03:00 UTC.
  assert.equal(expiresAt.toISOString(), "2026-12-10T03:00:00.000Z");
  assert.equal(lastValidDay(expiresAt), "2026-12-09");
});

test("the link's state: closed, then expired, then full", () => {
  const open = { seats: 2, expiresAt: LATER, closedAt: null };
  assert.equal(cohortState(open, 1, NOW), "open");
  assert.equal(cohortState(open, 2, NOW), "full");
  assert.equal(cohortState(open, 0, LATER), "expired");
  assert.equal(cohortState({ ...open, closedAt: NOW }, 0, NOW), "closed");
  // Closed by hand wins even past the date and with no seats left.
  assert.equal(cohortState({ ...open, closedAt: NOW }, 5, LATER), "closed");
});

test("a new cohort needs the office, a contact and at least one seat", () => {
  const valid = {
    courseId: "8d1c5c66-1f60-4a3b-9f6e-0c8f1d8f4e21",
    officeName: "  2º Ofício   de X/RN ",
    officeCity: "X/RN",
    contactName: "Fulano",
    contactPhone: "(84) 99999-0000",
    seats: "15",
    validDays: "30",
  };
  const parsed = cohortCreateSchema.parse(valid);
  assert.equal(parsed.officeName, "2º Ofício de X/RN");
  assert.equal(parsed.seats, 15);
  assert.equal(parsed.validDays, 30);
  assert.equal(
    cohortCreateSchema.safeParse({ ...valid, seats: "0" }).success,
    false,
  );
  assert.equal(
    cohortCreateSchema.safeParse({ ...valid, officeName: "" }).success,
    false,
  );
  assert.equal(
    cohortCreateSchema.safeParse({ ...valid, courseId: "lgpd" }).success,
    false,
  );
});

test("an edit takes a calendar day as the link's last day", () => {
  const base = {
    officeName: "2º Ofício de X/RN",
    officeCity: "X/RN",
    contactName: "Fulano",
    contactPhone: "(84) 99999-0000",
    seats: "20",
  };
  assert.ok(
    cohortUpdateSchema.safeParse({ ...base, lastDay: "2027-01-31" }).success,
  );
  assert.equal(
    cohortUpdateSchema.safeParse({ ...base, lastDay: "31/01/2027" }).success,
    false,
  );
});

test("seats never go below the learners already in", () => {
  assert.ok(seatsFit(9, 9));
  assert.ok(seatsFit(10, 9));
  assert.equal(seatsFit(8, 9), false);
});

test("a learner gives a full name, an e-mail and a password", () => {
  const parsed = cohortJoinSchema.parse({
    fullName: " Maria   Souza ",
    email: " Maria@Exemplo.COM ",
    password: "segredo123",
    contactConsent: false,
  });
  assert.equal(parsed.fullName, "Maria Souza");
  assert.equal(parsed.email, "maria@exemplo.com");
  const bad = (patch: object) =>
    cohortJoinSchema.safeParse({
      fullName: "Maria Souza",
      email: "maria@exemplo.com",
      password: "segredo123",
      contactConsent: true,
      ...patch,
    }).success;
  assert.equal(bad({ fullName: "Maria" }), false);
  assert.equal(bad({ email: "maria" }), false);
  assert.equal(bad({ password: "curta" }), false);
});

test("a learner's status is the furthest point reached", () => {
  const none = {
    certified: false,
    passed: false,
    attemptOpen: false,
    submitted: false,
  };
  assert.equal(learnerStatus(none), "not-taken");
  assert.equal(learnerStatus({ ...none, attemptOpen: true }), "in-attempt");
  assert.equal(learnerStatus({ ...none, submitted: true }), "failed");
  assert.equal(
    learnerStatus({ ...none, submitted: true, attemptOpen: true }),
    "in-attempt",
  );
  assert.equal(
    learnerStatus({ ...none, submitted: true, passed: true }),
    "passed",
  );
  assert.equal(
    learnerStatus({ ...none, submitted: true, passed: true, certified: true }),
    "certified",
  );
});
