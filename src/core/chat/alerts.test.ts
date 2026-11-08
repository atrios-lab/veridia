import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type AlertSnapshot,
  DEFAULT_ALERT_PREFS,
  diffAlerts,
  parseAlertPrefs,
  queueNeedsAttention,
  SOUND_IDS,
  SOUNDS,
  volumeGain,
  waitingLabel,
} from "./alerts.ts";

const EMPTY: AlertSnapshot = { status: "available", waiting: [], mine: [] };
const ROSA = { id: "c1", citizenName: "Rosa", subject: "Certidão" };

test("the first look announces nothing: what was there is not news", () => {
  assert.deepEqual(diffAlerts(undefined, { ...EMPTY, waiting: [ROSA] }), []);
});

test("a conversation that joins the queue rings", () => {
  const alerts = diffAlerts(EMPTY, { ...EMPTY, waiting: [ROSA] });
  assert.deepEqual(alerts, [
    {
      kind: "new-waiting",
      conversationId: "c1",
      title: "Nova conversa na fila",
      body: "Rosa · Certidão",
      href: "/admin/atendimento",
    },
  ]);
});

test("someone still waiting is not announced twice", () => {
  const snap = { ...EMPTY, waiting: [ROSA] };
  assert.deepEqual(diffAlerts(snap, snap), []);
});

test("an attendant marked away is not called by the queue", () => {
  const alerts = diffAlerts(
    { ...EMPTY, status: "away" },
    { ...EMPTY, status: "away", waiting: [ROSA] },
  );
  assert.deepEqual(alerts, []);
  assert.equal(
    queueNeedsAttention({ ...EMPTY, status: "away", waiting: [ROSA] }),
    false,
  );
});

test("taking a conversation with Atender does not ring for oneself", () => {
  const before = { ...EMPTY, waiting: [ROSA] };
  const after: AlertSnapshot = {
    ...EMPTY,
    mine: [{ id: "c1", citizenName: "Rosa", lastCitizenMessageAt: null }],
  };
  assert.deepEqual(diffAlerts(before, after), []);
});

test("a conversation a colleague transfers rings as assigned", () => {
  const after: AlertSnapshot = {
    ...EMPTY,
    mine: [{ id: "c9", citizenName: "João", lastCitizenMessageAt: null }],
  };
  const [alert] = diffAlerts(EMPTY, after);
  assert.equal(alert.kind, "assigned");
  assert.equal(alert.href, "/admin/atendimento/c9");
});

test("a new citizen message in my conversation rings", () => {
  const mine = (at: string | null): AlertSnapshot => ({
    ...EMPTY,
    mine: [{ id: "c1", citizenName: "Rosa", lastCitizenMessageAt: at }],
  });
  assert.deepEqual(diffAlerts(mine(null), mine(null)), []);
  assert.equal(
    diffAlerts(mine(null), mine("2026-11-08T12:00:00.000Z"))[0].kind,
    "new-message",
  );
  assert.equal(
    diffAlerts(
      mine("2026-11-08T12:00:00.000Z"),
      mine("2026-11-08T12:01:00.000Z"),
    )[0].kind,
    "new-message",
  );
  assert.deepEqual(
    diffAlerts(
      mine("2026-11-08T12:00:00.000Z"),
      mine("2026-11-08T12:00:00.000Z"),
    ),
    [],
  );
});

test("someone waiting keeps calling until attended", () => {
  assert.equal(queueNeedsAttention({ ...EMPTY, waiting: [ROSA] }), true);
  assert.equal(queueNeedsAttention(EMPTY), false);
});

test("the reminder counts people in Portuguese", () => {
  assert.equal(waitingLabel(1), "1 pessoa aguardando atendimento");
  assert.equal(waitingLabel(3), "3 pessoas aguardando atendimento");
});

test("saved preferences that are old or broken read as defaults", () => {
  assert.deepEqual(parseAlertPrefs(null), DEFAULT_ALERT_PREFS);
  assert.deepEqual(parseAlertPrefs("lixo"), DEFAULT_ALERT_PREFS);
  const prefs = parseAlertPrefs({
    sound: "buzina",
    volume: 140,
    repeatSeconds: 7,
    flash: false,
  });
  assert.equal(prefs.sound, "sino");
  assert.equal(prefs.volume, 100);
  assert.equal(prefs.repeatSeconds, 30);
  assert.equal(prefs.flash, false);
});

test("every tone on offer can be saved, and so can no sound", () => {
  for (const id of [...SOUND_IDS, "none"]) {
    assert.equal(parseAlertPrefs({ sound: id }).sound, id);
  }
  assert.ok(SOUND_IDS.every((id) => SOUNDS[id].notes.length > 0));
});

test("volume follows the ear: zero is silent, the top is full", () => {
  assert.equal(volumeGain(0), 0);
  assert.equal(volumeGain(100), 1);
  assert.ok(volumeGain(50) < 0.5);
});
