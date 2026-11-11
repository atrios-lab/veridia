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

test("almoço trava o chat até 'voltei'; status longe vence em 60 minutos", async () => {
  const { atLunch, effectiveStatus, lingering, presenceOf } = await import(
    "./rules.ts"
  );
  const at = (hhmm: string) => new Date(`2026-11-11T${hhmm}:00-03:00`);
  const lunch = { start: "12:00", minutes: 60 };
  assert.equal(atLunch(lunch, null, at("12:10")), true);
  assert.equal(atLunch(lunch, null, at("13:00")), false);
  // Back at 12:30: unlocked for the rest of today's window.
  assert.equal(atLunch(lunch, at("12:30"), at("12:40")), false);
  // Yesterday's "voltei" does not count today.
  assert.equal(
    atLunch(lunch, new Date("2026-11-10T12:30:00-03:00"), at("12:10")),
    true,
  );

  const since = at("09:00");
  assert.equal(effectiveStatus("ocupado", since, at("09:39")), "ocupado");
  assert.equal(lingering("ocupado", since, at("09:39")), false);
  assert.equal(lingering("ocupado", since, at("09:40")), true);
  assert.equal(effectiveStatus("ocupado", since, at("10:00")), "disponivel");
  assert.equal(lingering("ocupado", since, at("10:00")), false);
  // Disponível never lingers; unknown start, no clock.
  assert.equal(lingering("disponivel", since, at("09:50")), false);
  assert.equal(effectiveStatus("ausente", null, at("18:00")), "ausente");
  assert.equal(
    presenceOf("em-reuniao", at("10:00"), at("10:00"), null, {
      statusChangedAt: since,
    }),
    "disponivel",
  );
});
