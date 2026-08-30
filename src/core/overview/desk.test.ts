import assert from "node:assert/strict";
import { test } from "node:test";
import {
  countDeskItems,
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
    awaitingOffice: true,
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

test("demais itens ordenam do mais novo para o mais antigo", () => {
  const older = item({
    protocolNumber: "REQ.2026.000001",
    createdAt: new Date("2026-08-05T10:00:00Z"),
  });
  const newer = item({
    protocolNumber: "REQ.2026.000002",
    createdAt: new Date("2026-08-06T10:00:00Z"),
  });

  const ranked = rankDeskItems([older, newer], TODAY, NOW);
  assert.deepEqual(
    ranked.map((r) => r.protocolNumber),
    ["REQ.2026.000002", "REQ.2026.000001"],
  );
});

test("pedido recém-chegado aparece na mesa mesmo com a fila cheia de itens antigos", () => {
  const old = Array.from({ length: 8 }, (_, i) =>
    item({
      protocolNumber: `REQ.2026.00001${i}`,
      createdAt: new Date(NOW.getTime() - (i + 10) * 86_400_000),
    }),
  );
  const fresh = item({
    protocolNumber: "REQ.2026.000099",
    createdAt: new Date(NOW.getTime() - 60_000),
  });

  const ranked = rankDeskItems([...old, fresh], TODAY, NOW);
  assert.equal(ranked[0].protocolNumber, "REQ.2026.000099");
});

test("urgências continuam na frente de um item recém-chegado", () => {
  const dueSoon = item({
    kind: "data-rights",
    protocolNumber: "SOL.2026.000001",
    status: "new",
    // Filed fourteen days before today: day 15 of the fifteen day term.
    requestedOn: "2026-07-23",
    right: "access",
    createdAt: new Date("2026-07-23T10:00:00Z"),
  });
  const stalled = item({
    protocolNumber: "REQ.2026.000002",
    hasFulfilledPendingRequirement: true,
    createdAt: new Date("2026-08-01T10:00:00Z"),
  });
  const fresh = item({ protocolNumber: "REQ.2026.000003" });

  const ranked = rankDeskItems([fresh, stalled, dueSoon], TODAY, NOW);
  assert.deepEqual(
    ranked.map((r) => r.protocolNumber),
    ["SOL.2026.000001", "REQ.2026.000002", "REQ.2026.000003"],
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

test("item que aguarda o cidadão não ocupa a mesa", () => {
  const answered = item({
    protocolNumber: "REQ.2026.000010",
    awaitingOffice: false,
  });
  const waiting = item({ protocolNumber: "REQ.2026.000011" });

  const ranked = rankDeskItems([answered, waiting], TODAY, NOW);

  assert.deepEqual(
    ranked.map((r) => r.protocolNumber),
    ["REQ.2026.000011"],
  );
});

test("requerimento LGPD no prazo crítico fica na mesa mesmo aguardando o cidadão", () => {
  // Filed thirteen days before today: day 14 of the fifteen day term. The
  // office already acted on it, so the turn is the citizen's: the legal term
  // keeps it on the desk anyway.
  const dueSoon = item({
    kind: "data-rights",
    protocolNumber: "SOL.2026.000010",
    requestedOn: "2026-07-24",
    right: "access",
    awaitingOffice: false,
  });

  const ranked = rankDeskItems([dueSoon], TODAY, NOW);

  assert.deepEqual(
    ranked.map((r) => r.protocolNumber),
    ["SOL.2026.000010"],
  );
  assert.equal(ranked[0].chipTone, "error");
});

test("LGPD ainda longe do prazo sai da mesa como qualquer outro item respondido", () => {
  const answered = item({
    kind: "data-rights",
    protocolNumber: "SOL.2026.000011",
    requestedOn: TODAY,
    right: "access",
    awaitingOffice: false,
  });

  assert.deepEqual(rankDeskItems([answered], TODAY, NOW), []);
});

test("a ordem entre os itens que ficam não muda com o filtro", () => {
  const dueSoon = item({
    kind: "data-rights",
    protocolNumber: "SOL.2026.000012",
    requestedOn: "2026-07-24",
    right: "access",
  });
  const stalled = item({
    protocolNumber: "REQ.2026.000012",
    hasFulfilledPendingRequirement: true,
  });
  const fresh = item({ protocolNumber: "REQ.2026.000013" });
  const answered = item({
    protocolNumber: "REQ.2026.000014",
    awaitingOffice: false,
  });

  const ranked = rankDeskItems([answered, fresh, stalled, dueSoon], TODAY, NOW);

  assert.deepEqual(
    ranked.map((r) => r.protocolNumber),
    ["SOL.2026.000012", "REQ.2026.000012", "REQ.2026.000013"],
  );
});

test("a contagem da mesa ignora o que aguarda o cidadão", () => {
  const items = [
    item({ protocolNumber: "REQ.2026.000015" }),
    item({ protocolNumber: "REQ.2026.000016", awaitingOffice: false }),
    item({ protocolNumber: "REQ.2026.000017", awaitingOffice: false }),
  ];

  assert.equal(countDeskItems(items, TODAY), 1);
});
