import { noticeSectors } from "@/core/tenant/gating.ts";
import { ComingSoon } from "../_components/coming-soon.tsx";
import { requireSection } from "../_lib/section.ts";

export const metadata = { title: "Editais" };

const SECTOR_LABELS: Record<string, string> = {
  proclamas: "Proclamas de casamento",
  "registro-imoveis": "Registro de Imóveis",
  protesto: "Intimações de protesto",
  rtd: "Títulos e Documentos",
  rcpj: "Pessoas Jurídicas",
};

export default async function PublicNoticesPage() {
  const tenant = await requireSection("editais");
  const sectors = noticeSectors(tenant);

  return (
    <ComingSoon
      section="editais"
      description="Proclamas, intimações e demais publicações oficiais da
        serventia, organizadas por setor."
    >
      <div className="mt-4 rounded-2xl border border-brand-border bg-brand-card p-5">
        <h2 className="font-serif text-lg font-semibold text-brand-primary">
          Setores que esta serventia publica
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {sectors.map((sector) => (
            <li
              key={sector}
              data-notice-sector={sector}
              className="rounded-lg bg-brand-tint px-3 py-1.5 text-xs font-semibold text-brand-primary"
            >
              {SECTOR_LABELS[sector]}
            </li>
          ))}
        </ul>
      </div>
    </ComingSoon>
  );
}
