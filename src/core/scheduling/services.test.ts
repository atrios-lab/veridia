import assert from "node:assert/strict";
import { test } from "node:test";
import {
  channelLabelsOn,
  channelsOn,
  DEFAULT_AGENDA_CONFIG,
  DEFAULT_CHANNELS,
  isRemoteMode,
  parseAgendaConfig,
} from "./agenda.ts";
import {
  arrivalNotice,
  arrivalTime,
  attendanceNotice,
  BASE_CHECKLIST,
  COUNTER_SERVICES,
  checklistFileHref,
  checklistFor,
  counterServicesByGroup,
  defaultChecklist,
  getCounterService,
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

test("the notary chooses his channels per weekday and per date", () => {
  const config = parseAgendaConfig({
    agendas: {
      tabeliao: {
        grid: { "1": ["09:00"], "3": ["14:00"], "4": ["10:00"] },
        serviceIds: ["notas.testamento"],
        // Monday hybrid, Wednesday by phone and video, Thursday unset.
        channels: { "1": ["video", "presencial"], "3": ["ligacao", "video"] },
        dayChannels: [{ date: "2026-11-11", channels: ["presencial"] }],
      },
    },
  });
  const book = config.agendas.tabeliao;
  // In the catalogue's order, whatever order they were ticked in.
  assert.deepEqual(channelsOn(book, "2026-11-09"), ["presencial", "video"]);
  // A Wednesday the notary changed to in person only.
  assert.deepEqual(channelsOn(book, "2026-11-11"), ["presencial"]);
  // The next Wednesday follows the weekday again.
  assert.deepEqual(channelsOn(book, "2026-11-18"), ["video", "ligacao"]);
  // A weekday nobody set attends in person.
  assert.deepEqual(channelsOn(book, "2026-11-12"), DEFAULT_CHANNELS);
  assert.deepEqual(channelLabelsOn(book, "2026-11-18"), [
    "Por vídeo",
    "Por ligação",
  ]);
  // A config from before channels parses with none set.
  assert.deepEqual(
    parseAgendaConfig({ grid: { "1": ["09:00"] } }).agendas.tabeliao.channels,
    {},
  );
});

test("a call or a video asks the citizen to be ready, not to arrive", () => {
  assert.equal(isRemoteMode("Por vídeo"), true);
  assert.equal(isRemoteMode("Por ligação"), true);
  assert.equal(isRemoteMode("Presencial"), false);
  assert.equal(isRemoteMode("Drive-thru"), false);
  assert.match(attendanceNotice("14:00", "Por ligação"), /liga no telefone/);
  assert.match(attendanceNotice("14:00", "Por vídeo"), /link da videochamada/);
  assert.match(attendanceNotice("14:00", "Presencial"), /às 13:45/);
});

test("the office's list replaces the catalogue's, base items included", () => {
  const config = parseAgendaConfig({
    agendas: {
      geral: { grid: { "1": ["08:00"] }, serviceIds: ["notas.autenticacao"] },
    },
    checklists: {
      "notas.autenticacao": {
        items: ["Documentos originais", "Taxa paga no caixa"],
        file: {
          path: "/tmp/lista.pdf",
          storedName: "x.pdf",
          mimeType: "application/pdf",
          sizeBytes: 10,
        },
      },
    },
  });
  const service = resolveService(config, "notas.autenticacao");
  // Even the base items go when the office took them out.
  assert.deepEqual(checklistFor(service ?? { bring: [] }), [
    "Documentos originais",
    "Taxa paga no caixa",
  ]);
  assert.equal(service?.hasOwnFile, true);
  // The default is still known, for "Voltar à lista padrão".
  assert.deepEqual(defaultChecklist(config, "notas.autenticacao"), [
    ...BASE_CHECKLIST,
    ...(getCounterService("notas.autenticacao")?.bring ?? []),
  ]);
  assert.equal(
    checklistFileHref("notas.autenticacao"),
    "/agendar/lista/notas.autenticacao",
  );
  // A service the office did not touch keeps the catalogue's list.
  const untouched = resolveService(config, "rcpn.segunda-via");
  assert.equal(untouched?.hasOwnFile, false);
  assert.equal(untouched?.checklist[0], BASE_CHECKLIST[0]);
});
