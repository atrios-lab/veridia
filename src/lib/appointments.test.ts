import assert from "node:assert/strict";
import { after, before, mock, test } from "node:test";
import { eq } from "drizzle-orm";
import { generateAccessKey, hashAccessKey } from "@/core/request/access-key.ts";
import {
  generateCancelToken,
  hashCancelToken,
} from "@/core/scheduling/appointment.ts";
import { TENANTS } from "@/core/tenant/resolve.ts";
import { user } from "@/db/auth-schema.ts";
import type { Database } from "@/db/index.ts";
import { appointments } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  addAppointmentAttachmentsWith,
  addAppointmentNoteWith,
  appointmentsOnWith,
  bookAppointmentWith,
  cancelAppointmentWith,
  cancelDayWith,
  findAppointmentByProtocolWithKeyWith,
  findByCancelTokenWith,
  listAppointmentAttachmentsWith,
  listAppointmentNotesWith,
  markAttendedWith,
  markNoShowWith,
  type NewAppointment,
  recoverAppointmentKeyWith,
  removeAppointmentWith,
  revertAppointmentWith,
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

test("what the citizen wrote is stored, and a booking without it stays null", async () => {
  const written = await bookAppointmentWith(
    db,
    TENANT.slug,
    newAppointment({
      slotTime: "10:00",
      date: "2098-03-11",
      serviceDetails: "Segunda via da certidão de casamento.",
    }),
  );
  assert.equal(written.serviceDetails, "Segunda via da certidão de casamento.");

  // The shape of a desk reservation and of every appointment before the field.
  const without = await bookAppointmentWith(
    db,
    TENANT.slug,
    newAppointment({ slotTime: "11:00", date: "2098-03-11" }),
  );
  assert.equal(without.serviceDetails, null);
});

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

async function atInstant<T>(iso: string, run: () => Promise<T>): Promise<T> {
  const zone = process.env.TZ;
  process.env.TZ = "UTC";
  mock.timers.enable({ apis: ["Date"], now: new Date(iso) });
  try {
    return await run();
  } finally {
    mock.timers.reset();
    if (zone === undefined) delete process.env.TZ;
    else process.env.TZ = zone;
  }
}

test("a booking's protocol carries the office's year, with the server in UTC", async () => {
  // 22:00 on 31 December at the office, already next year in UTC.
  const lastNight = await atInstant("2027-01-01T01:00:00Z", () =>
    bookAppointmentWith(
      db,
      TENANT.slug,
      newAppointment({ date: "2098-05-12" }),
    ),
  );
  assert.match(lastNight.protocolNumber ?? "", /^AGD\.2026\./);

  // 00:10 on 1 January at the office.
  const firstMorning = await atInstant("2027-01-01T03:10:00Z", () =>
    bookAppointmentWith(
      db,
      TENANT.slug,
      newAppointment({ date: "2098-05-13" }),
    ),
  );
  assert.match(firstMorning.protocolNumber ?? "", /^AGD\.2027\./);
});

test("the access key opens the appointment, and only the right key does", async () => {
  const key = generateAccessKey();
  const booked = await bookAppointmentWith(
    db,
    TENANT.slug,
    newAppointment({
      date: "2098-05-04",
      slotTime: "08:00",
      accessKeyHash: hashAccessKey(key),
    }),
  );
  const protocol = booked.protocolNumber ?? "";
  // Only the hash is kept.
  assert.notEqual(booked.accessKeyHash, key);
  const opened = await findAppointmentByProtocolWithKeyWith(
    db,
    TENANT.slug,
    protocol,
    key,
  );
  assert.equal(opened?.id, booked.id);
  assert.equal(
    await findAppointmentByProtocolWithKeyWith(
      db,
      TENANT.slug,
      protocol,
      generateAccessKey(),
    ),
    undefined,
  );
});

test("an appointment without a key opens to nobody until one is recovered by e-mail", async () => {
  const booked = await bookAppointmentWith(
    db,
    TENANT.slug,
    newAppointment({ date: "2098-05-04", slotTime: "08:15" }),
  );
  const protocol = booked.protocolNumber ?? "";
  assert.equal(booked.accessKeyHash, null);

  const wrong = await recoverAppointmentKeyWith(
    db,
    TENANT.slug,
    protocol,
    "outra@exemplo.com",
  );
  assert.equal(wrong.reissued, false);

  const recovered = await recoverAppointmentKeyWith(
    db,
    TENANT.slug,
    protocol,
    "MARIA@exemplo.com",
  );
  assert.equal(recovered.reissued, true);
  assert.equal(recovered.email, "maria@exemplo.com");
  const opened = await findAppointmentByProtocolWithKeyWith(
    db,
    TENANT.slug,
    protocol,
    recovered.accessKey ?? "",
  );
  assert.equal(opened?.id, booked.id);
});

test("documents sent ahead stay with the appointment", async () => {
  const booked = await bookAppointmentWith(
    db,
    TENANT.slug,
    newAppointment({ date: "2098-05-04", slotTime: "08:30" }),
  );
  await addAppointmentAttachmentsWith(db, TENANT.slug, booked.id, [
    {
      storedName: "a.pdf",
      displayName: "RG.pdf",
      path: "/tmp/a.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1200,
    },
  ]);
  const files = await listAppointmentAttachmentsWith(db, TENANT.slug, [
    booked.id,
  ]);
  assert.deepEqual(
    files.map((file) => file.displayName),
    ["RG.pdf"],
  );
  assert.deepEqual(
    await listAppointmentAttachmentsWith(db, "outro-cartorio", [booked.id]),
    [],
  );
});

