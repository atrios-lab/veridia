import assert from "node:assert/strict";
import { test } from "node:test";
import {
  closingReason,
  closingText,
  pendingDays,
  reminderDue,
} from "./protocol-days.ts";

test("cada dia fecha com o seu motivo: títulos, sem títulos, feriado, fim de semana", () => {
  // 2026-11-23 é segunda; 2026-11-28, sábado; 2026-12-25, Natal.
  assert.equal(closingReason("2026-11-23", 2).kind, "movimento");
  assert.equal(closingReason("2026-11-23", 0).kind, "sem-movimento");
  assert.equal(closingReason("2026-11-28", 0).kind, "fim-de-semana");
  const natal = closingReason("2026-12-25", 0);
  assert.equal(natal.kind, "feriado");
  assert.match(
    closingText("2026-12-25", natal, { count: 0, first: null, last: null }),
    /25\/12\/2026 \(sexta-feira\) sem movimento, em virtude do feriado/,
  );
  assert.match(
    closingText("2026-11-23", closingReason("2026-11-23", 0), {
      count: 0,
      first: null,
      last: null,
    }),
    /não houve apresentação de títulos/,
  );
  assert.match(
    closingText("2026-11-23", closingReason("2026-11-23", 2), {
      count: 2,
      first: 10,
      last: 11,
    }),
    /2 títulos apontados, do nº 10 ao nº 11/,
  );
});

test("dias pendentes e o lembrete das 14h", () => {
  const closed = new Set(["2026-11-23"]);
  assert.deepEqual(pendingDays("2026-11-23", "2026-11-26", closed), [
    "2026-11-24",
    "2026-11-25",
    "2026-11-26",
  ]);
  assert.deepEqual(
    reminderDue({ today: "2026-11-26", hour: 10, pending: ["2026-11-26"] }),
    { due: false, late: [], today: false },
  );
  assert.equal(
    reminderDue({ today: "2026-11-26", hour: 14, pending: ["2026-11-26"] }).due,
    true,
  );
  assert.deepEqual(
    reminderDue({
      today: "2026-11-26",
      hour: 8,
      pending: ["2026-11-25", "2026-11-26"],
    }).late,
    ["2026-11-25"],
  );
});

test("dia do livro físico: o termo real do dia e que foi encerrado no físico à época", () => {
  const fisico = { kind: "livro-fisico" as const, why: "" };
  assert.equal(
    closingText("2024-07-22", fisico, { count: 1, first: 2551, last: 2551 }),
    "Encerra-se o Protocolo do dia 22/07/2024 (segunda-feira) com 1 título apontado, sob o nº 2.551. Encerrado também no livro físico à época.",
  );
  assert.match(
    closingText("2024-07-23", fisico, { count: 0, first: null, last: null }),
    /sem movimento: não houve apresentação de títulos\. Encerrado também no livro físico à época\.$/,
  );
});
