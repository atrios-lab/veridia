import { can } from "@/core/auth/roles.ts";
import { isCertidaoForm, prefillCertidao } from "@/core/rcpn/certidao.ts";
import { toIsoDate } from "@/core/scheduling/calendar.ts";
import { OFFICE_TIME_ZONE } from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import { renderingFor } from "@/lib/pdf.ts";
import { getRecordWith } from "@/lib/rcpn-certidao.ts";
import { renderCertidao } from "@/lib/rcpn-certidao-pdf.ts";
import { getSession } from "@/lib/session.ts";
import { getGuideSettings } from "@/lib/tax-guides.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/**
 * The certidão of a registro as it would come out today, marked "PRÉVIA",
 * to look at and print before issuing (decision of 14/11/2026). Nothing
 * is stored: no number, no selo, no audit.
 */
async function handle(
  request: Request,
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
  const record = await getRecordWith(db, tenant.slug, (await params).id);
  if (!record) return new Response("Registro não encontrado", { status: 404 });
  const via = new URL(request.url).searchParams.get("via");
  const form = isCertidaoForm(via) ? via : "breve";
  const signer = (await getGuideSettings(tenant)).signers[0];
  const pdf = await renderCertidao(tenant, {
    kind: record.kind,
    form,
    fields: prefillCertidao(record, form),
    seal: "",
    sealKind: "",
    fees: "",
    signerName: signer?.name ?? "",
    signerTitle: signer?.title ?? "",
    issuedOn: toIsoDate(new Date(), OFFICE_TIME_ZONE),
    preview: true,
  });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="previa-certidao-${form === "inteiro-teor" ? "inteiro-teor-" : ""}${record.kind}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export function GET(...args: Parameters<typeof handle>) {
  return renderingFor(args[0], () => handle(...args));
}
