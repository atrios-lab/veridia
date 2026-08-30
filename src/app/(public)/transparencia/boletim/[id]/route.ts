import {
  type BulletinStatus,
  bulletinBalanceCents,
  bulletinPeriod,
  formatMoneyBRL,
  formatMonthYear,
} from "@/core/transparency/bulletin.ts";
import { brandFor } from "@/lib/document-brand.ts";
import { type BulletinDocument, renderBulletin } from "@/lib/pdf.ts";
import { getBulletin } from "@/lib/transparency.ts";
import { requireSection } from "../../../_lib/section.ts";

export const runtime = "nodejs";

/**
 * The monthly bulletin as a PDF, generated on demand. GET and no key: it is a
 * public act, publicity is the point. Scoped to the office by `getBulletin`,
 * so a bulletin id from another tenant answers 404 even to someone who has it.
 * Nothing is stored: a bulletin is a handful of numbers, cheaper to redraw
 * than to keep a file in sync when a consolidated one replaces a preliminary.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const tenant = await requireSection("transparencia");
  const { id } = await params;

  const row = await getBulletin(tenant.slug, id);
  if (!row) return new Response("Não encontrado", { status: 404 });

  const [year, month] = row.referenceMonth.split("-").map(Number);
  const status = row.status as BulletinStatus;
  const balance = bulletinBalanceCents({
    actsCount: row.actsCount,
    grossRevenueCents: row.grossRevenueCents,
    taxesPaidCents: row.taxesPaidCents,
    expensesCents: row.expensesCents,
  });

  const document: BulletinDocument = {
    office: [tenant.name, tenant.subtitle],
    title: `Boletim Mensal, ${formatMonthYear(month, year)}`,
    period: bulletinPeriod(month, year),
    preliminary: status === "preliminary",
    rows: {
      actsCount: row.actsCount.toLocaleString("pt-BR"),
      grossRevenue: `R$ ${formatMoneyBRL(row.grossRevenueCents)}`,
      taxesPaid: `R$ ${formatMoneyBRL(row.taxesPaidCents)}`,
      expenses: `R$ ${formatMoneyBRL(row.expensesCents)}`,
    },
    balance: `R$ ${formatMoneyBRL(balance)}`,
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
