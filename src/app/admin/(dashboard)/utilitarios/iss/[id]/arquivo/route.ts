import { can } from "@/core/auth/roles.ts";
import { issFileName } from "@/core/iss/declaration.ts";
import { db } from "@/db/index.ts";
import {
  findIssDeclarationWith,
  getIssSettings,
  renderIssDeclarationPdf,
} from "@/lib/iss-declarations.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/** The declaration with the month's book behind it, one PDF to print or sign. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "requests.manage", session.user.permissions)
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  const row = await findIssDeclarationWith(db, tenant.slug, (await params).id);
  if (!row) return new Response("Não encontrada", { status: 404 });
  const pdf = await renderIssDeclarationPdf(
    tenant,
    row,
    await getIssSettings(tenant),
  );
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${issFileName(row.competence)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
