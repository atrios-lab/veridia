import { can } from "@/core/auth/roles.ts";
import { geoJsonOf, plantaSvg, shapeOf } from "@/core/ri/geo.ts";
import { propertyTitle } from "@/core/ri/property.ts";
import { db } from "@/db/index.ts";
import { propertyDetailWith } from "@/lib/ri.ts";
import { geometriesOfWith, verticesOf } from "@/lib/ri-geo.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/**
 * The planta of the matrícula's perímetro in force: SVG to print or put in
 * a document; `?formato=geojson` for a SIG.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "ri.view", session.user.permissions)
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  const id = (await params).id;
  const [detail, rows] = await Promise.all([
    propertyDetailWith(db, tenant.slug, id),
    geometriesOfWith(db, tenant.slug, id),
  ]);
  const current = rows.find((r) => !r.deletedAt);
  if (!detail || !current)
    return new Response("Não encontrado", { status: 404 });
  const title = propertyTitle(detail.property);
  const vertices = verticesOf(current);
  const name = `planta-${detail.property.number}`;
  if (new URL(request.url).searchParams.get("formato") === "geojson") {
    return new Response(geoJsonOf([{ id, label: title, vertices }]), {
      headers: {
        "Content-Type": "application/geo+json",
        "Content-Disposition": `attachment; filename="${name}.geojson"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  return new Response(plantaSvg(shapeOf(vertices), { title }), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `inline; filename="${name}.svg"`,
      "Cache-Control": "private, no-store",
    },
  });
}
