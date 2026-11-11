import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { OFFICE_PERMISSIONS } from "@/core/auth/roles.ts";
import { SCREEN_HELP, screenHelpFor } from "./screen-help.ts";

const DASHBOARD = join(process.cwd(), "src/app/admin/(dashboard)");
const pageOf = (href: string) =>
  join(DASHBOARD, href.replace(/^\/admin/, ""), "page.tsx");

test("every screen with help and every 'Configurar' link points to a real screen", () => {
  for (const [route, help] of Object.entries(SCREEN_HELP)) {
    assert.ok(existsSync(pageOf(route)), `tela ${route} não existe`);
    assert.ok(help.purpose.length > 10, `${route}: falta 'para que serve'`);
    assert.ok(help.steps.length > 0, `${route}: falta o passo a passo`);
    if (help.configure) {
      assert.ok(
        existsSync(pageOf(help.configure.href)),
        `${route}: ${help.configure.href} não existe`,
      );
      assert.ok(help.configure.steps.length > 0);
    }
  }
});

test("the 'Configurar' permission is an office permission", () => {
  for (const [route, help] of Object.entries(SCREEN_HELP)) {
    const permission = help.configure?.permission;
    if (!permission) continue;
    assert.ok(
      (OFFICE_PERMISSIONS as readonly string[]).includes(permission),
      `${route}: permissão ${permission} desconhecida`,
    );
  }
});

test("a sub-screen inherits its service's help; /admin matches only itself", () => {
  assert.equal(
    screenHelpFor("/admin/utilitarios/iss/nova"),
    SCREEN_HELP["/admin/utilitarios/iss"],
  );
  assert.equal(screenHelpFor("/admin"), SCREEN_HELP["/admin"]);
  assert.equal(screenHelpFor("/admin/atrios/liberacao-de-acesso"), undefined);
  assert.equal(screenHelpFor(null), undefined);
});
