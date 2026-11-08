import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_AGENDA_CONFIG, parseAgendaConfig } from "./agenda.ts";
import {
  arrivalNotice,
  arrivalTime,
  BASE_CHECKLIST,
  COUNTER_SERVICES,
  checklistFor,
  counterServicesByGroup,
  offeredAgendas,
  resolveService,
  servicesOfAgenda,
  suggestedServiceIds,
} from "./services.ts";

test("every catalogue service has a unique dotted id and something to bring", () => {
  const ids = COUNTER_SERVICES.map((service) => service.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const service of COUNTER_SERVICES) {
    // The dot keeps them apart from the office's own slugified ids.
    assert.match(service.id, /^[a-z]+\.[a-z0-9-]+$/);
    assert.ok(service.bring.length > 0, service.id);
  }
});

test("the catalogue covers every attribution of a cartório único", () => {
  const groups = counterServicesByGroup().map((entry) => entry.group);
  assert.deepEqual(groups, [
    "Atendimento geral",
    "Registro Civil",
    "Tabelionato de Notas",
    "Registro de Imóveis",
    "Protesto",
    "Títulos e Documentos",
    "Pessoas Jurídicas",
  ]);
  // The notary's own acts start in the notary's agenda.
  assert.ok(suggestedServiceIds("tabeliao").includes("notas.testamento"));
  assert.ok(suggestedServiceIds("geral").includes("rcpn.registro-nascimento"));
});

test("each agenda offers only what the office ticked in it", () => {
  const config = parseAgendaConfig({
    agendas: {
      geral: {
        grid: { "1": ["08:00"] },
        serviceIds: ["rcpn.segunda-via", "minha-taxa", "sumiu"],
      },
      tabeliao: { grid: {}, serviceIds: ["notas.testamento"] },
    },
    services: [
      { id: "minha-taxa", label: "Serviço próprio", bring: ["Boleto pago"] },
    ],
    modes: ["Presencial"],
  });
  assert.deepEqual(
    servicesOfAgenda(config, "geral").map((service) => service.id),
    // Catalogue first, own services last, and a deleted id drops out.
    ["rcpn.segunda-via", "minha-taxa"],
  );
  // The notary's agenda has a service but no hours: the site leaves it out.
  assert.deepEqual(offeredAgendas(config), ["geral"]);
  assert.deepEqual(offeredAgendas(DEFAULT_AGENDA_CONFIG), []);

  const own = resolveService(config, "minha-taxa");
  assert.equal(own?.group, "Outros serviços da serventia");
  assert.deepEqual(checklistFor(own ?? { bring: [] }), [
    ...BASE_CHECKLIST,
    "Boleto pago",
  ]);
});

test("the citizen is asked to arrive fifteen minutes early", () => {
  assert.equal(arrivalTime("09:00"), "08:45");
  assert.equal(arrivalTime("13:10"), "12:55");
  assert.equal(arrivalTime("00:05"), "23:50");
  assert.match(arrivalNotice("09:00"), /15 minutos de antecedência, às 08:45/);
});
