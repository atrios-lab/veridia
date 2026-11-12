import { can } from "@/core/auth/roles.ts";
import { toIsoDate } from "@/core/scheduling/calendar.ts";
import { OFFICE_TIME_ZONE } from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import { findExcessWith, renderExcessPdf } from "@/lib/daily-book-excess.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/** The excess calculation's "memória de cálculo", to print or sign. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "daily-book.manage", session.user.permissions)
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  const calc = await findExcessWith(db, tenant.slug, (await params).id);
  if (!calc) return new Response("Não encontrado", { status: 404 });
  const pdf = await renderExcessPdf(
    tenant,
    calc,
    // Dated the day it was saved (or last edited), in the office's time.
    toIsoDate(new Date(calc.updatedAt ?? calc.createdAt), OFFICE_TIME_ZONE),
  );
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="excedente-${calc.start}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
