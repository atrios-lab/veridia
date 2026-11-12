import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import {
  findBookReportWith,
  renderBalanceOficioPdf,
  snapshotOf,
} from "@/lib/daily-book.ts";
import { renderingFor } from "@/lib/pdf.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { listBulletins } from "@/lib/transparency.ts";

export const runtime = "nodejs";

/**
 * The ofício that sends the year's balance to the Corregedoria, with the
 * balance after it, to sign digitally or print and sign.
 */
async function handle(
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
  const row = await findBookReportWith(db, tenant.slug, (await params).id);
  if (!row || row.removedAt) {
    return new Response("Não encontrada", { status: 404 });
  }
  const s = snapshotOf(row);
  if (s.kind !== "ano" || !s.oficio) {
    return new Response("Salve o ofício antes de gerar o PDF.", {
      status: 404,
    });
  }
  // The portal is named only when every month of the year was published:
  // the ofício says nothing the office cannot show.
  const year = s.start.slice(0, 4);
  const published = new Set(
    (await listBulletins(tenant.slug).catch(() => []))
      .map((b) => String(b.referenceMonth).slice(0, 7))
      .filter((m) => m.startsWith(year)),
  );
  const host = tenant.hosts[0];
  const pdf = await renderBalanceOficioPdf(tenant, row, {
    transparencyUrl:
      published.size === 12 && host
        ? `https://${host}/transparencia`
        : undefined,
  });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="oficio-balanco-anual-${year}.pdf"`,
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
