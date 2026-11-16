import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

// Decision of 16/11/2026: the platform never says "IA" to anyone; it is
// always the "Assistente Virtual". Comments may name the technology; what
// a person reads may not.
async function sources(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await sources(path)));
    else if (/\.tsx?$/.test(entry.name)) out.push(path);
  }
  return out;
}

test('nenhum texto da plataforma diz "IA": é sempre "Assistente Virtual"', async () => {
  const found: string[] = [];
  for (const file of await sources("src")) {
    if (file.endsWith("no-ia-word.test.ts")) continue;
    const lines = (await readFile(file, "utf8")).split("\n");
    lines.forEach((line, index) => {
      const code = line.trim();
      if (/^(\/\/|\*|\/\*)/.test(code)) return;
      if (/(^|[^\p{L}\p{N}_])IA([^\p{L}\p{N}_]|$)/u.test(code)) {
        found.push(`${file}:${index + 1}`);
      }
    });
  }
  assert.deepEqual(
    found,
    [],
    'Troque "IA" por "Assistente Virtual" no texto (decisão de 16/11/2026).',
  );
});
