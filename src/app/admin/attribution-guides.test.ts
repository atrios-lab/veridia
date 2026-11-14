import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  ATTRIBUTION_GUIDES,
  guideFor,
  offersGuide,
} from "@/core/attributions/guides.ts";
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

test("só aparece o que a serventia oferece; o Caixa sempre", () => {
  const office = { attributions: ["RCPN", "NOTAS", "PROTESTO"] };
  const shown = ATTRIBUTION_GUIDES.filter((g) => offersGuide(g, office)).map(
    (g) => g.slug,
  );
  assert.deepEqual(shown, ["registro-civil", "protesto", "notas", "caixa"]);
  assert.ok(
    offersGuide(
      { attribution: "DISTRIBUICAO" },
      { ...office, offersDistribution: true },
    ),
  );
  // Every item of the group says which attribution it belongs to, so the
  // sidebar can leave out what is not offered (the Caixa has none).
  for (const item of ADMIN_NAV.filter((i) => i.group === "Atribuições")) {
    if (item.label === "Caixa") assert.equal(item.attribution, undefined);
    else assert.ok(item.attribution, `${item.label} sem atribuição`);
  }
});
