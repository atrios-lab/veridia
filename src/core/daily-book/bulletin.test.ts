import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addFigures,
  bulletinSourceNote,
  bulletinStatusFor,
  monthEnd,
  sumReadings,
} from "./bulletin.ts";

const day = (acts: number, fdj: number, gross?: number) => ({
  kind: "produtividade" as const,
  actsCount: acts,
  issCents: acts * 10,
  funds: { fdj, frmp: 1, fcrcpn: 2, funaf: 3 },
  grossRevenueCents: gross,
});

test("a soma dos relatórios do mês vira os números do boletim", () => {
  const total = sumReadings([day(13, 6266, 1000), day(2, 100, 500)]);
  assert.deepEqual(total, {
    actsCount: 15,
    issCents: 150,
    fundAmountsCents: { fdj: 6366, frmp: 2, fcrcpn: 4, funaf: 6 },
    grossRevenueCents: 1500,
  });
  // A total some report lacks is left out, never half-summed.
  assert.equal(
    sumReadings([day(1, 1, 1000), day(1, 1)]).grossRevenueCents,
    undefined,
  );
  assert.deepEqual(addFigures(total, sumReadings([day(1, 1, 1)])), {
    actsCount: 16,
    issCents: 160,
    fundAmountsCents: { fdj: 6367, frmp: 3, fcrcpn: 6, funaf: 9 },
    grossRevenueCents: 1501,
  });
});

test("preliminar com o mês aberto, consolidado depois; a origem é dita", () => {
  const b = {
    month: "2026-10",
    figures: sumReadings([day(1, 1)]),
    source: "dias" as const,
    days: ["2026-10-05", "2026-10-06"],
  };
  assert.equal(monthEnd("2026-02"), "2026-02-28");
  assert.equal(bulletinStatusFor(b, "2026-10-31"), "preliminary");
  assert.equal(bulletinStatusFor(b, "2026-11-01"), "consolidated");
  assert.match(bulletinSourceNote(b), /2 dia\(s\).*dias 05, 06/);
  assert.match(
    bulletinSourceNote({
      ...b,
      source: "relatorio",
      days: [],
      start: "2026-10-01",
      end: "2026-10-31",
    }),
    /de 01\/10\/2026 a 31\/10\/2026/,
  );
});
