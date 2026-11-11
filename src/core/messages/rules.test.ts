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
