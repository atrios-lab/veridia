import { can } from "@/core/auth/roles.ts";
import { cleanCertidaoFields, isCertidaoForm } from "@/core/rcpn/certidao.ts";
import { toIsoDate } from "@/core/scheduling/calendar.ts";
import { OFFICE_TIME_ZONE } from "@/core/time/office-time.ts";
import { renderingFor } from "@/lib/pdf.ts";
import { isRcpnKind } from "@/lib/rcpn-certidao.ts";
import { renderCertidao } from "@/lib/rcpn-certidao-pdf.ts";
import { getSession } from "@/lib/session.ts";
import { getGuideSettings } from "@/lib/tax-guides.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/**
 * The certidão as it is typed on the form, before "Emitir": marked
 * "PRÉVIA", to look at and print (decision of 14/11/2026). Nothing is
 * stored and the selo is not used.
 */
async function handle(request: Request): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "rcpn.certidao", session.user.permissions)
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  const formData = await request.formData();
  const text = (key: string) => String(formData.get(key) ?? "").slice(0, 20000);
  const kind = text("tipo");
  if (!isRcpnKind(kind)) {
    return new Response("Escolha o tipo de certidão.", { status: 400 });
  }
  const via = text("via");
  const form = isCertidaoForm(via) ? via : "breve";
  const typed: Record<string, string> = {};
  for (const [name, value] of formData.entries()) {
    if (name.startsWith("campo.") && typeof value === "string") {
      typed[name.slice("campo.".length)] = value.slice(0, 20000);
    }
  }
  let signerName = text("assinanteNome");
  let signerTitle = text("assinanteCargo");
  const chosen = text("assinante");
  if (chosen !== "" && chosen !== "outro") {
    const signer = (await getGuideSettings(tenant)).signers[Number(chosen)];
    if (signer) {
      signerName = signer.name;
      signerTitle = signer.title;
    }
  }
  const pdf = await renderCertidao(tenant, {
    kind,
    form,
    fields: cleanCertidaoFields(kind, typed, form),
    seal: text("selo").slice(0, 120),
    sealKind: text("seloTipo").slice(0, 60),
    fees: text("emolumentos").slice(0, 600),
    signerName: signerName.slice(0, 200),
    signerTitle: signerTitle.slice(0, 200),
    issuedOn: toIsoDate(new Date(), OFFICE_TIME_ZONE),
    preview: true,
  });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="previa-certidao-${kind}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export function POST(request: Request) {
  return renderingFor(request, () => handle(request));
}
