import assert from "node:assert/strict";
import { test } from "node:test";
import { isQuickService, suggestGrid, usualMinutes } from "./suggest.ts";

const QUICK = [
  { id: "firma", minutes: 30 },
  { id: "autenticacao", minutes: 30 },
  { id: "abertura", minutes: 30 },
];
const LONG = [
  { id: "registro", minutes: 60 },
  { id: "retificacao", minutes: 90 },
  { id: "habilitacao", minutes: 60 },
  { id: "procuracao", minutes: 45 },
  { id: "segunda-via", minutes: 30 },
];

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

test("dois funcionários, das 8 às 14, almoço em turnos: os dois começam às 08:00", () => {
  const suggestion = suggestGrid({
    open: "08:00",
    close: "14:00",
    staff: 2,
    lunch: { from: "12:00", to: "14:00", minutes: 60 },
    quick: QUICK,
    long: LONG,
  });
  assert.equal(suggestion.capacity["08:00"], 2);
  // Um abre com rápido, o outro com longo.
  assert.deepEqual(suggestion.lanes.map((lane) => lane[0].kind).sort(), [
    "long",
    "quick",
  ]);
  // Almoço em turnos: um às 12:00, o outro às 13:00.
  const lunches = suggestion.lanes.map(
    (lane) => lane.find((block) => block.kind === "lunch")?.start,
  );
  assert.deepEqual(lunches, ["12:00", "13:00"]);
  for (const lane of suggestion.lanes) {
    // Nada se sobrepõe, nada passa das 14:00.
    for (let i = 1; i < lane.length; i++) {
      assert.ok(toMinutes(lane[i].start) >= toMinutes(lane[i - 1].end));
    }
    assert.ok(toMinutes(lane.at(-1)?.end ?? "00:00") <= toMinutes("14:00"));
    // Rápidos intercalados: nunca dois longos seguidos.
    const kinds = lane.filter((b) => b.kind !== "lunch").map((b) => b.kind);
    for (let i = 1; i < kinds.length; i++) {
      assert.ok(!(kinds[i] === "long" && kinds[i - 1] === "long"));
    }
  }
  // O horário rápido oferece os três serviços rápidos.
  const quickTime = suggestion.lanes
    .flat()
    .find((block) => block.kind === "quick")?.start as string;
  for (const id of ["firma", "autenticacao", "abertura"]) {
    assert.ok(suggestion.services[quickTime].includes(id));
  }
});

test("vinte funcionários: vinte vagas às 08:00, e ninguém fica parado antes do almoço", () => {
  const suggestion = suggestGrid({
    open: "08:00",
    close: "14:00",
    staff: 20,
    lunch: { from: "11:00", to: "14:00", minutes: 60 },
    quick: QUICK,
    long: LONG,
  });
  assert.equal(suggestion.capacity["08:00"], 20);
  assert.equal(suggestion.lanes.length, 20);
  // Os almoços se espalham pelas três horas da janela.
  const lunchStarts = new Set(
    suggestion.lanes.map(
      (lane) => lane.find((block) => block.kind === "lunch")?.start,
    ),
  );
  assert.deepEqual([...lunchStarts].sort(), ["11:00", "12:00", "13:00"]);
  // A soma das vagas é o total de atendimentos do dia.
  const total = Object.values(suggestion.capacity).reduce((a, b) => a + b, 0);
  const blocks = suggestion.lanes
    .flat()
    .filter((block) => block.kind !== "lunch").length;
  assert.equal(total, blocks);
});

test("sem almoço e só serviços rápidos, a grade é de meia em meia hora", () => {
  const suggestion = suggestGrid({
    open: "08:00",
    close: "10:00",
    staff: 3,
    quick: QUICK,
    long: [],
  });
  assert.deepEqual(suggestion.times, ["08:00", "08:30", "09:00", "09:30"]);
  assert.equal(suggestion.capacity["09:30"], 3);
});

test("a duração sugerida e o que é rápido saem do nome do serviço", () => {
  assert.equal(usualMinutes("Reconhecimento de firma"), 30);
  assert.equal(usualMinutes("Retificação de registro civil"), 90);
  assert.equal(usualMinutes("Procuração pública"), 45);
  assert.equal(usualMinutes("Registro de nascimento"), 60);
  assert.equal(isQuickService("Autenticação de cópias"), true);
  assert.equal(
    isQuickService("Abertura de firma (cartão de assinaturas)"),
    true,
  );
  assert.equal(isQuickService("Habilitação de casamento"), false);
});
