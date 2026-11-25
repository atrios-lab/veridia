import { can } from "@/core/auth/roles.ts";
import { latin1 } from "@/core/ri/onr.ts";
import { db } from "@/db/index.ts";
import { exportFileWith } from "@/lib/ri.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

/** The file as it was generated, for the office to import in the ONR. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "ri.view", session.user.permissions)
  ) {
    return new Response("Não encontrado.", { status: 404 });
  }
  const tenant = await getTenant();
  const row = await exportFileWith(db, tenant.slug, (await params).id);
  if (!row || row.withdrawnAt) {
    return new Response("Não encontrado.", { status: 404 });
  }
  const pessoal = row.kind === "indicador-pessoal";
  const body = pessoal ? latin1(row.content) : row.content;
  const type = row.fileName.endsWith(".json")
    ? "application/json; charset=utf-8"
    : pessoal
      ? "application/xml; charset=iso-8859-1"
      : "application/xml; charset=utf-8";
  return new Response(body as BodyInit, {
    headers: {
      "content-type": type,
      "content-disposition": `attachment; filename="${row.fileName}"`,
      "cache-control": "no-store",
    },
  });
}
