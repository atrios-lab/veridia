import assert from "node:assert/strict";
import { test } from "node:test";
import { ADMIN_NAV, navGroups } from "./nav.ts";

test("every group heading appears once: items of a group stay adjacent", () => {
  const headings = navGroups(ADMIN_NAV).map((entry) => entry.group);
  assert.deepEqual(headings, [...new Set(headings)]);
});

test("Email corporativo sits right below the request queue, inside Operação", () => {
  const operation = navGroups(ADMIN_NAV).find(
    (entry) => entry.group === "Operação",
  );
  const labels = operation?.items.map((item) => item.label);
  assert.deepEqual(labels, [
    "Visão geral",
    "Pedidos de serviço",
    "Email corporativo",
  ]);
});

// The panel marks the current page by comparing `pathname` to `href`, and
// badges an item by looking `href` up in the counts map. Both keys are panel
// routes, so an absolute URL can never collide with either: this is what lets
// the sidebar render an external item with no extra branch for those two.
test("an external item cannot be the current page or carry a badge", () => {
  for (const item of ADMIN_NAV.filter((entry) => entry.external)) {
    assert.match(item.href, /^https:\/\//);
    assert.ok(!item.href.startsWith("/admin"));
  }
});

test("no two adjacent items wear the same icon", () => {
  for (const [index, item] of ADMIN_NAV.entries()) {
    const next = ADMIN_NAV[index + 1];
    if (next)
      assert.notEqual(item.icon, next.icon, `ícone repetido: ${item.label}`);
  }
});
