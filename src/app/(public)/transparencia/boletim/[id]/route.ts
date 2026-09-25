import type { Tenant } from "@/core/tenant/schema.ts";
import {
  BALANCE_LABEL,
  BULLETIN_LEGAL_BASIS,
  type BulletinStatus,
  bulletinPeriod,
  bulletinView,
  formatMoneyBRL,
  formatMonthYear,
  issLabel,
  LEGACY_BULLETIN_NOTE,
  legacyBulletinView,
  legacyTaxesLabel,
} from "@/core/transparency/bulletin.ts";
import { brandFor } from "@/lib/document-brand.ts";
import { type BulletinDocument, renderBulletin } from "@/lib/pdf.ts";
import {
  getBulletin,
  type StoredBulletin,
  storedBulletinOf,
} from "@/lib/transparency.ts";
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

  const stored = storedBulletinOf(row, tenant.location.state);
  if (!stored) {
    // Neither format: an error to see, never a bulletin of zeros nobody
    // typed.
    console.error("transparencia.bulletin.malformed", row.id);
    return new Response("Boletim indisponível", { status: 500 });
  }

  const [year, month] = row.referenceMonth.split("-").map(Number);
  const status = row.status as BulletinStatus;
  const document: BulletinDocument = {
    office: [tenant.name, tenant.subtitle],
    title: `Boletim Mensal, ${formatMonthYear(month, year)}`,
    period: bulletinPeriod(month, year),
    preliminary: status === "preliminary",
    footer: `${tenant.name} · ${tenant.legalFooter}`,
    ...bodyOf(stored, tenant),
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

type BulletinBody = Omit<
  BulletinDocument,
  "office" | "title" | "period" | "preliminary" | "footer"
>;

/**
 * The figures of a bulletin, in the format it was published in. Either way
 * the private figures follow the office's option as it stands now: switching
 * it off takes gross revenue, expenses and balance off every month at once,
 * old ones included.
 */
function bodyOf(stored: StoredBulletin, tenant: Tenant): BulletinBody {
  const publish = tenant.publishBulletinPrivateFigures;

  if (stored.kind === "legacy") {
    const view = legacyBulletinView(stored.figures, publish);
    const priv = view.privateFigures;
    return {
      actsCount: view.actsCount.toLocaleString("pt-BR"),
      grossRevenue: priv ? money(priv.grossRevenueCents) : null,
      rubrics: [],
      fundsTotal: null,
      iss: null,
      taxes: {
        label: legacyTaxesLabel(tenant.location.state),
        amount: money(view.taxesCents),
      },
      expenses: priv ? money(priv.expensesCents) : null,
      balance: priv
        ? { label: BALANCE_LABEL, amount: money(priv.balanceCents) }
        : null,
      note: LEGACY_BULLETIN_NOTE,
    };
  }

  const view = bulletinView(tenant.location.state, stored.figures, publish);
  const priv = view.privateFigures;
  return {
    actsCount: view.actsCount.toLocaleString("pt-BR"),
    grossRevenue: priv ? money(priv.grossRevenueCents) : null,
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
    taxes: null,
    expenses: priv ? money(priv.expensesCents) : null,
    balance: priv
      ? { label: BALANCE_LABEL, amount: money(priv.balanceCents) }
      : null,
    note: BULLETIN_LEGAL_BASIS,
  };
}
