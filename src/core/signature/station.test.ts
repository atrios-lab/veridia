import assert from "node:assert/strict";
import { test } from "node:test";
import {
  describeGrant,
  grantsFrom,
  jobExpired,
  kindFromPath,
  mayRequest,
  type RequestContext,
  releaseUntil,
  requestContextAt,
  stationCertificatesFrom,
  stationOnline,
} from "./station.ts";

const now = new Date("2026-11-16T13:00:00Z");
// 13:00 UTC is 10:00 in the office (America/Fortaleza).
const ctx: RequestContext = {
  kind: "pedidos",
  clock: "10:00",
  today: "2026-11-16",
};

test("a estação está ligada se falou há poucos segundos", () => {
  assert.equal(stationOnline(new Date("2026-11-16T12:59:50Z"), now), true);
  assert.equal(stationOnline(new Date("2026-11-16T12:58:00Z"), now), false);
  assert.equal(stationOnline(null, now), false);
});

test("só quem foi autorizado pede, e no período só enquanto liberado", () => {
  const base = {
    shared: true,
    mode: "cada" as const,
    grants: [{ userId: "u1", kinds: [] }],
    releasedUntil: null,
  };
  assert.equal(mayRequest(base, "u1", now, ctx).ok, true);
  assert.equal(mayRequest(base, "u2", now, ctx).ok, false);
  assert.equal(
    mayRequest({ ...base, shared: false }, "u1", now, ctx).ok,
    false,
  );
  assert.equal(mayRequest(undefined, "u1", now, ctx).ok, false);
  const periodo = { ...base, mode: "periodo" as const };
  assert.equal(mayRequest(periodo, "u1", now, ctx).ok, false);
  assert.equal(
    mayRequest(
      { ...periodo, releasedUntil: releaseUntil(2, now) },
      "u1",
      now,
      ctx,
    ).ok,
    true,
  );
  assert.equal(
    mayRequest(
      { ...periodo, releasedUntil: new Date("2026-11-16T12:00:00Z") },
      "u1",
      now,
      ctx,
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

test("a autorização de cada pessoa limita o que, o horário e até quando", () => {
  const policy = {
    shared: true,
    mode: "cada" as const,
    releasedUntil: null,
    grants: [
      {
        userId: "u1",
        kinds: ["pedidos" as const, "qualificacao" as const],
        from: "08:00",
        until: "18:00",
        expiresOn: "2026-12-31",
      },
    ],
  };
  assert.equal(mayRequest(policy, "u1", now, ctx).ok, true);
  const kind = mayRequest(policy, "u1", now, { ...ctx, kind: "iss" });
  assert.equal(kind.ok, false);
  assert.match(!kind.ok ? kind.message : "", /declaração de iss/);
  const late = mayRequest(policy, "u1", now, { ...ctx, clock: "18:01" });
  assert.match(!late.ok ? late.message : "", /das 08:00 às 18:00/);
  assert.equal(
    mayRequest(policy, "u1", now, { ...ctx, clock: "07:59" }).ok,
    false,
  );
  assert.equal(
    mayRequest(policy, "u1", now, { ...ctx, clock: "18:00" }).ok,
    true,
  );
  const expired = mayRequest(policy, "u1", now, {
    ...ctx,
    today: "2027-01-01",
  });
  assert.match(!expired.ok ? expired.message : "", /venceu/);
  assert.equal(
    mayRequest(policy, "u1", now, { ...ctx, today: "2026-12-31" }).ok,
    true,
  );
  assert.equal(
    describeGrant(policy.grants[0] ?? { userId: "", kinds: [] }),
    "Só Pedidos, Qualificação de títulos · das 08:00 às 18:00 · até 31/12/2026",
  );
  assert.equal(
    describeGrant({ userId: "u2", kinds: [] }),
    "Todos os documentos",
  );
});

test("o que se guarda da autorização é conferido", () => {
  assert.deepEqual(
    grantsFrom([
      { userId: "u1", kinds: ["pedidos", "inventado"], from: "08:00" },
      { userId: "u1", kinds: [] },
      { userId: "u2", from: "25:00", until: "18:00", expiresOn: "ontem" },
      "lixo",
      { kinds: [] },
    ]),
    [
      { userId: "u1", kinds: ["pedidos"] },
      { userId: "u2", kinds: [] },
    ],
  );
  assert.deepEqual(grantsFrom(null), []);
});

test("o tipo do pedido vem da tela onde foi feito, no relógio do cartório", () => {
  assert.equal(kindFromPath("/admin/pedidos/ABC123"), "pedidos");
  assert.equal(kindFromPath("/admin/utilitarios/iss?x=1"), "iss");
  assert.equal(kindFromPath("/admin/utilitarios/livro-diario"), "livro-diario");
  assert.equal(kindFromPath("/admin/qualquer"), "outros");
  assert.equal(kindFromPath(""), "outros");
  assert.deepEqual(requestContextAt("iss", now), {
    kind: "iss",
    clock: "10:00",
    today: "2026-11-16",
  });
  // 02:30 UTC on the 17th is still the 16th, 23:30, in the office.
  assert.deepEqual(
    requestContextAt("outros", new Date("2026-11-17T02:30:00Z")),
    { kind: "outros", clock: "23:30", today: "2026-11-16" },
  );
});
