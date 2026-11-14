import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ATTRIBUTION_GUIDES, guideFor } from "@/core/attributions/guides.ts";
import { ADMIN_NAV } from "./_components/nav.ts";

const DASHBOARD = join(new URL(".", import.meta.url).pathname, "(dashboard)");

test("cada atalho do guia leva a uma tela que existe", () => {
  for (const guide of ATTRIBUTION_GUIDES) {
    for (const link of guide.panel) {
      const dir = join(DASHBOARD, link.href.replace(/^\/admin\/?/, ""));
      assert.ok(
        existsSync(join(dir, "page.tsx")),
        `${guide.name}: ${link.href} não existe`,
      );
    }
  }
});

test("cada atribuição está no grupo Atribuições da barra lateral", () => {
  const items = ADMIN_NAV.filter((i) => i.group === "Atribuições");
  for (const guide of ATTRIBUTION_GUIDES) {
    if (guide.slug === "registro-civil") {
      assert.ok(items.some((i) => i.href === "/admin/rcpn"));
      continue;
    }
    assert.ok(
      items.some((i) => i.href === `/admin/atribuicoes/${guide.slug}`),
      `${guide.name} fora da barra lateral`,
    );
  }
});

test("todo livro, índice e prazo diz o artigo; nada sem fonte", () => {
  for (const guide of ATTRIBUTION_GUIDES) {
    for (const line of [
      ...guide.books,
      ...guide.indexes,
      ...guide.deadlines,
      ...(guide.duties ?? []),
    ]) {
      assert.ok(line.source.trim(), `${guide.name}: linha sem fonte`);
    }
    for (const part of guide.structure?.parts ?? []) {
      assert.ok(part.source.trim(), `${guide.name}: ${part.name} sem fonte`);
    }
    assert.ok(guide.laws.length > 0 && guide.checkLocal.length > 0);
  }
  assert.equal(guideFor("nao-existe"), undefined);
  assert.equal(
    new Set(ATTRIBUTION_GUIDES.map((g) => g.slug)).size,
    ATTRIBUTION_GUIDES.length,
  );
});
