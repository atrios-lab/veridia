import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCalendarEvent } from "../scheduling/ics.ts";
import {
  appointmentSchema,
  dataRightOption,
  dataRightsDayOfDeadline,
  dataRightsDeadline,
  dataRightsSchema,
  isAnonymous,
  manifestationLabel,
  ombudsmanSchema,
} from "./channels.ts";
import { parseDetails, statusLabel } from "./kinds.ts";

const appointment = appointmentSchema({
  serviceIds: ["procuracao", "tabeliao"],
  modes: ["Presencial", "On-line"],
});

const validBooking = {
  date: "2026-08-06",
  slotTime: "09:00",
  citizenName: "  Antônio  Ferreira Lima ",
  email: "antonio@email.com",
  phone: "(84) 98888-1212",
  cpf: "",
  serviceId: "procuracao",
  mode: "Presencial",
};

test("an appointment needs a day, a time, an e-mail and a phone", () => {
  const parsed = appointment.parse(validBooking);
  assert.equal(parsed.citizenName, "Antônio Ferreira Lima");
  assert.equal(parsed.slotTime, "09:00");
  // Optional on purpose: most counter visits do not need it up front.
  assert.equal(parsed.cpf, undefined);
});

test("the e-mail is required: it is the appointment's only channel", () => {
  assert.equal(
    appointment.safeParse({ ...validBooking, email: "" }).success,
    false,
  );
  assert.equal(
    appointment.safeParse({ ...validBooking, email: "não é e-mail" }).success,
    false,
  );
  assert.equal(
    appointment.safeParse({ ...validBooking, phone: "123" }).success,
    false,
  );
});

test("service and mode are checked against what the office offers", () => {
  assert.equal(
    appointment.safeParse({ ...validBooking, serviceId: "inventado" }).success,
    false,
  );
  assert.equal(
    appointment.safeParse({ ...validBooking, mode: "Teleporte" }).success,
    false,
  );
});

test("a malformed time is refused before it reaches the database", () => {
  for (const slotTime of ["9", "9h", "25:00", "09:60", ""]) {
    assert.equal(
      appointment.safeParse({ ...validBooking, slotTime }).success,
      false,
      `aceitou "${slotTime}"`,
    );
  }
});

test("a data rights request needs the holder's declaration", () => {
  const base = {
    right: "access",
    applicantName: "Maria José da Silva",
    email: "maria@email.com",
    cpf: "",
    description: "Quero saber quais dados constam do meu cadastro.",
  };
  assert.equal(
    dataRightsSchema.safeParse({ ...base, holderDeclaration: "" }).success,
    false,
  );
  const parsed = dataRightsSchema.parse({ ...base, holderDeclaration: "on" });
  assert.equal(parsed.cpf, undefined);
  assert.equal(parsed.right, "access");
});

test("the legal term is fifteen days, counted from the day it was asked", () => {
  assert.equal(dataRightsDeadline("2026-08-04"), "2026-08-19");
  assert.equal(dataRightsDayOfDeadline("2026-08-04", "2026-08-04"), 1);
  assert.equal(dataRightsDayOfDeadline("2026-08-04", "2026-08-11"), 8);
  // Past the term it keeps counting, instead of hiding the case that matters.
  assert.equal(dataRightsDayOfDeadline("2026-08-04", "2026-08-25"), 22);
});

test("every right is named in the citizen's own words", () => {
  assert.equal(
    dataRightOption("deletion").label,
    "Excluir dados que não são obrigatórios",
  );
  assert.equal(dataRightOption("deletion").legalName, "Exclusão");
  assert.equal(manifestationLabel("complaint"), "Reclamação");
});

test("a manifestation is anonymous when nobody signed it", () => {
  const anonymous = ombudsmanSchema.parse({
    manifestationType: "complaint",
    message: "Demora no atendimento do dia 28/07.",
    applicantName: "",
    contact: "",
    confidential: "",
  });
  assert.equal(anonymous.applicantName, undefined);
  assert.equal(isAnonymous(anonymous), true);

  const signed = ombudsmanSchema.parse({
    manifestationType: "complaint",
    message: "Demora no atendimento.",
    applicantName: "Maria",
    contact: "maria@email.com",
    confidential: "on",
  });
  assert.equal(isAnonymous(signed), false);
  assert.equal(signed.confidential, true);
});

test("a manifestation needs a type and a message", () => {
  assert.equal(
    ombudsmanSchema.safeParse({
      manifestationType: "complaint",
      message: "   ",
      applicantName: "",
      contact: "",
      confidential: "",
    }).success,
    false,
  );
  assert.equal(
    ombudsmanSchema.safeParse({
      manifestationType: "elogio",
      message: "Obrigado.",
      applicantName: "",
      contact: "",
      confidential: "",
    }).success,
    false,
  );
});

test("a contact that was filled in still has to be reachable", () => {
  assert.equal(
    ombudsmanSchema.safeParse({
      manifestationType: "praise",
      message: "Obrigado pelo atendimento.",
      applicantName: "Maria",
      contact: "123",
      confidential: "",
    }).success,
    false,
  );
});

test("details are parsed by kind, never read raw", () => {
  const details = parseDetails("appointment", {
    date: "2026-08-06",
    slotHour: 9,
  });
  assert.equal(details.date, "2026-08-06");
  assert.throws(() => parseDetails("appointment", { date: "06/08/2026" }));
  assert.throws(() => parseDetails("data-rights", { right: "acesso" }));
});

test("status is named per kind, and never leaks a raw value", () => {
  assert.equal(statusLabel("ombudsman", "in-review"), "Em apuração");
  assert.equal(statusLabel("data-rights", "sabe-la"), "Em andamento");
});

test("the calendar file carries the time on the office's clock", () => {
  const ics = buildCalendarEvent(
    {
      uid: "agendamento-9f1c@cartorio-marinho",
      date: "2026-08-06",
      startTime: "08:30",
      endTime: "09:30",
      title: "Atendimento no Cartório Marinho",
      description: "Procuração, leve documento com foto",
      location: "Ielmo Marinho, RN",
      stamp: new Date("2026-08-04T12:10:00Z"),
    },
    "America/Sao_Paulo",
  );
  // Half past the hour survives: the old model could only say "09".
  assert.match(ics, /DTSTART;TZID=America\/Sao_Paulo:20260806T083000/);
  assert.match(ics, /DTEND;TZID=America\/Sao_Paulo:20260806T093000/);
  assert.match(ics, /DTSTAMP:20260804T121000Z/);
  // Commas separate fields in this format, so they have to be escaped.
  assert.match(ics, /DESCRIPTION:Procuração\\, leve/);
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
});
