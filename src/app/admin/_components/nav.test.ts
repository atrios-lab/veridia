import assert from "node:assert/strict";
import { test } from "node:test";
import { ADMIN_NAV, currentChild, navGroups } from "./nav.ts";

test("every group heading appears once: items of a group stay adjacent", () => {
  const headings = navGroups(ADMIN_NAV).map((entry) => entry.group);
  assert.deepEqual(headings, [...new Set(headings)]);
});

test("Email corporativo sits right below the request queue, then Mensagens, inside Operação", () => {
  const operation = navGroups(ADMIN_NAV).find(
    (entry) => entry.group === "Operação",
  );
  const labels = operation?.items.map((item) => item.label);
  assert.deepEqual(labels, [
    "Visão geral",
    "Pedidos de serviço",
    "Email corporativo",
    "Mensagens internas",
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

test("Ajuda e treinamentos is the last group, and its one item asks no permission", () => {
  const groups = navGroups(ADMIN_NAV);
  const last = groups.at(-1);
  assert.equal(last?.group, "Ajuda e treinamentos");
  assert.deepEqual(
    last?.items.map((item) => [item.label, item.href, item.permission]),
    [["Ajuda e treinamentos", "/admin/ajuda", undefined]],
  );
});

test("Treinamento is the one item that calls for attention", () => {
  assert.deepEqual(
    ADMIN_NAV.filter((item) => item.attention).map((item) => item.href),
    ["/admin/ajuda"],
  );
});

test("cada item do menu tem uma permissão que aparece em Perfis e permissões (ou é do Tabelião)", async () => {
  const { GRANTABLE_LABELS, RESERVED_PERMISSIONS, PLATFORM_PERMISSIONS } =
    await import("@/core/auth/roles.ts");
  const allowed = new Set<string>([
    ...Object.keys(GRANTABLE_LABELS),
    ...RESERVED_PERMISSIONS,
    ...PLATFORM_PERMISSIONS,
    "admin.access",
  ]);
  for (const item of ADMIN_NAV) {
    // No permission: open to everyone of the office (the audit's own
    // notifications, for instance).
    if (!item.permission) continue;
    assert.ok(
      allowed.has(item.permission),
      `${item.label}: a permissão ${item.permission} não aparece em Perfis e permissões`,
    );
  }
});

test("os utilitários têm cada um a sua permissão", () => {
  const tools = ADMIN_NAV.filter((item) => item.group === "Utilitários");
  const permissions = tools.map((item) => item.permission);
  assert.deepEqual(permissions, [...new Set(permissions)]);
});

test("cada utilitário abre em subitens, e o primeiro é a tela principal dele", () => {
  const tools = ADMIN_NAV.filter((item) => item.group === "Utilitários");
  for (const tool of tools) {
    assert.ok(tool.children?.length, `${tool.label}: sem subitens`);
    assert.equal(tool.children?.[0]?.href, tool.href, tool.label);
    const hrefs = tool.children?.map((child) => child.href) ?? [];
    assert.deepEqual(hrefs, [...new Set(hrefs)], tool.label);
  }
});

test("o subitem atual é o da rota exata, ou a lista de onde o registro veio", () => {
  const guias = ADMIN_NAV.find(
    (item) => item.href === "/admin/utilitarios/guias",
  )?.children;
  assert.ok(guias);
  assert.equal(
    currentChild(guias, "/admin/utilitarios/guias/nova"),
    "/admin/utilitarios/guias/nova",
  );
  assert.equal(
    currentChild(guias, "/admin/utilitarios/guias/abc123"),
    "/admin/utilitarios/guias",
  );
  assert.equal(currentChild(guias, "/admin/pedidos"), undefined);
  // A sibling route that only shares the prefix is not inside the tool.
  assert.equal(currentChild(guias, "/admin/utilitarios/guiasx"), undefined);
});
