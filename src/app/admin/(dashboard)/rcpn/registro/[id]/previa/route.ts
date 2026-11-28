import { can } from "@/core/auth/roles.ts";
import { isCertidaoForm, prefillCertidao } from "@/core/rcpn/certidao.ts";
import { applyFicha, fichaFields } from "@/core/rcpn/ficha.ts";
import { custasNoteFrom, custasNoteOfUrl } from "@/core/ri/closing-notes.ts";
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
  const role = session?.user.role ?? "";
  const permissions = session?.user.permissions;
  if (
    !session ||
    !(
      can(role, "rcpn.certidao", permissions) ||
      can(role, "rcpn.edit", permissions)
    )
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  const stored = await getRecordWith(db, tenant.slug, (await params).id);
  if (!stored) return new Response("Registro não encontrado", { status: 404 });
  // From the Alterar screen (POST): the ficha as it is typed, not saved,
  // to see how the certidão will come out before saving.
  let record: typeof stored = stored;
  let custas = custasNoteOfUrl(request.url);
  if (request.method === "POST") {
    const form = await request.formData();
    custas = custasNoteFrom(form.get("custas")) ?? custas;
    const values: Record<string, string> = {};
    for (const field of fichaFields(stored.kind)) {
      const value = form.get(field.key);
      if (typeof value === "string") values[field.key] = value;
    }
    record = { ...applyFicha(stored, values).record, id: stored.id };
  }
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
    custas,
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

export function POST(...args: Parameters<typeof handle>) {
  return renderingFor(args[0], () => handle(...args));
}
