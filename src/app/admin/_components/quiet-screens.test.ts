import assert from "node:assert/strict";
import { test } from "node:test";
import { isQuietScreen } from "./quiet-screens.ts";

test("the cohort screens are quiet: the list and every cohort", () => {
  assert.equal(isQuietScreen("/admin/ajuda/gerenciar/turmas"), true);
  assert.equal(
    isQuietScreen(
      "/admin/ajuda/gerenciar/turmas/8730a96c-0000-4000-8000-000000000000",
    ),
    true,
  );
});

test("the office's own screens keep their alerts", () => {
  for (const path of [
    "/admin",
    "/admin/pedidos",
    "/admin/agenda",
    "/admin/ajuda",
    "/admin/ajuda/gerenciar",
    "/admin/ajuda/gerenciar/turmas-antigas",
  ]) {
    assert.equal(isQuietScreen(path), false, path);
  }
});
