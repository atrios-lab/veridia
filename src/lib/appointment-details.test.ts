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
  addAppointmentAttachmentsWith,
  addAppointmentNoteWith,
  addOfficeAppointmentAttachmentsWith,
  bookAppointmentWith,
  correctAppointmentWith,
  listAppointmentAttachmentsWith,
  listAppointmentNotesWith,
  type NewAppointment,
} from "./appointments.ts";

let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

const TENANT = TENANTS["cartorio-marinho"];

// Fictitious people only (LGPD): nobody's real data in a test.
const appointment = (slotTime: string): NewAppointment => ({
  date: "2098-05-12",
  slotTime,
  citizenName: "Maria Exemplo da Silva",
  email: "maria@exemplo.com",
  phone: "(84) 99999-0000",
  serviceId: "rcpn-certidao",
  serviceLabel: "Certidão",
  mode: "presencial",
  serviceDetails: "Preciso da segunda via.",
  cancelTokenHash: hashCancelToken(generateCancelToken()),
});

const file = (name: string) => ({
  storedName: name,
  displayName: name,
  path: `/tmp/${name}`,
  mimeType: "application/pdf",
  sizeBytes: 10,
});

test("anotações internas ficam no agendamento, com autor, e só da serventia dona", async () => {
  const booked = await bookAppointmentWith(
    db,
    TENANT.slug,
    appointment("09:00"),
  );
  const author = { id: "u1", name: "Atendente Exemplo" };
  assert.equal(
    await addAppointmentNoteWith(
      db,
      TENANT.slug,
      booked.id,
      author,
      "Liga antes.",
    ),
    true,
  );
  assert.equal(
    await addAppointmentNoteWith(db, "outra", booked.id, author, "Não pode."),
    false,
  );
  const notes = await listAppointmentNotesWith(db, TENANT.slug, booked.id);
  assert.deepEqual(
    notes.map((note) => [note.body, note.authorName]),
    [["Liga antes.", "Atendente Exemplo"]],
  );
});

test("o anexo da serventia não aparece na consulta do cliente", async () => {
  const booked = await bookAppointmentWith(
    db,
    TENANT.slug,
    appointment("10:00"),
  );
  await addAppointmentAttachmentsWith(db, TENANT.slug, booked.id, [
    file("do-cliente.pdf"),
  ]);
  await addOfficeAppointmentAttachmentsWith(
    db,
    TENANT.slug,
    booked.id,
    [file("interno.pdf")],
    "u1",
  );
  const all = await listAppointmentAttachmentsWith(db, TENANT.slug, [
    booked.id,
  ]);
  assert.deepEqual(
    all.map((f) => f.displayName),
    ["do-cliente.pdf", "interno.pdf"],
  );
  const citizen = await listAppointmentAttachmentsWith(
    db,
    TENANT.slug,
    [booked.id],
    {
      citizenOnly: true,
    },
  );
  assert.deepEqual(
    citizen.map((f) => f.displayName),
    ["do-cliente.pdf"],
  );
});

test("a serventia corrige os dados do cliente sem mexer no dia e no horário", async () => {
  const booked = await bookAppointmentWith(
    db,
    TENANT.slug,
    appointment("11:00"),
  );
  const fixed = await correctAppointmentWith(
    db,
    TENANT.slug,
    booked.id,
    {
      citizenName: "Maria Exemplo de Souza",
      email: "maria.souza@exemplo.com",
      phone: "(84) 98888-0000",
      cpf: "52998224725",
      serviceId: "rcpn-certidao",
      serviceLabel: "Certidão",
      mode: "presencial",
      serviceDetails: null,
    },
    "u1",
  );
  assert.equal(fixed?.citizenName, "Maria Exemplo de Souza");
  assert.equal(fixed?.cpf, "52998224725");
  assert.equal(fixed?.serviceDetails, null);
  assert.equal(fixed?.slotTime, "11:00");
  assert.equal(fixed?.date, "2098-05-12");
  assert.equal(
    await correctAppointmentWith(
      db,
      "outra",
      booked.id,
      {
        citizenName: "Outra Pessoa",
        email: "",
        phone: "(84) 90000-0000",
        cpf: null,
        serviceId: "rcpn-certidao",
        serviceLabel: "Certidão",
        mode: "presencial",
        serviceDetails: null,
      },
      "u1",
    ),
    undefined,
  );
});
