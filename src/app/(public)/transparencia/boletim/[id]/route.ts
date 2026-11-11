import type { BulletinStatus } from "@/core/transparency/bulletin.ts";
import { bulletinFingerprint, renderBulletinPdf } from "@/lib/bulletin-pdf.ts";
import { getBulletin, storedBulletinOf } from "@/lib/transparency.ts";
import { readStoredFile } from "@/lib/uploads.ts";
import { requireSection } from "../../../_lib/section.ts";

export const runtime = "nodejs";

/**
 * The monthly bulletin as a PDF, generated on demand. GET and no key: it is a
 * public act, publicity is the point. Scoped to the office by `getBulletin`,
 * so a bulletin id from another tenant answers 404 even to someone who has it.
 *
 * Signed before publishing (decision of 11/11/2026): the signed copy is
 * served while it still matches the figures and the office's option on
 * private figures; otherwise the bulletin is drawn again, unsigned.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const tenant = await requireSection("transparencia");
  const { id } = await params;

  const row = await getBulletin(tenant.slug, id);
  if (!row) return new Response("Não encontrado", { status: 404 });

  const stored = storedBulletinOf(row, tenant.location.state);
  if (!stored) {
    // Neither format: an error to see, never a bulletin of zeros nobody
    // typed.
    console.error("transparencia.bulletin.malformed", row.id);
    return new Response("Boletim indisponível", { status: 500 });
  }

  const status = row.status as BulletinStatus;
  const signed =
    row.signedPdfPath &&
    row.signedFingerprint ===
      bulletinFingerprint(tenant, row.referenceMonth, status, stored);
  const pdf = signed
    ? await readStoredFile(row.signedPdfPath as string).catch(() => null)
    : null;
  const bytes =
    pdf ??
    (await renderBulletinPdf(tenant, row.referenceMonth, status, stored));
  const name = `boletim-${row.referenceMonth.slice(0, 7)}${pdf ? "-assinado" : ""}.pdf`;

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      // Inline: a bulletin is read on screen, not filed away.
      "Content-Disposition": `inline; filename="${name}"`,
    },
  });
}
