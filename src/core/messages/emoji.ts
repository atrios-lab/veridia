/**
 * The emoji of the internal messenger (decision of 19/11/2026): a picker
 * laid out the way people already know from the phone messengers, by
 * category with the recent ones first, and the six quick reactions over a
 * message. The characters are Unicode's, the same on every system; only the
 * selection and the order are ours.
 */

export interface EmojiCategory {
  id: string;
  label: string;
  /** The tab's own emoji. */
  icon: string;
  emojis: readonly string[];
}

/**
 * A symbol whose default is text (☀, ✈, ❤, ™, 🏳) draws as a plain glyph
 * unless it carries the emoji presentation selector: it is added here, so
 * the picker shows the coloured one everywhere.
 */
function emojiStyle(token: string): string {
  return [...token].length === 1 && !/\p{Emoji_Presentation}/u.test(token)
    ? `${token}\ufe0f`
    : token;
}

/** Split on spaces: easier to read and to edit than an array of strings. */
const list = (text: string): readonly string[] =>
  text.split(/\s+/).filter(Boolean).map(emojiStyle);

export const EMOJI_CATEGORIES: readonly EmojiCategory[] = [
  {
    id: "rostos",
    label: "Rostos e pessoas",
    icon: "😀",
    emojis: list(`
      😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😙
      😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 😌
      😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤧 🥵 🥶 🥴 😵 🤯 🤠 🥳 😎 🤓 🧐 😕
      😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩
      😫 🥱 😤 😡 😠 🤬 😈 💀 🤡 👻 👽 🤖 😺 😸 😹 😻 😼 😽 🙀 😿
      👋 🤚 🖐 ✋ 🖖 👌 🤌 🤏 ✌ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝ 👍 👎
      ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 ✍ 💅 💪 🦾 👀 👁 🧠 🫶 👶 🧒
      👦 👧 🧑 👨 👩 🧓 👴 👵 🙋 🙆 🙅 🤷 🤦 💁 🙇 👮 🕵 💂 👷 🧑‍💼
    `),
  },
  {
    id: "natureza",
    label: "Animais e natureza",
    icon: "🐶",
    emojis: list(`
      🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧
      🐦 🐤 🦆 🦅 🦉 🐺 🐴 🦄 🐝 🐛 🦋 🐌 🐞 🐢 🐍 🐙 🐠 🐟 🐬 🐳
      🦈 🐊 🐘 🦒 🐄 🐑 🐐 🐈 🐕 🦜 🌵 🎄 🌲 🌳 🌴 🌱 🌿 ☘ 🍀 🍁
      🍂 🌾 🌺 🌻 🌹 🌷 🌼 🌸 💐 🌞 🌝 🌛 ⭐ 🌟 ✨ ⚡ 🔥 🌈 ☀ ⛅
      ☁ 🌧 ⛈ ❄ ☃ 💧 🌊 🌍
    `),
  },
  {
    id: "comidas",
    label: "Comidas e bebidas",
    icon: "🍔",
    emojis: list(`
      🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🥦 🥕
      🌽 🌶 🥔 🍞 🥐 🥖 🧀 🥚 🍳 🥓 🍗 🍖 🌭 🍔 🍟 🍕 🥪 🌮 🌯 🥗
      🍝 🍜 🍲 🍛 🍣 🍱 🥟 🍤 🍚 🍙 🍘 🍥 🍢 🍡 🍧 🍨 🍦 🥧 🧁 🍰
      🎂 🍮 🍭 🍬 🍫 🍿 🍩 🍪 🥜 🍯 🥛 ☕ 🍵 🧃 🥤 🧋 🍺 🍻 🥂 🍷
    `),
  },
  {
    id: "atividades",
    label: "Atividades",
    icon: "⚽",
    emojis: list(`
      ⚽ 🏀 🏈 ⚾ 🎾 🏐 🏉 🎱 🏓 🏸 🥅 ⛳ 🏹 🎣 🥊 🥋 🎽 ⛸ 🎿 🏆
      🥇 🥈 🥉 🏅 🎖 🎗 🎫 🎟 🎪 🎭 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🎷 🎺 🎸
      🎻 🎲 🧩 ♟ 🎯 🎳 🎮 🎰 🎉 🎊 🎈 🎁 🎀 🪅
    `),
  },
  {
    id: "lugares",
    label: "Viagens e lugares",
    icon: "🚗",
    emojis: list(`
      🚗 🚕 🚙 🚌 🚎 🏎 🚓 🚑 🚒 🚐 🛻 🚚 🚛 🚜 🛵 🏍 🚲 🛴 🚨 🚦
      🚥 🚧 ⛽ 🚏 🗺 🗿 🗽 🏰 🏯 🏟 🎡 🎢 🎠 ⛲ ⛱ 🏖 🏝 🏜 🌋 ⛰
      🏔 🗻 🏕 ⛺ 🏠 🏡 🏘 🏢 🏬 🏣 🏤 🏥 🏦 🏨 🏪 🏫 🏛 ⛪ 🕌 🛕
      ✈ 🛫 🛬 🚀 🛸 🚁 ⛵ 🚤 🛳 ⛴ 🚢 ⚓ ⌛ ⏳ ⌚ ⏰ ⏱ 🕰 🌇 🌆
    `),
  },
  {
    id: "objetos",
    label: "Objetos",
    icon: "💡",
    emojis: list(`
      📱 💻 🖥 🖨 ⌨ 🖱 💾 💿 📷 📹 🎥 📞 ☎ 📟 📠 📺 📻 🎙 ⏲ 🔋
      🔌 💡 🔦 🕯 🧯 💸 💵 💳 🪙 💰 🧾 ✉ 📧 📨 📩 📤 📥 📦 📫 📮
      📝 ✏ ✒ 🖊 🖋 🖌 🖍 📁 📂 🗂 📅 📆 🗒 🗓 📇 📈 📉 📊 📋 📌
      📍 📎 🖇 📏 📐 ✂ 🗃 🗄 🗑 🔒 🔓 🔏 🔐 🔑 🗝 🔨 🪓 ⛏ ⚒ 🛠
      🗡 ⚔ 🛡 🔧 🔩 ⚙ 🧰 🧲 ⚖ 🔗 ⛓ 🧪 🧬 🔬 🔭 📡 💉 💊 🩺 🩹
      🚪 🪑 🛏 🛋 🚽 🚿 🧴 🧹 🧺 🧻 🧼 🧽 🛒 🎒 👓 🕶 👔 👕 👖 👗
      📚 📖 📗 📘 📙 📓 📒 📃 📜 📄 📰 🗞 🔖 🏷 💼 📯 🔔 🔕 📢 📣
    `),
  },
  {
    id: "simbolos",
    label: "Símbolos",
    icon: "❤\ufe0f",
    emojis: list(`
      ❤ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣ 💕 💞 💓 💗 💖 💘 💝 💟 ☮
      ✝ ☪ 🕉 ☸ ✡ 🔯 ☯ ☦ 🛐 ⛎ ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑
      ♒ ♓ 🆔 ⚛ 🉑 ☢ ☣ 📴 📳 🈶 ✴ 🆚 💮 🉐 ㊙ ㊗ 🅰 🅱 🆎 🆑
      🅾 🆘 ❌ ⭕ 🛑 ⛔ 📛 🚫 💯 💢 ♨ 🚷 🚯 🚳 🚱 🔞 📵 🚭 ❗ ❕
      ❓ ❔ ‼ ⁉ 🔅 🔆 〽 ⚠ 🚸 🔱 ⚜ 🔰 ♻ ✅ 🈯 💹 ❇ ✳ ❎ 🌐
      💠 Ⓜ 🌀 💤 🏧 🚾 ♿ 🅿 🛗 🈳 🈂 🛂 🛃 🛄 🛅 🚹 🚺 🚼 ⚧ 🚻
      🔣 ℹ 🔤 🔡 🔠 🆖 🆗 🆙 🆒 🆕 🆓 0️⃣ 1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣ 8️⃣
      9️⃣ 🔟 🔢 #️⃣ *️⃣ ▶ ⏸ ⏯ ⏹ ⏺ ⏭ ⏮ ⏩ ⏪ ◀ 🔼 🔽 ➡ ⬅ ⬆
      ⬇ ↗ ↘ ↙ ↖ ↕ ↔ ↪ ↩ ⤴ ⤵ 🔀 🔁 🔂 🔄 🔃 🎵 🎶 ➕ ➖
      ➗ ✖ ♾ 💲 💱 ™ © ® 〰 ➰ ➿ 🔚 🔙 🔛 🔝 🔜 ✔ ☑ 🔘 🔴
      🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟤 🔺 🔻 🔸 🔹 🔶 🔷 🔳 🔲 ▪ ▫ ◾ ◽
    `),
  },
  {
    id: "bandeiras",
    label: "Bandeiras",
    icon: "🏳",
    emojis: list(`
      🇧🇷 🏳 🏴 🏁 🚩 🏳‍🌈 🇵🇹 🇦🇷 🇺🇾 🇵🇾 🇨🇱 🇧🇴 🇵🇪 🇨🇴 🇻🇪 🇲🇽 🇺🇸 🇨🇦 🇬🇧 🇫🇷
      🇩🇪 🇮🇹 🇪🇸 🇯🇵 🇨🇳 🇰🇷 🇮🇳 🇦🇴 🇲🇿 🇨🇻
    `),
  },
];

/** The six over a message, one click away, in this order. */
export const QUICK_REACTIONS = [
  "👍",
  "❤\ufe0f",
  "😂",
  "😮",
  "😢",
  "🙏",
] as const;

const KNOWN = new Set<string>([
  ...QUICK_REACTIONS,
  ...EMOJI_CATEGORIES.flatMap((category) => category.emojis),
]);

/**
 * Whether a reaction is one of ours. A reaction is a single emoji from the
 * picker, never free text: the column holds what the screen can draw.
 */
export function isReactionEmoji(value: string): boolean {
  return KNOWN.has(value);
}

/** How many the "Recentes" tab keeps. */
export const RECENT_EMOJI_LIMIT = 24;

/** The recent list after using one: it goes first, without repeating. */
export function pushRecent(recent: readonly string[], emoji: string): string[] {
  return [emoji, ...recent.filter((e) => e !== emoji)].slice(
    0,
    RECENT_EMOJI_LIMIT,
  );
}
