import { ATTRIBUTION_NAMES } from "@/core/acts/catalog.ts";
import { enabledSections, noticeSectors } from "@/core/tenant/gating.ts";
import { getTenant } from "@/lib/tenant.ts";

// Plain HTML on purpose. This page exists to prove that two hosts serve two
// different offices; the moment it has style, someone starts discussing style.
export default async function Home() {
  const tenant = await getTenant();
  const sectors = noticeSectors(tenant);

  return (
    <main>
      <h1>{tenant.name}</h1>
      <p>{tenant.subtitle}</p>
      <p>CNS: {tenant.cns}</p>

      <h2>Atribuições</h2>
      <ul>
        {tenant.attributions.map((a) => (
          <li key={a} data-attribution={a}>
            {ATTRIBUTION_NAMES[a]}
          </li>
        ))}
      </ul>

      <h2>Seções habilitadas</h2>
      <ul>
        {enabledSections(tenant).map((section) => (
          <li key={section} data-section={section}>
            {section}
          </li>
        ))}
      </ul>

      {sectors.length > 0 && (
        <>
          <h2>Setores de editais</h2>
          <ul>
            {sectors.map((sector) => (
              <li key={sector} data-notice-sector={sector}>
                {sector}
              </li>
            ))}
          </ul>
        </>
      )}

      <footer>
        <p>{tenant.legalFooter}</p>
      </footer>
    </main>
  );
}
