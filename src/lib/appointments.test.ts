import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import {
  generateCancelToken,
  hashCancelToken,
} from "@/core/scheduling/appointment.ts";
import { TENANTS } from "@/core/tenant/resolve.ts";
import type { Database } from "@/db/index.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  appointmentsOnWith,
  bookAppointmentWith,
  cancelAppointmentWith,
  cancelDayWith,
  findByCancelTokenWith,
  markAttendedWith,
  markNoShowWith,
  type NewAppointment,
  SlotTakenError,
} from "./appointments.ts";

// Migrated from e2e/channels.spec.ts, "agendar" ("a booked time is confirmed
// on the spot and leaves the offer", "a cancellation link that matches
// nothing answers neutrally"): the write path Playwright drove through a
// form, exercised directly here.

const TENANT = TENANTS["cartorio-marinho"];

let db: Database;
let close: () => Promise<void>;

before(async () => {
  ({ db, close } = await createTestDb());
});

after(async () => {
  await close();
});

function newAppointment(
  overrides: Partial<NewAppointment> = {},
): NewAppointment {
  return {
    date: "2098-03-10",
    slotTime: "09:00",
    citizenName: "Maria José da Silva",
    email: "maria@exemplo.com",
    phone: "(84) 99999-0000",
    serviceId: "rcpn-certidao",
    serviceLabel: "Certidão",
    mode: "presencial",
    cancelTokenHash: hashCancelToken(generateCancelToken()),
    ...overrides,
  };
}

test("a booked time gets a protocol and is found back by its own cancel token", async () => {
  const token = generateCancelToken();
  const booked = await bookAppointmentWith(
    db,
    TENANT.slug,
    newAppointment({ cancelTokenHash: hashCancelToken(token) }),
  );

  assert.ok(booked.protocolNumber);
  assert.match(booked.protocolNumber, /^AGD\.\d{4}\.\d{6}$/);
  assert.equal(booked.status, "booked");

  const found = await findByCancelTokenWith(db, TENANT.slug, token);
  assert.ok(found);
  assert.equal(found.id, booked.id);
});

test("a second booking for the same date and time is refused as taken", async () => {
  const slot = newAppointment({ date: "2098-03-11" });
  await bookAppointmentWith(db, TENANT.slug, slot);

  await assert.rejects(
    bookAppointmentWith(db, TENANT.slug, {
      ...slot,
      citizenName: "Outro Cidadão",
      email: "outro@exemplo.com",
      cancelTokenHash: hashCancelToken(generateCancelToken()),
    }),
    SlotTakenError,
  );
});

test("a cancel token that matches nothing (already cancelled, or never existed) finds nothing", async () => {
  const token = generateCancelToken();
  const booked = await bookAppointmentWith(
    db,
    TENANT.slug,
    newAppointment({
      date: "2098-03-12",
      cancelTokenHash: hashCancelToken(token),
    }),
  );
  await cancelAppointmentWith(db, TENANT.slug, booked.id);

  // The same token, after the appointment it named is already cancelled:
  // this is what a cancellation link clicked twice looks like.
  const foundAfter = await findByCancelTokenWith(db, TENANT.slug, token);
  assert.equal(foundAfter, undefined);

  // A token that was never issued at all answers the same way.
  const neverIssued = await findByCancelTokenWith(
    db,
    TENANT.slug,
    generateCancelToken(),
  );
  assert.equal(neverIssued, undefined);
});

test("cancelling twice cancels once: the second attempt finds nothing live to cancel", async () => {
  const booked = await bookAppointmentWith(
    db,
    TENANT.slug,
    newAppointment({
      date: "2098-03-13",
    }),
  );

  const first = await cancelAppointmentWith(db, TENANT.slug, booked.id);
  assert.ok(first);
  assert.equal(first.status, "cancelled");

  const second = await cancelAppointmentWith(db, TENANT.slug, booked.id);
  assert.equal(second, undefined);
});

// Migrated from e2e/admin-agenda.spec.ts: marking attended or no-show, and
// closing a whole day, all guarded by the same "still booked" check
// cancelling one appointment already uses.

test("marking attended or no-show only ever touches a still-booked appointment", async () => {
  const attended = await bookAppointmentWith(
    db,
    TENANT.slug,
    newAppointment({ date: "2098-04-01" }),
  );
  await markAttendedWith(db, TENANT.slug, attended.id, "staff-1");

  const noShow = await bookAppointmentWith(
    db,
    TENANT.slug,
    newAppointment({ date: "2098-04-01", slotTime: "09:20" }),
  );
  await markNoShowWith(db, TENANT.slug, noShow.id, "staff-1");

  // Already attended: marking it no-show again does nothing, the guard is
  // the live status, not the id alone.
  await markNoShowWith(db, TENANT.slug, attended.id, "staff-1");

  const [stillAttended] = await appointmentsOnWith(
    db,
    TENANT.slug,
    "2098-04-01",
  );
  assert.equal(stillAttended.status, "attended");
});

test("closing the day cancels every live appointment on it, with one reason", async () => {
  await bookAppointmentWith(
    db,
    TENANT.slug,
    newAppointment({ date: "2098-04-02" }),
  );
  await bookAppointmentWith(
    db,
    TENANT.slug,
    newAppointment({ date: "2098-04-02", slotTime: "09:20" }),
  );
  const untouched = await bookAppointmentWith(
    db,
    TENANT.slug,
    newAppointment({ date: "2098-04-03" }),
  );

  const cancelled = await cancelDayWith(
    db,
    TENANT.slug,
    "2098-04-02",
    "Serventia fechada por falta de energia.",
    "staff-1",
  );
  assert.equal(cancelled.length, 2);
  assert.ok(cancelled.every((a) => a.status === "cancelled"));
  assert.ok(
    cancelled.every(
      (a) => a.cancelReason === "Serventia fechada por falta de energia.",
    ),
  );

  const other = await appointmentsOnWith(db, TENANT.slug, "2098-04-03");
  assert.equal(other[0]?.id, untouched.id);
  assert.equal(other[0]?.status, "booked");
});
