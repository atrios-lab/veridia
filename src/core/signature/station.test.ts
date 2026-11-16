import assert from "node:assert/strict";
import { test } from "node:test";
import {
  jobExpired,
  mayRequest,
  releaseUntil,
  stationCertificatesFrom,
  stationOnline,
} from "./station.ts";

const now = new Date("2026-11-16T13:00:00Z");

test("a estação está ligada se falou há poucos segundos", () => {
  assert.equal(stationOnline(new Date("2026-11-16T12:59:50Z"), now), true);
  assert.equal(stationOnline(new Date("2026-11-16T12:58:00Z"), now), false);
  assert.equal(stationOnline(null, now), false);
});

test("só quem foi autorizado pede, e no período só enquanto liberado", () => {
  const base = {
    shared: true,
    mode: "cada" as const,
    signerIds: ["u1"],
    releasedUntil: null,
  };
  assert.equal(mayRequest(base, "u1", now).ok, true);
  assert.equal(mayRequest(base, "u2", now).ok, false);
  assert.equal(mayRequest({ ...base, shared: false }, "u1", now).ok, false);
  assert.equal(mayRequest(undefined, "u1", now).ok, false);
  const periodo = { ...base, mode: "periodo" as const };
  assert.equal(mayRequest(periodo, "u1", now).ok, false);
  assert.equal(
    mayRequest({ ...periodo, releasedUntil: releaseUntil(2, now) }, "u1", now)
      .ok,
    true,
  );
  assert.equal(
    mayRequest(
      { ...periodo, releasedUntil: new Date("2026-11-16T12:00:00Z") },
      "u1",
      now,
    ).ok,
    false,
  );
});

test("o que a estação conta é conferido: lixo fica de fora", () => {
  const good = {
    id: "A".repeat(40),
    nome: "FULANA FICTICIA:11144477735",
    emissor: "AC Teste",
    validade: "2027-01-01T00:00:00Z",
    certificado: "MIIB",
    cadeia: ["MIIB"],
  };
  assert.deepEqual(stationCertificatesFrom([good, { id: "x" }, "lixo"]), [
    good,
  ]);
  assert.deepEqual(stationCertificatesFrom("nada"), []);
});

test("pedido sem resposta em 3 minutos é dado por perdido", () => {
  assert.equal(jobExpired(new Date("2026-11-16T12:58:00Z"), now), false);
  assert.equal(jobExpired(new Date("2026-11-16T12:56:00Z"), now), true);
});
