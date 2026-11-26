import { Download } from "lucide-react";
import Link from "next/link";
import { areaText, mosaicSvg } from "@/core/ri/geo.ts";
import { propertyTitle } from "@/core/ri/property.ts";
import { db } from "@/db/index.ts";
import { loadAcervo } from "@/lib/ri.ts";
import { currentGeometriesWith, overlapsOf, verticesOf } from "@/lib/ri-geo.ts";
import { buttonVariants } from "../../_ui/button.tsx";
import { Panel, RiPage } from "../_components/page.tsx";
import { requireRi, riCan } from "../_lib.ts";

export const metadata = { title: "Mapa (SIG-RI)" };

/**
 * The mosaico of the office: every perímetro in force on one map, the
 * sobreposições marked, and the GeoJSON for the SIG-RI or any SIG.
 */
export default async function MapPage() {
  const { session, tenant } = await requireRi();
  const [rows, acervo] = await Promise.all([
    currentGeometriesWith(db, tenant.slug),
    loadAcervo(tenant.slug),
  ]);
  const byId = new Map(acervo.properties.map((p) => [p.id, p]));
  const items = rows.flatMap((r) => {
    const p = byId.get(r.propertyId);
    return p && !p.deletedAt
      ? [
          {
            id: p.id,
            label: p.number.toLocaleString("pt-BR"),
            title: propertyTitle(p),
            vertices: verticesOf(r),
            areaM2: r.areaM2,
          },
        ]
      : [];
  });
  const overlaps = overlapsOf(rows.filter((r) => byId.has(r.propertyId)));
  const hit = new Set(overlaps.flatMap((o) => [o.a, o.b]));
  const svg = mosaicSvg(items, hit);
  const withoutGeo = acervo.properties.filter(
    (p) =>
      p.book === 2 &&
      p.location === 1 &&
      !p.deletedAt &&
      !rows.some((r) => r.propertyId === p.id),
  );
  const title = (id: string) =>
    byId.get(id)
      ? propertyTitle(byId.get(id) as NonNullable<ReturnType<typeof byId.get>>)
      : "?";
  return (
    <RiPage
      wide
      title="Mapa (SIG-RI)"
      description="Os perímetros georreferenciados das matrículas num só mapa, para ver a cidade e o campo e achar sobreposição antes do registro. As coordenadas vêm do memorial ou do Sigef lançados em cada matrícula."
      actions={
        riCan(session, "ri.export") && (
          <a
            href="/admin/ri/mapa/geojson"
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            <Download className="size-4" /> Baixar o mapa (GeoJSON)
          </a>
        )
      }
    >
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel
            title={`Mosaico (${items.length} ${items.length === 1 ? "perímetro" : "perímetros"})`}
          >
            {svg ? (
              <div
                className="overflow-hidden rounded-lg border bg-background"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: generated SVG, no user markup
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum perímetro lançado ainda. Abra a matrícula e lance o
                memorial ou a planilha do Sigef em "Georreferenciamento e
                planta".
              </p>
            )}
          </Panel>
        </div>
        <div className="flex flex-col gap-5">
          <Panel
            title={`Sobreposições (${overlaps.length})`}
            description="Áreas em que dois perímetros lançados se sobrepõem (abaixo de 1 m² é ruído das coordenadas). O Incra certifica que a parcela não se sobrepõe (Lei nº 6.015/1973, art. 176, § 5º); aqui a serventia vê antes."
          >
            {overlaps.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {overlaps.map((o) => (
                  <li
                    key={`${o.a}-${o.b}`}
                    className="rounded-md bg-destructive/10 px-3 py-2 text-destructive"
                  >
                    <Link
                      href={`/admin/ri/matriculas/${o.a}`}
                      className="font-semibold underline"
                    >
                      {title(o.a)}
                    </Link>{" "}
                    e{" "}
                    <Link
                      href={`/admin/ri/matriculas/${o.b}`}
                      className="font-semibold underline"
                    >
                      {title(o.b)}
                    </Link>
                    : {areaText(o.areaM2)}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Perímetros lançados">
            <ul className="flex flex-col gap-1 text-sm">
              {items.map((i) => (
                <li key={i.id} className="flex justify-between gap-2">
                  <Link
                    href={`/admin/ri/matriculas/${i.id}`}
                    className="text-primary hover:underline"
                  >
                    {i.title}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {areaText(i.areaM2)}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
          {withoutGeo.length > 0 && (
            <Panel
              title={`Rurais sem perímetro (${withoutGeo.length})`}
              description="Exigido a partir de 21/10/2029 em toda transferência, desmembramento, parcelamento e remembramento (Decreto nº 4.449/2002, art. 10, na redação do Decreto nº 12.689/2025)."
            >
              <ul className="flex flex-col gap-1 text-sm">
                {withoutGeo.slice(0, 50).map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/admin/ri/matriculas/${p.id}`}
                      className="text-primary hover:underline"
                    >
                      {propertyTitle(p)}
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel title="SIG-RI da ONR">
            <p className="text-sm text-muted-foreground">
              O arquivo GeoJSON reúne todos os perímetros com o número da
              matrícula. O envio direto ao SIG-RI depende do manual técnico da
              ONR, que ainda não chegou; quando chegar, o arquivo segue o
              formato dele.
            </p>
          </Panel>
        </div>
      </div>
    </RiPage>
  );
}
