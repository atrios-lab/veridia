import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ALERT_CHANNELS,
  defaultOfficeAlerts,
  OfficeAlertsSchema,
  parseOfficeAlerts,
} from "./office.ts";

test("sem nada salvo, todos os canais avisam com o padrão", () => {
  const alerts = parseOfficeAlerts(null);
  assert.deepEqual(alerts, defaultOfficeAlerts());
  for (const channel of ALERT_CHANNELS) {
    assert.equal(alerts[channel].enabled, true);
    assert.equal(alerts[channel].popup, true);
  }
  assert.equal(alerts.chat.shake, true);
  assert.equal(alerts.chat.sound, "sino");
});

test("um canal estragado ou ausente volta ao padrão sozinho", () => {
  const alerts = parseOfficeAlerts({
    agenda: {
      enabled: false,
      popup: false,
      notify: false,
      sound: "none",
      shake: false,
    },
    guias: { enabled: "sim" },
    pedidos: {
      enabled: true,
      popup: true,
      notify: true,
      sound: "som-que-nao-existe",
      shake: true,
    },
  });
  assert.equal(alerts.agenda.enabled, false);
  assert.equal(alerts.agenda.sound, "none");
  assert.deepEqual(alerts.guias, defaultOfficeAlerts().guias);
  assert.deepEqual(alerts.pedidos, defaultOfficeAlerts().pedidos);
  assert.deepEqual(alerts.lgpd, defaultOfficeAlerts().lgpd);
});

test("ao salvar, o esquema exige todos os canais e recusa som desconhecido", () => {
  const ok = defaultOfficeAlerts();
  assert.equal(OfficeAlertsSchema.safeParse(ok).success, true);
  const { chat: _chat, ...withoutChat } = ok;
  assert.equal(OfficeAlertsSchema.safeParse(withoutChat).success, false);
  assert.equal(
    OfficeAlertsSchema.safeParse({
      ...ok,
      lgpd: { ...ok.lgpd, sound: "inventado" },
    }).success,
    false,
  );
});
