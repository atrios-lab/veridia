import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { heroTitleFit, SMALLEST_WIDE_REM, wideTitleRem } from "./hero-title.ts";
import { TENANTS } from "./resolve.ts";
import { THEMES } from "./schema.ts";

describe("heroTitleFit", () => {
  it("keeps a short name on one line, at the full size", () => {
    const fit = heroTitleFit("Ofício Único de Cruzeta / RN", "vinho-perola");
    assert.equal(fit.lines, 1);
    assert.equal(wideTitleRem(fit), 3);
  });

  it("keeps a middling name on one line, a little smaller", () => {
    const fit = heroTitleFit(
      "Ofício Único de Tibau do Sul / RN",
      "marinho-bronze",
    );
    assert.equal(fit.lines, 1);
    const rem = wideTitleRem(fit);
    assert.ok(rem < 3 && rem >= 2.125, String(rem));
  });

  it("puts a long name on two balanced lines", () => {
    const fit = heroTitleFit(
      "2º Tabelionato de Notas, Protestos e Ofício de Registro Civil de Santa Cruz / RN",
      "vinho-perola",
    );
    assert.equal(fit.lines, 2);
    assert.ok(wideTitleRem(fit) <= 2.5);
  });

  it("never draws any office's name below 2rem on a wide screen, in any theme", () => {
    for (const tenant of Object.values(TENANTS)) {
      for (const theme of THEMES) {
        const fit = heroTitleFit(tenant.home.title, theme);
        const rem = wideTitleRem(fit);
        assert.ok(rem >= SMALLEST_WIDE_REM, `${tenant.slug} ${theme}: ${rem}`);
      }
    }
  });
});
