import { expect, test } from "@playwright/test";
import { enabledSections, noticeSectors } from "../src/core/tenant/gating.ts";
import { TENANTS } from "../src/core/tenant/resolve.ts";

// Parameterized over the registry, so a new office is covered the moment it
// is registered, with no new test case to write. Structure only: which office
// answers and which sections it exposes. What the pages look like is asserted
// in service-request.spec.ts, against the journey the redesign defines.

const PORT = process.env.PORT ?? "3000";

/**
 * Browsers resolve any ".localhost" name to loopback, which is how one server
 * answers as several offices locally. Every office must declare one, or it
 * cannot be reached by host in development or in this test.
 */
function devHost(hosts: string[]): string {
  const host = hosts.find((h) => h.endsWith(".localhost"));
  if (!host) {
    throw new Error(
      "Serventia sem host .localhost declarado: sem ele nao da para servir " +
        "essa serventia em desenvolvimento nem testar por host.",
    );
  }
  return host;
}

for (const tenant of Object.values(TENANTS)) {
  test.describe(tenant.slug, () => {
    const baseURL = `http://${devHost(tenant.hosts)}:${PORT}`;

    test("the host serves this office", async ({ page }) => {
      await page.goto(baseURL);
      // The hero's h1 renders `home.title`, which an office may publish its
      // own wording for from the panel (Identidade visual > "Título de
      // boas-vindas"): it is meant to drift from `tenant.subtitle` here,
      // the code default, once an office does that. Asserting the exact
      // code string broke the day the first office edited it; what this
      // check can still promise is that the hero has real text and the tab
      // still names the right office, which the panel cannot rewrite.
      await expect(page.locator("h1")).not.toBeEmpty();
      await expect(page).toHaveTitle(tenant.name);
    });

    test("the sections match the gating", async ({ page }) => {
      await page.goto(baseURL);
      const rendered = await page
        .locator("[data-section]")
        .evaluateAll((nodes) =>
          nodes.map((n) => n.getAttribute("data-section")),
        );
      // Uma seção pode render mais de um link: "centrais-contato" abre tanto
      // /centrais quanto /contato (ver sectionNavLinks). O que a gating decide
      // é quais seções aparecem, não quantos links cada uma abre nem em que
      // ordem: o rodapé agrupa por tarefa ("Serviços" / "Cidadão") e "Início"
      // vive no header, então a comparação é sobre o conjunto de seções.
      expect([...new Set(rendered)].sort()).toEqual(
        enabledSections(tenant).sort(),
      );
    });

    test("no sector on the notices page is outside the attributions", async ({
      page,
    }) => {
      // The page lists sectors that actually have something live, so the set
      // is a subset that shrinks to zero on a quiet week: what must never
      // happen is a sector this office has no attribution for.
      await page.goto(`${baseURL}/editais`);
      const rendered = await page
        .locator("[data-notice-sector]")
        .evaluateAll((nodes) =>
          nodes.map((n) => n.getAttribute("data-notice-sector")),
        );
      const allowed = noticeSectors(tenant);
      for (const sector of rendered) {
        expect(allowed).toContain(sector);
      }
    });
  });
}

test("two hosts answer with two different offices", async ({ page }) => {
  // One full navigation per registered office, so the budget has to grow with
  // the registry rather than sit at the suite's flat 90s: that ceiling was
  // room to spare at three offices and started firing at six, which is what a
  // test timeout looks like from the browser's side (net::ERR_ABORTED on a
  // goto that was cut off). Measured at ~20s for six offices on a developer's
  // machine; the CI runner is several times slower, and the seventh office is
  // going to be registered by someone who has never read this file.
  test.setTimeout(30_000 * Object.keys(TENANTS).length);

  const names: string[] = [];
  for (const tenant of Object.values(TENANTS)) {
    await page.goto(`http://${devHost(tenant.hosts)}:${PORT}`);
    names.push((await page.locator("header").first().innerText()) ?? "");
  }
  expect(new Set(names).size).toBe(names.length);
});

test("the admin panel is closed to a visitor without a session", async ({
  page,
}) => {
  const tenant = Object.values(TENANTS)[0];
  await page.goto(`http://${devHost(tenant.hosts)}:${PORT}/admin`);
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
});
