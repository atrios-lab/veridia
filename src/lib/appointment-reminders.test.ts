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
  agendaAlertSnapshotWith,
  awaitingConfirmationWith,
  claimDaySummaryWith,
  claimDueRemindersWith,
} from "./appointment-reminders.ts";
import {
  bookAppointmentWith,
  cancelAppointmentWith,
  markAttendedWith,
  markNoShowWith,
  type NewAppointment,
} from "./appointments.ts";

const TENANT = TENANTS["cartorio-marinho"];

let db: Database;
let close: () => Promise<void>;

before(async () => {
  ({ db, close } = await createTestDb());
});

after(async () => {
  await close();
});

function booking(overrides: Partial<NewAppointment>): NewAppointment {
  return {
    date: "2099-05-11",
    slotTime: "09:00",
    citizenName: "Ana Lembrete",
    email: "ana@exemplo.com",
    phone: "(84) 99999-0000",
    serviceId: "rcpn.segunda-via",
    serviceLabel: "Certidão (2ª via)",
    mode: "Presencial",
    cancelTokenHash: hashCancelToken(generateCancelToken()),
    ...overrides,
  };
}

test("each citizen's reminder is claimed once, cancelled ones never", async () => {
  await bookAppointmentWith(db, TENANT.slug, booking({ slotTime: "09:00" }));
  await bookAppointmentWith(
    db,
    TENANT.slug,
    booking({ slotTime: "10:00", agenda: "tabeliao", citizenName: "Bia" }),
  );
  const gone = await bookAppointmentWith(
    db,
    TENANT.slug,
    booking({ slotTime: "11:00", citizenName: "Caio" }),
  );
  await cancelAppointmentWith(db, TENANT.slug, gone.id);
  // Another day is not this day's reminder.
  await bookAppointmentWith(
    db,
    TENANT.slug,
    booking({ date: "2099-05-12", slotTime: "09:00", citizenName: "Davi" }),
  );

  const first = await claimDueRemindersWith(db, TENANT.slug, "2099-05-11");
  assert.deepEqual(first.map((a) => a.citizenName).sort(), [
    "Ana Lembrete",
    "Bia",
  ]);
  assert.ok(first.every((a) => a.reminderSentAt instanceof Date));
  // The job and a panel running again find nothing left to send.
  assert.deepEqual(
    await claimDueRemindersWith(db, TENANT.slug, "2099-05-11"),
    [],
  );
});

test("the office's summary of a day is claimed once per day", async () => {
  assert.equal(await claimDaySummaryWith(db, TENANT.slug, "2099-05-11"), true);
  assert.equal(await claimDaySummaryWith(db, TENANT.slug, "2099-05-11"), false);
  assert.equal(await claimDaySummaryWith(db, TENANT.slug, "2099-05-12"), true);
});

test("the panel's snapshot has today's appointments and the site's new bookings", async () => {
  const snapshot = await agendaAlertSnapshotWith(db, TENANT.slug, {
    date: "2099-05-11",
    time: "08:50",
  });
  assert.deepEqual(
    snapshot.today.map((item) => [item.slotTime, item.agendaName]),
    [
      ["09:00", "Cartório"],
      ["10:00", "Tabelião"],
    ],
  );
  // Booked just now on the site, still live: Caio was cancelled.
  const names = snapshot.recent.map((item) => item.citizenName);
  assert.ok(names.includes("Davi"));
  assert.ok(!names.includes("Caio"));
});

test("an hour that is over and still booked waits for the office to confirm", async () => {
  const day = "2099-09-10";
  const done = await bookAppointmentWith(
    db,
    TENANT.slug,
    booking({ date: day, slotTime: "08:00", citizenName: "Passou" }),
  );
  await bookAppointmentWith(
    db,
    TENANT.slug,
    booking({ date: day, slotTime: "10:00", citizenName: "Em curso" }),
  );
  await bookAppointmentWith(
    db,
    TENANT.slug,
    booking({ date: "2099-09-09", slotTime: "14:00", citizenName: "Ontem" }),
  );
  const marked = await bookAppointmentWith(
    db,
    TENANT.slug,
    booking({
      date: "2099-09-09",
      slotTime: "15:00",
      citizenName: "Já marcado",
    }),
  );
  await markAttendedWith(db, TENANT.slug, marked.id, "staff");

  // 10:30: the 08:00 is over (it ended at 09:00), the 10:00 is still on.
  const now = { date: day, time: "10:30" };
  const pending = await awaitingConfirmationWith(db, TENANT.slug, now);
  assert.deepEqual(
    pending.map((a) => a.citizenName),
    ["Ontem", "Passou"],
  );
  const snapshot = await agendaAlertSnapshotWith(db, TENANT.slug, now);
  assert.deepEqual(
    snapshot.pending.map((item) => item.id).includes(done.id),
    true,
  );
  // Once marked, it is no longer asked about.
  await markNoShowWith(db, TENANT.slug, done.id, "staff");
  assert.deepEqual(
    (await awaitingConfirmationWith(db, TENANT.slug, now)).map(
      (a) => a.citizenName,
    ),
    ["Ontem"],
  );
});
