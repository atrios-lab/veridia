import assert from "node:assert/strict";
import { test } from "node:test";
import { ADMIN_NAV } from "./nav.ts";
import { screenHelpFor } from "./screen-help.ts";

// Decision of 16/11/2026: every service of the menu carries a discreet "!"
// that says what it is for, read from the screen's own help.
test("todo serviço do menu tem o texto do seu ! (o mesmo da ajuda da tela)", () => {
  const missing: string[] = [];
  const check = (href: string) => {
    if (href.startsWith("/admin/atrios")) return; // the platform's own team
    if (!screenHelpFor(href.split("?")[0] ?? "")?.purpose) missing.push(href);
  };
  for (const item of ADMIN_NAV) {
    if (item.external) continue;
    check(item.href);
    for (const child of item.children ?? []) check(child.href);
  }
  assert.deepEqual(
    missing,
    [],
    "Tela nova no menu: escreva a ajuda dela em screen-help.ts (o ! do menu usa o 'purpose').",
  );
});

test("o DPO explica que ali o funcionário é auxiliado e que a decisão é do encarregado e do Tabelião", () => {
  const help = screenHelpFor("/admin/dpo");
  assert.match(help?.purpose ?? "", /auxiliar/);
  assert.match(help?.purpose ?? "", /encarregado \(DPO\) e do Tabelião/);
});
