import { can } from "@/core/auth/roles.ts";
import { isCertidaoForm } from "@/core/rcpn/certidao.ts";
import type { RcpnKind } from "@/core/rcpn/record.ts";
import { toIsoDate } from "@/core/scheduling/calendar.ts";
import { OFFICE_TIME_ZONE } from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import { renderingFor } from "@/lib/pdf.ts";
import { getCertidaoWith } from "@/lib/rcpn-certidao.ts";
import { renderCertidao } from "@/lib/rcpn-certidao-pdf.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/** The certidão in the national model, to print or to sign digitally. */
async function handle(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "rcpn.certidao", session.user.permissions)
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  const row = await getCertidaoWith(db, tenant.slug, (await params).id);
  if (!row) return new Response("Não encontrada", { status: 404 });
  const pdf = await renderCertidao(tenant, {
    kind: row.kind as RcpnKind,
    form: isCertidaoForm(row.form) ? row.form : "breve",
    fields: (row.fields ?? {}) as Record<string, string>,
    seal: row.seal,
    sealKind: row.sealKind,
    fees: row.fees,
    signerName: row.signerName,
    signerTitle: row.signerTitle,
    issuedOn: toIsoDate(row.createdAt, OFFICE_TIME_ZONE),
  });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="certidao-${row.form === "inteiro-teor" ? "inteiro-teor-" : ""}${row.kind}.pdf"`,
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
