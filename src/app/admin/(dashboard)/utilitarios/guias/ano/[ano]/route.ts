import { can } from "@/core/auth/roles.ts";
import { renderGuidesPdf } from "@/lib/guide-files.ts";
import { getSession } from "@/lib/session.ts";
import { getGuideSettings, listGuides } from "@/lib/tax-guides.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/** Every live guia of a year as one PDF, oldest number first, to archive. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ano: string }> },
): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "requests.manage", session.user.permissions)
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const year = Number((await params).ano);
  if (!Number.isInteger(year))
    return new Response("Ano inválido", { status: 400 });
  const tenant = await getTenant();
  const guides = (await listGuides(tenant.slug, year)).reverse();
  if (guides.length === 0)
    return new Response("Nenhuma guia neste ano", { status: 404 });
  const bytes = await renderGuidesPdf(
    tenant,
    await getGuideSettings(tenant),
    guides,
  );
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="guias-de-recolhimento-${year}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
