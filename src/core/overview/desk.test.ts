import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type DeskItemInput,
  rankDeskItems,
  rankTodayAppointments,
} from "./desk.ts";

const TODAY = "2026-08-06";
const NOW = new Date("2026-08-06T12:00:00Z");

function item(overrides: Partial<DeskItemInput>): DeskItemInput {
  return {
    kind: "service-request",
    protocolNumber: "REQ.2026.000001",
    applicantName: "Fulano",
    status: "new",
    createdAt: NOW,
    ...overrides,
  };
}

test("LGPD perto do prazo encabeça a mesa, antes de exigência cumprida e de novos itens", () => {
  const dueSoon = item({
    kind: "data-rights",
    protocolNumber: "SOL.2026.000001",
    status: "new",
    // Filed thirteen days before today: day 14 of the fifteen day term.
    requestedOn: "2026-07-24",
    right: "access",
  });
  const stalled = item({
    kind: "service-request",
    protocolNumber: "REQ.2026.000002",
    hasFulfilledPendingRequirement: true,
  });
  const fresh = item({ protocolNumber: "REQ.2026.000003" });

  const ranked = rankDeskItems([fresh, stalled, dueSoon], TODAY, NOW);

  assert.deepEqual(
    ranked.map((r) => r.protocolNumber),
    ["SOL.2026.000001", "REQ.2026.000002", "REQ.2026.000003"],
  );
  assert.equal(ranked[0].chipTone, "error");
});

test("agendamento não ocupa a mesa: um horário marcado já está resolvido", () => {
  const booked = item({
    kind: "appointment",
    protocolNumber: "AGD.2026.000001",
    status: "booked",
  });
  const fresh = item({ protocolNumber: "REQ.2026.000003" });

  // Nada de "para hoje", nada de confirmar: se chegar um registro do modelo
  // antigo, ele desce para o mesmo balde de todo o resto.
  const ranked = rankDeskItems([fresh, booked], TODAY, NOW);
  assert.deepEqual(
    ranked.map((r) => r.chipLabel),
    ["novo", "novo"],
  );
});

test("demais itens ordenam do mais antigo para o mais novo", () => {
  const older = item({
    protocolNumber: "REQ.2026.000001",
    createdAt: new Date("2026-08-05T10:00:00Z"),
  });
  const newer = item({
    protocolNumber: "REQ.2026.000002",
    createdAt: new Date("2026-08-06T10:00:00Z"),
  });

  const ranked = rankDeskItems([newer, older], TODAY, NOW);
  assert.deepEqual(
    ranked.map((r) => r.protocolNumber),
    ["REQ.2026.000001", "REQ.2026.000002"],
  );
});

test("manifestação anônima sem nome usa o rótulo padrão", () => {
  const anonymous = item({
    kind: "ombudsman",
    protocolNumber: "OUV.2026.000001",
    applicantName: null,
    manifestationType: "complaint",
  });
  const [ranked] = rankDeskItems([anonymous], TODAY, NOW);
  assert.equal(ranked.displayName, "manifestação anônima");
});

test("corta nos seis mais urgentes", () => {
  const items = Array.from({ length: 9 }, (_, i) =>
    item({
      protocolNumber: `REQ.2026.00000${i}`,
      createdAt: new Date(NOW.getTime() - i * 60_000),
    }),
  );
  const ranked = rankDeskItems(items, TODAY, NOW);
  assert.equal(ranked.length, 6);
});

test("rankTodayAppointments destaca o próximo e marca os já passados", () => {
  const ranked = rankTodayAppointments(
    [
      // Fora de ordem de propósito: quem ordena é a função.
      {
        id: "c",
        citizenName: "Antônio",
        serviceLabel: "Escritura",
        slotTime: "14:00",
        status: "booked",
      },
      {
        id: "a",
        citizenName: "Ana",
        serviceLabel: "Procuração",
        slotTime: "09:00",
        status: "booked",
      },
      {
        id: "b",
        citizenName: "Sérgio",
        serviceLabel: "Tabelião",
        slotTime: "11:30",
        status: "booked",
      },
    ],
    "10:15",
  );

  assert.deepEqual(
    ranked.map((r) => [r.slotTime, r.state]),
    [
      ["09:00", "done"],
      ["11:30", "next"],
      ["14:00", "upcoming"],
    ],
  );
});

test("um atendimento já realizado conta como concluído, mesmo mais tarde no dia", () => {
  const ranked = rankTodayAppointments(
    [
      {
        id: "a",
        citizenName: "Ana",
        serviceLabel: "Procuração",
        slotTime: "16:00",
        status: "attended",
      },
      {
        id: "b",
        citizenName: "Sérgio",
        serviceLabel: "Tabelião",
        slotTime: "17:00",
        status: "booked",
      },
    ],
    "10:15",
  );
  assert.equal(ranked[0].state, "done");
  assert.equal(ranked[1].state, "next");
});
