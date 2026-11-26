import { Download, Map as MapIcon } from "lucide-react";
import Link from "next/link";
import { areaCheck, areaText, plantaSvg, shapeOf } from "@/core/ri/geo.ts";
import type { GeometryRow, Overlap } from "@/lib/ri-geo.ts";
import { verticesOf } from "@/lib/ri-geo.ts";
import { buttonVariants } from "../../_ui/button.tsx";
import { stamp } from "../_lib.ts";
import { setGeometryDeletedAction } from "../actions.ts";
import { ConfirmButton } from "./client.tsx";
import { GeoForm } from "./geo-form.tsx";
import { Panel } from "./page.tsx";

/**
 * The georreferenciamento of a matrícula: the planta of the perímetro in
 * force, its área against the matrícula's, the sides, the sobreposições
 * with other imóveis, and how to do it (Lei nº 6.015/1973, art. 176).
 */
export function GeoPanel({
  propertyId,
  title,
  area,
  rows,
  overlaps,
  labels,
  acts,
  canEdit,
}: {
  propertyId: string;
  title: string;
  area: string;
  rows: GeometryRow[];
  overlaps: Overlap[];
  labels: Map<string, string>;
  acts: { id: string; label: string }[];
  canEdit: boolean;
}) {
  const current = rows.find((r) => !r.deletedAt);
  const shape = current ? shapeOf(verticesOf(current)) : null;
  const check = shape ? areaCheck(area, shape.areaM2) : null;
  const mine = overlaps.filter((o) => o.a === propertyId || o.b === propertyId);
  return (
    <Panel
      title="Georreferenciamento e planta"
      description="O perímetro do memorial descritivo ou do Sigef, desenhado em escala, com área, perímetro e sobreposições (coordenadas no Sistema Geodésico Brasileiro, SIRGAS 2000)."
      actions={
        <Link
          href="/admin/ri/mapa"
          className={buttonVariants({ size: "sm", variant: "outline" })}
        >
          <MapIcon className="size-4" /> Mapa da serventia
        </Link>
      }
    >
      {current && shape ? (
        <div className="flex flex-col gap-3">
          <div
            className="overflow-hidden rounded-lg border bg-background"
            // The SVG is built here from numbers and escaped codes.
            // biome-ignore lint/security/noDangerouslySetInnerHtml: generated SVG, no user markup
            dangerouslySetInnerHTML={{
              __html: plantaSvg(shape, { title, size: 520 }),
            }}
          />
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Área calculada</dt>
              <dd>{areaText(shape.areaM2)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Perímetro</dt>
              <dd>
                {shape.perimeterM.toLocaleString("pt-BR", {
                  maximumFractionDigits: 2,
                })}{" "}
                m
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Vértices · fuso</dt>
              <dd>
                {shape.points.length} · UTM {shape.zone}
                {current.sigefCode ? ` · Sigef ${current.sigefCode}` : ""}
              </dd>
            </div>
          </dl>
          {check && (
            <p
              className={`rounded-md px-3 py-2 text-sm ${check.ok ? "bg-muted" : "bg-warning-soft text-warning-text"}`}
            >
              {check.text}
            </p>
          )}
          {mine.length > 0 ? (
            <ul className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {mine.map((o) => {
                const other = o.a === propertyId ? o.b : o.a;
                return (
                  <li key={other}>
                    Sobrepõe a{" "}
                    <Link
                      href={`/admin/ri/matriculas/${other}`}
                      className="font-semibold underline"
                    >
                      {labels.get(other) ?? "outra matrícula"}
                    </Link>{" "}
                    em {areaText(o.areaM2)}. Confira os memoriais antes de
                    registrar.
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              Nenhuma sobreposição com os perímetros lançados na serventia.
            </p>
          )}
          <details className="text-sm">
            <summary className="cursor-pointer font-medium">
              Lados (azimute e distância)
            </summary>
            <table className="mt-2 w-full text-left text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-1">De</th>
                  <th className="py-1">Para</th>
                  <th className="py-1">Azimute</th>
                  <th className="py-1">Distância</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {shape.sides.map((s) => (
                  <tr key={`${s.from}-${s.to}`}>
                    <td className="py-1">{s.from}</td>
                    <td className="py-1">{s.to}</td>
                    <td className="py-1">
                      {s.azimuth.toLocaleString("pt-BR", {
                        maximumFractionDigits: 4,
                      })}
                      °
                    </td>
                    <td className="py-1">
                      {s.distance.toLocaleString("pt-BR", {
                        maximumFractionDigits: 2,
                      })}{" "}
                      m
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          <div className="flex flex-wrap gap-2">
            <a
              href={`/admin/ri/matriculas/${propertyId}/planta`}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              <Download className="size-4" /> Planta (SVG)
            </a>
            <a
              href={`/admin/ri/matriculas/${propertyId}/planta?formato=geojson`}
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              <Download className="size-4" /> GeoJSON
            </a>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nenhum perímetro lançado.
        </p>
      )}

      {canEdit && (
        <div className="mt-4 rounded-lg border border-dashed p-3">
          <GeoForm propertyId={propertyId} acts={acts} />
        </div>
      )}

      {rows.length > 0 && (
        <details className="mt-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer">
            Perímetros lançados ({rows.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-2">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <span className={r.deletedAt ? "line-through" : ""}>
                  {stamp(r.createdAt)} ·{" "}
                  {r.source === "sigef" ? "planilha do Sigef" : "memorial"} ·{" "}
                  {areaText(r.areaM2)}
                  {r.id === current?.id ? " · em vigor" : ""}
                </span>
                {canEdit && (
                  <ConfirmButton
                    action={setGeometryDeletedAction}
                    fields={{
                      id: r.id,
                      op: r.deletedAt ? "restore" : "delete",
                    }}
                    trigger={r.deletedAt ? "Restaurar" : "Apagar"}
                    question={
                      r.deletedAt
                        ? "Restaurar este perímetro?"
                        : "Apagar este perímetro?"
                    }
                    consequence="Ele continua guardado. Escreva a justificativa."
                    confirmLabel={r.deletedAt ? "Restaurar" : "Apagar"}
                    pendingLabel="Salvando…"
                    destructive={!r.deletedAt}
                  />
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      <details className="mt-3 rounded-lg border bg-background px-3 py-2 text-sm">
        <summary className="cursor-pointer font-medium">Como fazer</summary>
        <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5">
          <li>
            Confira o memorial descritivo com a ART: ele traz as coordenadas dos
            vértices georreferenciadas ao Sistema Geodésico Brasileiro.
            <span className="block text-xs text-muted-foreground">
              Fonte: Lei nº 6.015/1973, art. 176, § 3º; Decreto nº 4.449/2002,
              art. 9º
            </span>
          </li>
          <li>
            Confira a certificação do Incra (Sigef): ela atesta que a poligonal
            não se sobrepõe a outra do cadastro. A certificação não reconhece
            domínio.
            <span className="block text-xs text-muted-foreground">
              Fonte: Lei nº 6.015/1973, art. 176, § 5º; Decreto nº 4.449/2002,
              art. 9º, §§ 1º e 2º
            </span>
          </li>
          <li>
            Imóvel rural: a identificação georreferenciada é exigida, a partir
            de 21/10/2029, em todo desmembramento, parcelamento, remembramento e
            transferência (os prazos por faixa de área foram revogados).
            <span className="block text-xs text-muted-foreground">
              Fonte: Decreto nº 4.449/2002, art. 10 (redação do Decreto nº
              12.689/2025); Lei nº 6.015/1973, art. 176, § 4º
            </span>
          </li>
          <li>
            Lance aqui a planilha ou o memorial, confira a área e as
            sobreposições e averbe o georreferenciamento na matrícula; se o
            memorial alterar a descrição, a matrícula nova encerra a anterior.
            <span className="block text-xs text-muted-foreground">
              Fonte: Decreto nº 4.449/2002, art. 9º, § 5º
            </span>
          </li>
        </ol>
      </details>
    </Panel>
  );
}
