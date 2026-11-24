import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import {
  generateCancelToken,
  hashCancelToken,
} from "@/core/scheduling/appointment.ts";
import {
  openRequirements,
  questionsOpen,
  shownRows,
} from "@/core/scheduling/conversation.ts";
import { TENANTS } from "@/core/tenant/resolve.ts";
import type { Database } from "@/db/index.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  addCitizenMessageWith,
  addOfficeEntryWith,
  ConversationError,
  editOfficeEntryWith,
  hideEntryWith,
  listAppointmentMessagesWith,
  resolveRequirementWith,
  setQuestionsWith,
} from "./appointment-messages.ts";
import { bookAppointmentWith } from "./appointments.ts";

let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

const TENANT = TENANTS["cartorio-marinho"];
const OFFICE = { id: "u-escrevente", name: "Escrevente Fictícia" };

// Fictitious people only (LGPD).
async function book(slotTime: string) {
  return bookAppointmentWith(db, TENANT.slug, {
    date: "2098-05-12",
    slotTime,
    citizenName: "João Exemplo Lima",
    email: "joao@exemplo.com",
    phone: "(84) 99999-0000",
    serviceId: "enotariado.certificado",
    serviceLabel: "Emissão do Certificado Digital Notarizado",
    mode: "Presencial",
    cancelTokenHash: hashCancelToken(generateCancelToken()),
  });
}

test("exigência: abre, altera guardando o texto, cumpre e apaga só ocultando", async () => {
  const appointment = await book("09:00");
  await addOfficeEntryWith(
    db,
    TENANT.slug,
    appointment.id,
    "requirement",
    "Envie a certidão de casamento atualizada.",
    OFFICE,
  );
  let rows = await listAppointmentMessagesWith(db, TENANT.slug, appointment.id);
  assert.equal(openRequirements(rows).length, 1);
  const [requirement] = rows;

  await editOfficeEntryWith(
    db,
    TENANT.slug,
    requirement.id,
    "Envie a certidão de casamento atualizada, em PDF.",
    OFFICE,
  );
  rows = await listAppointmentMessagesWith(db, TENANT.slug, appointment.id);
  assert.equal(
    rows[0].body,
    "Envie a certidão de casamento atualizada, em PDF.",
  );
  assert.equal(
    (rows[0].history as { body: string }[])[0].body,
    "Envie a certidão de casamento atualizada.",
  );

  await resolveRequirementWith(db, TENANT.slug, requirement.id, true, OFFICE);
  rows = await listAppointmentMessagesWith(db, TENANT.slug, appointment.id);
  assert.equal(openRequirements(rows).length, 0);

  await hideEntryWith(db, TENANT.slug, requirement.id, OFFICE);
  rows = await listAppointmentMessagesWith(db, TENANT.slug, appointment.id);
  assert.equal(shownRows(rows).length, 0);
  // The row stays.
  assert.equal(rows.length, 1);
});

test("perguntas: o cliente só escreve com elas abertas, e não depois de fechadas", async () => {
  const appointment = await book("10:00");
  await assert.rejects(
    addCitizenMessageWith(db, TENANT.slug, appointment, true, "Posso ir?"),
    ConversationError,
  );
  // Writing to the citizen opens them.
  await addOfficeEntryWith(
    db,
    TENANT.slug,
    appointment.id,
    "message",
    "Você já tem cadastro no e-Notariado?",
    OFFICE,
  );
  let rows = await listAppointmentMessagesWith(db, TENANT.slug, appointment.id);
  assert.equal(questionsOpen(rows), true);
  await addCitizenMessageWith(
    db,
    TENANT.slug,
    appointment,
    true,
    "Ainda não, faço antes do horário.",
  );
  // A past appointment takes no answer, even with them open.
  await assert.rejects(
    addCitizenMessageWith(db, TENANT.slug, appointment, false, "Outra coisa"),
    ConversationError,
  );
  await setQuestionsWith(db, TENANT.slug, appointment.id, false, OFFICE);
  rows = await listAppointmentMessagesWith(db, TENANT.slug, appointment.id);
  assert.equal(questionsOpen(rows), false);
  await assert.rejects(
    addCitizenMessageWith(db, TENANT.slug, appointment, true, "Mais uma"),
    ConversationError,
  );
  // The office cannot rewrite what the citizen said.
  const citizen = rows.find((row) => row.authorType === "citizen");
  assert.ok(citizen);
  await assert.rejects(
    editOfficeEntryWith(db, TENANT.slug, citizen.id, "Outro texto", OFFICE),
    ConversationError,
  );
});
