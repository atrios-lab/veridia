import {
  BALANCE_LABEL,
  BULLETIN_LEGAL_BASIS,
  type BulletinStatus,
  bulletinPeriod,
  bulletinView,
  formatMoneyBRL,
  formatMonthYear,
  issLabel,
} from "@/core/transparency/bulletin.ts";
import { brandFor } from "@/lib/document-brand.ts";
import { type BulletinDocument, renderBulletin } from "@/lib/pdf.ts";
import { bulletinFiguresOf, getBulletin } from "@/lib/transparency.ts";
import { requireSection } from "../../../_lib/section.ts";

export const runtime = "nodejs";

const money = (cents: number) => `R$ ${formatMoneyBRL(cents)}`;

/**
 * The monthly bulletin as a PDF, generated on demand. GET and no key: it is a
 * public act, publicity is the point. Scoped to the office by `getBulletin`,
 * so a bulletin id from another tenant answers 404 even to someone who has it.
 * Nothing is stored: a bulletin is a handful of numbers, cheaper to redraw
 * than to keep a file in sync when a consolidated one replaces a preliminary.
 *
 * Drawn with the office's option as it stands now, not as it stood when the
 * month was published: switching the private figures off takes them off every
 * month at once.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const tenant = await requireSection("transparencia");
  const { id } = await params;

  const row = await getBulletin(tenant.slug, id);
  if (!row) return new Response("Não encontrado", { status: 404 });

  const figures = bulletinFiguresOf(row, tenant.location.state);
  if (!figures) {
    // A row whose funds are not the state's: an error to see, never a
    // bulletin of zeros nobody typed.
    console.error("transparencia.bulletin.malformed", row.id);
    return new Response("Boletim indisponível", { status: 500 });
  }

  const [year, month] = row.referenceMonth.split("-").map(Number);
  const status = row.status as BulletinStatus;
  const view = bulletinView(
    tenant.location.state,
    figures,
    tenant.publishBulletinPrivateFigures,
  );
  const privateFigures = view.privateFigures;

  const document: BulletinDocument = {
    office: [tenant.name, tenant.subtitle],
    title: `Boletim Mensal, ${formatMonthYear(month, year)}`,
    period: bulletinPeriod(month, year),
    preliminary: status === "preliminary",
    actsCount: view.actsCount.toLocaleString("pt-BR"),
    grossRevenue: privateFigures
      ? money(privateFigures.grossRevenueCents)
      : null,
    rubrics: view.rubrics.map((group) => ({
      title: `${group.rubric}. ${group.title}`,
      subtotal: money(group.subtotalCents),
      funds: group.funds.map((fund) => ({
        label: fund.label,
        amount: money(fund.amountCents),
      })),
    })),
    fundsTotal: money(view.fundsTotalCents),
    iss: {
      label: issLabel(tenant.location.city),
      amount: money(view.issCents),
    },
    expenses: privateFigures ? money(privateFigures.expensesCents) : null,
    balance: privateFigures
      ? { label: BALANCE_LABEL, amount: money(privateFigures.balanceCents) }
      : null,
    legalBasis: BULLETIN_LEGAL_BASIS,
    footer: `${tenant.name} · ${tenant.legalFooter}`,
  };

  const pdf = await renderBulletin(document, await brandFor(tenant));
  const name = `boletim-${row.referenceMonth.slice(0, 7)}.pdf`;

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // Inline: a bulletin is read on screen, not filed away.
      "Content-Disposition": `inline; filename="${name}"`,
    },
  });
}
