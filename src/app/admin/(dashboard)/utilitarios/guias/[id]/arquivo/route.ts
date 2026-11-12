import { can } from "@/core/auth/roles.ts";
import { guideFileName } from "@/core/guides/document.ts";
import { renderGuideDocx, renderGuidePdf } from "@/lib/guide-files.ts";
import { renderingFor } from "@/lib/pdf.ts";
import { getSession } from "@/lib/session.ts";
import { findGuide, getGuideSettings } from "@/lib/tax-guides.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

const DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** The guia as a PDF (inline, to print) or a Word file (to edit). */
async function handle(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "guides.manage", session.user.permissions)
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  const stored = await findGuide(tenant.slug, (await params).id);
  if (!stored) return new Response("Não encontrada", { status: 404 });
  const settings = await getGuideSettings(tenant);
  const word = new URL(request.url).searchParams.get("formato") === "docx";

  const bytes = word
    ? await renderGuideDocx(tenant, settings, stored)
    : await renderGuidePdf(tenant, settings, stored);
  const name = guideFileName(
    stored.year,
    stored.sequence,
    stored.guide.kind,
    word ? "docx" : "pdf",
  );
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": word ? DOCX : "application/pdf",
      "Content-Disposition": `${word ? "attachment" : "inline"}; filename="${name}"`,
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
