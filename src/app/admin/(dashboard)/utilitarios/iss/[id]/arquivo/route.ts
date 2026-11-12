import { can } from "@/core/auth/roles.ts";
import { issFileName } from "@/core/iss/declaration.ts";
import { db } from "@/db/index.ts";
import {
  findIssDeclarationWith,
  getIssSettings,
  renderIssDeclarationPdf,
  renderIssReceiptPdf,
} from "@/lib/iss-declarations.ts";
import { renderingFor } from "@/lib/pdf.ts";
import { getSession } from "@/lib/session.ts";
import { getGuideSettings } from "@/lib/tax-guides.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/**
 * The declaration with the month's book and reports behind it, one PDF to
 * print or sign; with `?via=protocolo`, the receipt the SEMUT stamps.
 */
async function handle(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "iss.manage", session.user.permissions)
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  const row = await findIssDeclarationWith(db, tenant.slug, (await params).id);
  if (!row) return new Response("Não encontrada", { status: 404 });
  const receipt = new URL(request.url).searchParams.get("via") === "protocolo";
  const settings = await getIssSettings(tenant);
  const pdf = receipt
    ? await renderIssReceiptPdf(tenant, row, settings)
    : await renderIssDeclarationPdf(
        tenant,
        row,
        settings,
        (await getGuideSettings(tenant)).signers,
      );
  const name = issFileName(row.competence);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${receipt ? name.replace("declaracao", "protocolo") : name}"`,
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
