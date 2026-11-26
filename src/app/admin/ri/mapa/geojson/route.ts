import { can } from "@/core/auth/roles.ts";
import { geoJsonOf } from "@/core/ri/geo.ts";
import { propertyTitle } from "@/core/ri/property.ts";
import { db } from "@/db/index.ts";
import { loadAcervoWith } from "@/lib/ri.ts";
import { currentGeometriesWith, verticesOf } from "@/lib/ri-geo.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/** Every perímetro in force, as one GeoJSON (for the SIG-RI or any SIG). */
export async function GET(): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "ri.export", session.user.permissions)
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  const [rows, acervo] = await Promise.all([
    currentGeometriesWith(db, tenant.slug),
    loadAcervoWith(db, tenant.slug),
  ]);
  const byId = new Map(acervo.properties.map((p) => [p.id, p]));
  const items = rows.flatMap((r) => {
    const p = byId.get(r.propertyId);
    return p
      ? [{ id: p.id, label: propertyTitle(p), vertices: verticesOf(r) }]
      : [];
  });
  return new Response(geoJsonOf(items), {
    headers: {
      "Content-Type": "application/geo+json",
      "Content-Disposition":
        'attachment; filename="mapa-registro-de-imoveis.geojson"',
      "Cache-Control": "private, no-store",
    },
  });
}
