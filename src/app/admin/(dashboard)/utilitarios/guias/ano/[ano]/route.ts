import { can } from "@/core/auth/roles.ts";
import { renderGuidesPdf } from "@/lib/guide-files.ts";
import { renderingFor } from "@/lib/pdf.ts";
import { getSession } from "@/lib/session.ts";
import { getGuideSettings, listGuides } from "@/lib/tax-guides.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/** Every live guia of a year as one PDF, oldest number first, to archive. */
async function handle(
  _request: Request,
  { params }: { params: Promise<{ ano: string }> },
): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "guides.manage", session.user.permissions)
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

/**
 * "Assinar digitalmente" asks for the version without the line to sign by
 * hand (`?assinatura=digital`); printing gets the line.
 */
export function GET(...args: Parameters<typeof handle>) {
  return renderingFor(args[0], () => handle(...args));
}
