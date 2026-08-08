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
      // The hero leads with what the office is, which is the subtitle; the
      // name is in the header and in the tab.
      await expect(page.locator("h1")).toHaveText(tenant.subtitle);
      await expect(page).toHaveTitle(tenant.name);
    });

    test("the sections match the gating", async ({ page }) => {
      await page.goto(baseURL);
      const rendered = await page
        .locator("[data-section]")
        .evaluateAll((nodes) =>
          nodes.map((n) => n.getAttribute("data-section")),
        );
      expect(rendered).toEqual(enabledSections(tenant));
    });

    test("the notice sectors match the attributions", async ({ page }) => {
      // The sectors live on the notices page now, not on the home.
      await page.goto(`${baseURL}/editais`);
      const rendered = await page
        .locator("[data-notice-sector]")
        .evaluateAll((nodes) =>
          nodes.map((n) => n.getAttribute("data-notice-sector")),
        );
      expect(rendered).toEqual(noticeSectors(tenant));
    });
  });
}

test("two hosts answer with two different offices", async ({ page }) => {
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
