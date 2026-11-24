import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canChange,
  canReceive,
  citizenRoutingLine,
  concludes,
  currentRouting,
  defaultSectors,
  holderOf,
  mayConclude,
  newSectorId,
  normalizeConclusionPolicy,
  overdue,
  parseConclusionPolicy,
  type RoutingRecord,
  resolveSectors,
  sectorsOfUser,
  unreceivedTooLong,
} from "./routing.ts";

const at = (iso: string) => new Date(iso);

function routing(over: Partial<RoutingRecord> = {}): RoutingRecord {
  return {
    id: "r1",
    kind: "route",
    fromUserId: "carlos",
    toUserId: "ana",
    sectorId: "atribuicao-rcpn",
    sectorLabel: "Registro Civil",
    purpose: "sign",
    actId: null,
    priority: "normal",
    dueAt: null,
    note: "",
    createdBy: "carlos",
    createdAt: at("2026-11-24T10:00:00Z"),
    receivedAt: null,
    receivedBy: null,
    withdrawnAt: null,
    ...over,
  };
}

describe("setores", () => {
  it("começam com as atribuições da serventia, Balcão, Caixa e Gabinete", () => {
    assert.deepEqual(
      defaultSectors(["NOTAS", "RCPN"]).map((s) => s.label),
      ["Registro Civil", "Notas", "Balcão", "Caixa", "Gabinete do Tabelião"],
    );
  });

  it("guardam o que a serventia mudou e somam a atribuição nova", () => {
    const sectors = resolveSectors(
      {
        sectors: [
          { id: "caixa", label: "Tesouraria", origin: "internal" },
          {
            id: "balcao",
            label: "Balcão",
            origin: "internal",
            hiddenAt: "2026-11-24T10:00:00Z",
          },
        ],
      },
      ["RCPN"],
    );
    assert.deepEqual(
      sectors.map((s) => [s.id, s.label, Boolean(s.hiddenAt)]),
      [
        ["caixa", "Tesouraria", false],
        ["balcao", "Balcão", true],
        ["atribuicao-rcpn", "Registro Civil", false],
        ["gabinete", "Gabinete do Tabelião", false],
      ],
    );
  });

  it("criam um id que não repete", () => {
    assert.equal(newSectorId("Conferência", []), "conferencia");
    assert.equal(newSectorId("Conferência", ["conferencia"]), "conferencia-2");
  });

  it("põem a pessoa no setor do atendimento enquanto a serventia não escolhe", () => {
    assert.deepEqual(sectorsOfUser(null, { id: "ana", chatSector: "RCPN" }), [
      "atribuicao-rcpn",
    ]);
    assert.deepEqual(
      sectorsOfUser(
        { members: { ana: ["caixa"] } },
        { id: "ana", chatSector: "RCPN" },
      ),
      ["caixa"],
    );
  });
});

