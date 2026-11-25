import Link from "next/link";
import { LOCATIONS, STREET_KINDS } from "@/core/ri/codes.ts";
import {
  addressLine,
  indicatorGaps,
  propertyTitle,
} from "@/core/ri/property.ts";
import { statusLabel } from "@/core/ri/sheet.ts";
import { loadAcervo } from "@/lib/ri.ts";
import { buttonVariants } from "../../../_ui/button.tsx";
import { RiPage } from "../../_components/page.tsx";
import { requireRi } from "../../_lib.ts";

export const metadata = { title: "Indicador Real (Livro 4)" };

export default async function RealIndicatorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { tenant } = await requireRi();
  const q = ((await searchParams).q ?? "").trim().toLowerCase();
  const acervo = await loadAcervo(tenant.slug);
  const rows = acervo.properties
    .filter((p) => p.status !== 4)
    .filter(
      (p) =>
        !q ||
        [
          addressLine(p),
          p.rural.ccir,
          p.rural.nirf,
          p.rural.car,
          p.rural.incra,
          String(p.number),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q),
    )
    .sort((a, b) => addressLine(a).localeCompare(addressLine(b), "pt-BR"));
  return (
    <RiPage
      wide
      title="Indicador Real (Livro 4)"
      description="Todos os imóveis do acervo, pela localização: rua e número no urbano; denominação, CCIR, NIRF, CAR e Incra no rural (Lei nº 6.015/1973, art. 179). É o que vai no arquivo semanal para a ONR."
      actions={
        <Link href="/admin/ri/onr" className={buttonVariants({ size: "sm" })}>
          Gerar o arquivo para a ONR
        </Link>
      }
    >
      <form className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4 shadow-xs">
        <label className="flex min-w-60 flex-1 flex-col gap-1.5 text-sm font-medium">
          Buscar por endereço, denominação, CCIR, NIRF, CAR ou matrícula
          <input
            name="q"
            defaultValue={q}
            className="h-9 rounded-md border bg-background px-2.5 text-sm font-normal"
          />
        </label>
        <button type="submit" className={buttonVariants({ size: "sm" })}>
          Buscar
        </button>
      </form>
      <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
        <table className="w-full min-w-2xl text-left text-sm">
          <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Imóvel</th>
              <th className="px-3 py-2 font-medium">Localização</th>
              <th className="px-3 py-2 font-medium">Chaves rurais</th>
              <th className="px-3 py-2 font-medium">Registro</th>
              <th className="px-3 py-2 font-medium">Para a ONR</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((p) => {
              const gaps = indicatorGaps(p);
              return (
                <tr key={p.id}>
                  <td className="px-3 py-2">
                    <span className="block font-medium">
                      {addressLine(p) || "Sem endereço"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {p.streetKind
                        ? STREET_KINDS.get(p.streetKind)
                        : "sem tipo de logradouro"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {LOCATIONS.get(p.location)}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {[
                      p.rural.ccir && `CCIR ${p.rural.ccir}`,
                      p.rural.nirf && `NIRF ${p.rural.nirf}`,
                      p.rural.car && `CAR ${p.rural.car}`,
                      p.rural.incra && `Incra ${p.rural.incra}`,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "não se aplica"}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/ri/matriculas/${p.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {propertyTitle(p)}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {statusLabel(p.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {gaps.length ? (
                      <span className="text-warning-text">
                        falta {gaps.join(" e ")}
                      </span>
                    ) : (
                      <span className="text-success-text">pronto</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="p-6 text-sm text-muted-foreground">Nenhum imóvel.</p>
        )}
      </div>
    </RiPage>
  );
}
