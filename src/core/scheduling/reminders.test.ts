import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildAppointmentReminderEmail,
  buildOfficeDaySummaryEmail,
  buildOfficeNewAppointmentEmail,
  reminderDay,
} from "./reminders.ts";

test("the reminder looks at tomorrow, weekends included", () => {
  assert.equal(
    reminderDay({ date: "2026-11-08", time: "10:00" }),
    "2026-11-09",
  );
  assert.equal(
    reminderDay({ date: "2026-12-31", time: "10:00" }),
    "2027-01-01",
  );
});

test("the citizen's reminder says when, how to arrive and what to bring", () => {
  const email = buildAppointmentReminderEmail({
    officeName: "Cartório Exemplo",
    officeEmail: "contato@exemplo.com",
    citizenName: "Maria Souza",
    date: "2026-11-10",
    slotTime: "09:00",
    serviceLabel: "Testamento",
    mode: "Presencial",
    agendaName: "Atendimento com o tabelião",
    address: "Rua das Flores, 10",
    checklist: ["Documento com foto", "Duas testemunhas"],
    protocolNumber: "AGD.2026.000003",
  });
  assert.match(email.subject, /^Lembrete: atendimento .* às 09:00$/);
  const text = email.paragraphs.join("\n");
  assert.match(text, /Maria, lembramos/);
  assert.match(text, /às 08:45/);
  assert.match(text, /• Duas testemunhas/);
  assert.match(text, /contato@exemplo\.com/);
  assert.match(text, /AGD\.2026\.000003/);
});

test("the office's summary lists the day in time order", () => {
  const line = {
    citizenName: "X",
    serviceLabel: "Procuração",
    mode: "Por vídeo",
    agendaName: "Tabelião",
    phone: "(84) 9",
    protocolNumber: null,
  };
  const email = buildOfficeDaySummaryEmail("Cartório Exemplo", "2026-11-10", [
    { ...line, slotTime: "14:00", citizenName: "Bruno" },
    { ...line, slotTime: "09:00", citizenName: "Ana" },
  ]);
  assert.match(email.subject, /2 agendamentos$/);
  const items = email.paragraphs.filter((p) => p.startsWith("•"));
  assert.match(items[0], /^• 09:00 · Ana/);
  assert.match(
    items[1],
    /^• 14:00 · Bruno · Procuração · Tabelião \(Por vídeo\)/,
  );

  const fresh = buildOfficeNewAppointmentEmail(
    "Cartório Exemplo",
    "2026-11-10",
    {
      ...line,
      slotTime: "09:00",
      citizenName: "Ana",
      details: "Quero fazer uma procuração.",
    },
  );
  assert.match(fresh.subject, /^Novo agendamento: Ana/);
  assert.ok(
    fresh.paragraphs.includes("O que informou: Quero fazer uma procuração."),
  );
});