describe("com quem está o pedido", () => {
  it("é o último direcionamento não desfeito", () => {
    const first = routing({ id: "a", createdAt: at("2026-11-24T09:00:00Z") });
    const undone = routing({
      id: "b",
      createdAt: at("2026-11-24T11:00:00Z"),
      withdrawnAt: at("2026-11-24T11:05:00Z"),
    });
    assert.equal(currentRouting([first, undone])?.id, "a");
  });

  it("na fila do setor, fica com quem recebeu primeiro", () => {
    const queued = routing({ toUserId: null });
    assert.deepEqual(holderOf(queued), {
      userId: null,
      pending: true,
      sectorId: "atribuicao-rcpn",
    });
    assert.equal(
      holderOf({
        ...queued,
        receivedAt: at("2026-11-24T10:10:00Z"),
        receivedBy: "bruno",
      })?.userId,
      "bruno",
    );
  });

  it("só quem foi escolhido, ou quem é do setor, recebe", () => {
    assert.equal(canReceive(routing(), "ana", [], true), true);
    assert.equal(
      canReceive(routing(), "bruno", ["atribuicao-rcpn"], true),
      false,
    );
    const queued = routing({ toUserId: null });
    assert.equal(canReceive(queued, "bruno", ["atribuicao-rcpn"], true), true);
    assert.equal(canReceive(queued, "diego", ["caixa"], true), false);
    // A sector with nobody in it: whoever works the pedidos.
    assert.equal(canReceive(queued, "diego", ["caixa"], false), true);
  });

  it("só quem mandou altera ou desfaz, antes de receberem", () => {
    assert.equal(canChange(routing(), "carlos"), true);
    assert.equal(canChange(routing(), "ana"), false);
    assert.equal(
      canChange(routing({ receivedAt: at("2026-11-24T10:01:00Z") }), "carlos"),
      false,
    );
  });

  it("avisa quem mandou depois de 2 horas sem receber, e o prazo vencido", () => {
    const now = at("2026-11-24T12:00:00Z");
    assert.equal(unreceivedTooLong(routing(), now), true);
    assert.equal(
      unreceivedTooLong(routing(), at("2026-11-24T11:00:00Z")),
      false,
    );
    assert.equal(
      overdue(routing({ dueAt: at("2026-11-24T11:00:00Z") }), now),
      true,
    );
    assert.equal(overdue(routing(), now), false);
  });
});

describe("linha do cidadão", () => {
  it("diz o setor e a fase, sem nome", () => {
    assert.equal(
      citizenRoutingLine({
        status: "processing",
        routing: routing(),
        enabled: true,
      }),
      "Com o setor de Registro Civil · aguardando assinatura",
    );
    assert.equal(
      citizenRoutingLine({
        status: "in-review",
        routing: routing({ purpose: "execute" }),
        enabled: true,
      }),
      "Com o setor de Registro Civil · em análise",
    );
  });

  it("some desligada, sem setor ou fora das mãos do cartório", () => {
    assert.equal(
      citizenRoutingLine({
        status: "processing",
        routing: routing(),
        enabled: false,
      }),
      null,
    );
    assert.equal(
      citizenRoutingLine({
        status: "processing",
        routing: routing({ sectorLabel: null }),
        enabled: true,
      }),
      null,
    );
    assert.equal(
      citizenRoutingLine({
        status: "awaiting-payment",
        routing: routing(),
        enabled: true,
      }),
      null,
    );
  });
});

describe("quem assina e conclui", () => {
  it("começa com todos", () => {
    assert.deepEqual(parseConclusionPolicy(undefined), { mode: "all" });
    assert.equal(
      mayConclude({ mode: "all" }, { id: "diego", role: "staff" }),
      true,
    );
  });

  it("com a lista, só ela, o Tabelião e a Átrios", () => {
    const policy = { mode: "selected" as const, userIds: ["ana"] };
    assert.equal(
      mayConclude(policy, { id: "ana", role: "substituto-legal" }),
      true,
    );
    assert.equal(mayConclude(policy, { id: "diego", role: "staff" }), false);
    assert.equal(mayConclude(policy, { id: "carlos", role: "admin" }), true);
    assert.equal(mayConclude(policy, { id: "x", role: "superadmin" }), true);
  });

  it("a lista nunca fica sem o Tabelião nem vazia", () => {
    assert.deepEqual(
      normalizeConclusionPolicy({ mode: "selected", userIds: ["ana"] }, [
        "carlos",
      ]),
      { mode: "selected", userIds: ["carlos", "ana"] },
    );
    assert.deepEqual(
      normalizeConclusionPolicy({ mode: "selected", userIds: [] }, []),
      { mode: "all" },
    );
    assert.deepEqual(parseConclusionPolicy({ mode: "selected", userIds: [] }), {
      mode: "all",
    });
  });

  it("concluir é ir a pronto para retirada ou concluir sem a retirada", () => {
    assert.equal(concludes("processing", "ready-for-pickup"), true);
    assert.equal(concludes("processing", "done"), true);
    assert.equal(concludes("ready-for-pickup", "done"), false);
    assert.equal(concludes("in-review", "processing"), false);
  });
});
