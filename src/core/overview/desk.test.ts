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

test("AGD para hoje não confirmado vem antes de itens comuns, depois de LGPD e exigência", () => {
  const today3pm = item({
    kind: "appointment",
    protocolNumber: "AGD.2026.000001",
    status: "requested",
    appointmentDate: TODAY,
    slotHour: 15,
  });
  const fresh = item({ protocolNumber: "REQ.2026.000003" });

  const ranked = rankDeskItems([fresh, today3pm], TODAY, NOW);
  assert.deepEqual(
    ranked.map((r) => r.protocolNumber),
    ["AGD.2026.000001", "REQ.2026.000003"],
  );
  assert.equal(ranked[0].chipLabel, "para hoje");
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

test("rankTodayAppointments destaca o próximo confirmado e marca os já passados", () => {
  const ranked = rankTodayAppointments(
    [
      {
        protocolNumber: "AGD.2026.000001",
        applicantName: "Ana",
        slotHour: 9,
        status: "confirmed",
      },
      {
        protocolNumber: "AGD.2026.000002",
        applicantName: "Sérgio",
        slotHour: 11,
        status: "confirmed",
      },
      {
        protocolNumber: "AGD.2026.000003",
        applicantName: "Antônio",
        slotHour: 14,
        status: "requested",
      },
    ],
    10,
  );

  assert.equal(ranked[0].state, "done");
  assert.equal(ranked[1].state, "next");
  assert.equal(ranked[2].state, "awaiting-confirmation");
});
