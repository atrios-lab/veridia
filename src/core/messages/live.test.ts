import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EMOJI_CATEGORIES,
  isReactionEmoji,
  pushRecent,
  QUICK_REACTIONS,
  RECENT_EMOJI_LIMIT,
} from "./emoji.ts";
import {
  DEFAULT_SOUND_PREFS,
  isTyping,
  OFFICE_SOUND,
  quietUntilFrom,
  receiptOf,
  type SoundPrefs,
  soundPrefsFrom,
  summarizeReactions,
  TYPING_TTL_MS,
  toneFor,
} from "./live.ts";

const NOW = new Date("2026-11-19T15:00:00Z");

test("digitando shows only while the ping is fresh", () => {
  assert.equal(isTyping(null, NOW), false);
  assert.equal(isTyping(new Date(NOW.getTime() - 2000), NOW), true);
  assert.equal(
    isTyping(new Date(NOW.getTime() - TYPING_TTL_MS - 1), NOW),
    false,
  );
});

test("reactions group by emoji, the most chosen first, marking the viewer's", () => {
  const summary = summarizeReactions(
    [
      { userId: "a", name: "Ana Exemplo", emoji: "😂" },
      { userId: "b", name: "Bruno Teste", emoji: "👍" },
      { userId: "me", name: "Eu", emoji: "👍" },
    ],
    "me",
  );
  assert.deepEqual(summary, [
    { emoji: "👍", count: 2, mine: true, names: ["Bruno Teste", "Você"] },
    { emoji: "😂", count: 1, mine: false, names: ["Ana Exemplo"] },
  ]);
});

test("a reaction is an emoji from the picker, never free text", () => {
  for (const emoji of QUICK_REACTIONS) assert.ok(isReactionEmoji(emoji));
  assert.ok(isReactionEmoji("🎉"));
  assert.equal(isReactionEmoji("olá"), false);
  assert.equal(isReactionEmoji("<script>"), false);
  // Every category has emoji, and no emoji is listed twice in one.
  for (const category of EMOJI_CATEGORIES) {
    assert.ok(category.emojis.length > 10, category.id);
    assert.equal(new Set(category.emojis).size, category.emojis.length);
  }
});

test("the recent emoji go first, without repeating, up to the limit", () => {
  assert.deepEqual(pushRecent(["😀", "👍"], "👍"), ["👍", "😀"]);
  const many = Array.from({ length: 40 }, (_, i) => String(i));
  assert.equal(pushRecent(many, "x").length, RECENT_EMOJI_LIMIT);
});

test("sound preferences fall back to the defaults on anything odd", () => {
  assert.deepEqual(soundPrefsFrom({}), DEFAULT_SOUND_PREFS);
  const prefs = soundPrefsFrom({
    messageSound: "xilofone",
    nudgeSound: "nao-existe",
    soundVolume: 140,
    soundInChat: false,
  });
  assert.equal(prefs.messageSound, "xilofone");
  assert.equal(prefs.nudgeSound, DEFAULT_SOUND_PREFS.nudgeSound);
  assert.equal(prefs.volume, 100);
  assert.equal(prefs.inChat, false);
});

test("the tone follows the person's choices", () => {
  const base = {
    nudge: false,
    officeSound: "sino" as const,
    hidden: false,
    inOpenConversation: false,
    now: NOW,
  };
  const prefs: SoundPrefs = { ...DEFAULT_SOUND_PREFS };
  // The office's tone by default; the person's own when chosen.
  assert.equal(toneFor(prefs, base), "sino");
  assert.equal(toneFor({ ...prefs, messageSound: "gota" }, base), "gota");
  assert.equal(toneFor({ ...prefs, messageSound: "none" }, base), null);
  assert.equal(
    toneFor(
      { ...prefs, messageSound: OFFICE_SOUND },
      {
        ...base,
        officeSound: "none",
      },
    ),
    null,
  );
  // A call for attention has its own tone, even with the message one off.
  assert.equal(
    toneFor(
      { ...prefs, messageSound: "none", nudgeSound: "sino-balcao" },
      { ...base, nudge: true },
    ),
    "sino-balcao",
  );
  // Não perturbe silences everything until it ends.
  const quiet = { ...prefs, quietUntil: "2026-11-19T16:00:00Z" };
  assert.equal(toneFor(quiet, { ...base, nudge: true }), null);
  assert.equal(
    toneFor(quiet, { ...base, now: new Date("2026-11-19T16:00:01Z") }),
    "sino",
  );
  // Out of sight, and the conversation already on screen.
  assert.equal(
    toneFor({ ...prefs, inBackground: false }, { ...base, hidden: true }),
    null,
  );
  assert.equal(
    toneFor({ ...prefs, inChat: false }, { ...base, inOpenConversation: true }),
    null,
  );
  assert.equal(
    toneFor(
      { ...prefs, inChat: false },
      { ...base, inOpenConversation: true, hidden: true },
    ),
    "sino",
  );
});

test("não perturbe until tomorrow ends at 7h in the office's clock", () => {
  // 15:00 UTC is 12:00 in Brasília; tomorrow 07:00 there is 10:00 UTC.
  assert.equal(
    quietUntilFrom("amanha", NOW).toISOString(),
    "2026-11-20T10:00:00.000Z",
  );
  assert.equal(
    quietUntilFrom(30, NOW).toISOString(),
    "2026-11-19T15:30:00.000Z",
  );
});

test("read receipts: sent, delivered once seen online, read once opened", () => {
  const message = { createdAt: "2026-11-19T15:00:00Z" };
  assert.equal(
    receiptOf({ ...message, pending: true }, { readAt: null, seenAt: null }),
    "pendente",
  );
  assert.equal(receiptOf(message, { readAt: null, seenAt: null }), "enviada");
  assert.equal(
    receiptOf(message, { readAt: null, seenAt: "2026-11-19T15:00:05Z" }),
    "entregue",
  );
  assert.equal(
    receiptOf(message, {
      readAt: "2026-11-19T15:00:09Z",
      seenAt: "2026-11-19T15:00:05Z",
    }),
    "lida",
  );
  assert.equal(
    receiptOf(message, { readAt: "2026-11-19T14:59:00Z", seenAt: null }),
    "enviada",
  );
});