test("marcou atendido sem querer: desfazer volta para agendado", async () => {
  const booked = await bookAppointmentWith(
    db,
    TENANT.slug,
    newAppointment({ date: "2098-06-01", slotTime: "08:00" }),
  );
  await markAttendedWith(db, TENANT.slug, booked.id, "operadora");
  assert.equal(
    await revertAppointmentWith(db, TENANT.slug, booked.id, "operadora"),
    true,
  );
  const [row] = await appointmentsOnWith(db, TENANT.slug, "2098-06-01");
  assert.equal(row.status, "booked");
  // Agendado não tem o que desfazer.
  assert.equal(
    await revertAppointmentWith(db, TENANT.slug, booked.id, "operadora"),
    false,
  );
});

test("excluir tira da agenda e libera o horário, sem apagar o registro", async () => {
  const booked = await bookAppointmentWith(
    db,
    TENANT.slug,
    newAppointment({ date: "2098-06-02", slotTime: "08:00" }),
  );
  await markAttendedWith(db, TENANT.slug, booked.id, "operadora");
  assert.equal(
    await removeAppointmentWith(db, TENANT.slug, booked.id, "operadora"),
    true,
  );
  assert.deepEqual(await appointmentsOnWith(db, TENANT.slug, "2098-06-02"), []);
  // O horário volta a ser marcável.
  const again = await bookAppointmentWith(
    db,
    TENANT.slug,
    newAppointment({ date: "2098-06-02", slotTime: "08:00" }),
  );
  assert.ok(again.id);
  // O registro continua no banco, cancelado e marcado como excluído.
  const [kept] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, booked.id));
  assert.equal(kept.status, "cancelled");
  assert.ok(kept.removedAt);
});

test("um horário com 3 vagas recebe 3 cidadãos, e o quarto encontra o horário cheio", async () => {
  const at = { date: "2098-07-01", slotTime: "08:00" };
  const seats: number[] = [];
  for (let i = 0; i < 3; i++) {
    const booked = await bookAppointmentWith(
      db,
      TENANT.slug,
      newAppointment(at),
      null,
      3,
    );
    seats.push(booked.seat);
  }
  assert.deepEqual(seats.sort(), [1, 2, 3]);
  await assert.rejects(
    bookAppointmentWith(db, TENANT.slug, newAppointment(at), null, 3),
    SlotTakenError,
  );
});

test("as duas agendas têm vagas próprias no mesmo horário", async () => {
  const at = { date: "2098-07-02", slotTime: "09:00" };
  await bookAppointmentWith(db, TENANT.slug, newAppointment(at), null, 1);
  // O cartório lotou o seu 09:00; o tabelião ainda recebe no dele.
  await assert.rejects(
    bookAppointmentWith(db, TENANT.slug, newAppointment(at), null, 1),
    SlotTakenError,
  );
  const notary = await bookAppointmentWith(
    db,
    TENANT.slug,
    newAppointment({ ...at, agenda: "tabeliao" }),
    null,
    1,
  );
  assert.equal(notary.seat, 2);
});

test("cancelar devolve a vaga", async () => {
  const at = { date: "2098-07-03", slotTime: "10:00" };
  const first = await bookAppointmentWith(
    db,
    TENANT.slug,
    newAppointment(at),
    null,
    2,
  );
  await bookAppointmentWith(db, TENANT.slug, newAppointment(at), null, 2);
  await removeAppointmentWith(db, TENANT.slug, first.id, "operadora");
  const again = await bookAppointmentWith(
    db,
    TENANT.slug,
    newAppointment(at),
    null,
    2,
  );
  assert.equal(again.seat, 1);
});

test("a nota da conta Átrios num agendamento não aparece para a serventia", async () => {
  // Fictitious accounts only (LGPD).
  await db.insert(user).values([
    {
      id: "nota-escrevente",
      name: "João Fictício de Souza",
      email: "joao.nota@exemplo.com",
      tenantSlug: TENANT.slug,
      role: "staff",
    },
    {
      id: "nota-plataforma",
      name: "Átrios",
      email: "mestre.nota@exemplo.com",
      tenantSlug: "atrios",
      role: "superadmin",
    },
  ]);
  const booked = await bookAppointmentWith(
    db,
    TENANT.slug,
    newAppointment({ date: "2098-04-02", slotTime: "11:00" }),
  );
  await addAppointmentNoteWith(
    db,
    TENANT.slug,
    booked.id,
    { id: "nota-escrevente", name: "João Fictício de Souza" },
    "Cliente avisou que chega 10 minutos antes.",
  );
  await addAppointmentNoteWith(
    db,
    TENANT.slug,
    booked.id,
    { id: "nota-plataforma", name: "Átrios" },
    "Teste da plataforma.",
  );
  const office = await listAppointmentNotesWith(db, TENANT.slug, booked.id);
  assert.deepEqual(
    office.map((note) => note.authorName),
    ["João Fictício de Souza"],
  );
  const atrios = await listAppointmentNotesWith(
    db,
    TENANT.slug,
    booked.id,
    true,
  );
  assert.equal(atrios.length, 2);
});
