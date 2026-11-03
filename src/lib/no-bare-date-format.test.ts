import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// The server runs in UTC and the machines that develop this run in Brazil, so
// a date read without a time zone looks right until it reaches production.
// Screens are not unit tested for their formatting, which is why this reads
// the source: every date goes through core/time/office-time.ts, or says which
// zone it means.

const SOURCES = readdirSync("src", { encoding: "utf8", recursive: true })
  .filter((file) => /\.tsx?$/.test(file) && !file.endsWith(".test.ts"))
  .map((file) => join("src", file));

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

test("every Intl.DateTimeFormat names its time zone", () => {
  const bare: string[] = [];
  for (const file of SOURCES) {
    const source = readFileSync(file, "utf8");
    for (const call of source.matchAll(/Intl\.DateTimeFormat\(([^)]*)\)/g)) {
      if (!call[1].includes("timeZone")) {
        bare.push(`${file}:${lineOf(source, call.index)}`);
      }
    }
  }
  assert.deepEqual(bare, []);
});

test("no instant is read through the process's own time zone", () => {
  const pattern = /\.(getFullYear|getMonth|getDate|getHours|getMinutes)\(\)/g;
  const local: string[] = [];
  for (const file of SOURCES) {
    const source = readFileSync(file, "utf8");
    for (const call of source.matchAll(pattern)) {
      local.push(`${file}:${lineOf(source, call.index)}`);
    }
  }
  assert.deepEqual(local, []);
});

test("an instant's day is not taken from its UTC string", () => {
  // These three do date math on a calendar day built at midnight UTC, so the
  // UTC string is that same day. Anything else slicing an ISO string is reading
  // tomorrow's date from nine at night.
  const onCalendarDays = new Set([
    "src/core/scheduling/calendar.ts",
    "src/core/compliance/classification.ts",
    "src/app/admin/(dashboard)/agenda/configuracao/agenda-settings-form.tsx",
  ]);
  const sliced: string[] = [];
  for (const file of SOURCES) {
    if (onCalendarDays.has(file)) continue;
    const source = readFileSync(file, "utf8");
    for (const call of source.matchAll(/\.toISOString\(\)\.(slice|split)\(/g)) {
      sliced.push(`${file}:${lineOf(source, call.index)}`);
    }
  }
  assert.deepEqual(sliced, []);
});
