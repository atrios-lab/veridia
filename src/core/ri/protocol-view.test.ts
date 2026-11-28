import assert from "node:assert/strict";
import { test } from "node:test";
import { protocolView } from "./protocol-view.ts";

const today = "2026-11-28";
const tomorrow = "2026-11-29";
const row = (over: Partial<Parameters<typeof protocolView>[0]>) => ({
  kind: "prenotacao",
  status: "prenotado",
  presentedOn: "2026-11-18",
  qualifyBy: "2026-12-02",
  prenotationEnds: "2026-12-16",
  ...over,
});

test("a qualificar no prazo: azul, com a parte do prazo já usada", () => {
  const v = protocolView(row({}), today, tomorrow);
  assert.equal(v.tone, "blue");
  assert.equal(v.due, "2026-12-02");
  assert.equal(v.used, 71);
});

test("vence hoje e vencida: vermelho; vence amanhã: laranja", () => {
  assert.deepEqual(
    [
      protocolView(row({ qualifyBy: today }), today, tomorrow).label,
      protocolView(row({ qualifyBy: "2026-11-27" }), today, tomorrow).label,
      protocolView(row({ qualifyBy: tomorrow }), today, tomorrow).tone,
    ],
    ["Vence hoje", "Qualificação vencida", "amber"],
  );
});

test("exigência conta o prazo da prenotação; registrado não tem barra", () => {
  const e = protocolView(row({ status: "exigencia" }), today, tomorrow);
  assert.equal(e.tone, "amber");
  assert.equal(e.due, "2026-12-16");
  const r = protocolView(row({ status: "registrado" }), today, tomorrow);
  assert.deepEqual([r.tone, r.used], ["green", null]);
  assert.equal(
    protocolView(row({ kind: "exame" }), today, tomorrow).label,
    "Em exame e cálculo",
  );
});
