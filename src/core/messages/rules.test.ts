import assert from "node:assert/strict";
import { test } from "node:test";
import { acceptedType, canNudge, presenceOf } from "./rules.ts";

test("aceita documentos, imagens e áudio; recusa o que executa", () => {
  assert.equal(
    acceptedType("certidao.pdf", "application/pdf"),
    "application/pdf",
  );
  assert.equal(
    acceptedType("planilha.xlsx", ""),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  assert.equal(
    acceptedType("audio.webm", "audio/webm;codecs=opus"),
    "audio/webm",
  );
  assert.equal(acceptedType("programa.exe", "application/x-msdownload"), null);
  assert.equal(acceptedType("script.js", "text/javascript"), null);
});

test("presença e intervalo do chamar atenção", () => {
  const now = new Date("2026-11-11T12:00:00Z");
  assert.equal(
    presenceOf("ausente", new Date(now.getTime() - 10_000), now),
    "ausente",
  );
  assert.equal(
    presenceOf("ausente", new Date(now.getTime() - 5 * 60_000), now),
    "offline",
  );
  assert.equal(
    presenceOf("qualquer", new Date(now.getTime() - 1000), now),
    "disponivel",
  );
  assert.equal(canNudge(new Date(now.getTime() - 5000), now), false);
  assert.equal(canNudge(new Date(now.getTime() - 20_000), now), true);
  assert.equal(canNudge(null, now), true);
});

test("almoço de até 1 hora, no horário de Brasília", async () => {
  const { validLunch, inLunch, lunchLabel } = await import("./rules.ts");
  assert.equal(validLunch("12:00", 60), null);
  assert.match(validLunch("12:00", 61) ?? "", /1 hora/);
  assert.match(validLunch("25:00", 30) ?? "", /início/);
  assert.equal(lunchLabel({ start: "12:30", minutes: 45 }), "12:30 às 13:15");
  const lunch = { start: "12:00", minutes: 60 };
  assert.equal(inLunch(lunch, new Date("2026-11-11T15:10:00Z")), true);
  assert.equal(inLunch(lunch, new Date("2026-11-11T16:00:00Z")), false);
  assert.equal(inLunch(null, new Date()), false);
});
