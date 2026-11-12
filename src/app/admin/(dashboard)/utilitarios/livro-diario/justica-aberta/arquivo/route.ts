import { can } from "@/core/auth/roles.ts";
import {
  parseSemester,
  semesterToFill,
} from "@/core/daily-book/justica-aberta.ts";
import { db } from "@/db/index.ts";
import { renderJusticaAbertaPdf } from "@/lib/daily-book-justica-aberta.ts";
import { renderingFor } from "@/lib/pdf.ts";
import { getSession } from "@/lib/session.ts";
import { getGuideSettings } from "@/lib/tax-guides.ts";
import { getTenant, today } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/** The semester's figures for the Justiça Aberta, to sign or print. */
async function handle(request: Request): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "daily-book.manage", session.user.permissions)
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  const now = today();
  const semester =
    parseSemester(new URL(request.url).searchParams.get("semestre") ?? "") ??
    parseSemester(semesterToFill(now));
  if (!semester) return new Response("Semestre inválido", { status: 400 });
  const signer = (await getGuideSettings(tenant)).signers[0] ?? null;
  const pdf = await renderJusticaAbertaPdf(db, tenant, semester, now, signer);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="justica-aberta-${semester.id}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/**
 * "Assinar digitalmente" asks for the version without the line to sign by
 * hand (`?assinatura=digital`); printing gets the line.
 */
export function GET(request: Request) {
  return renderingFor(request, () => handle(request));
}
