import "server-only";
import { createHash } from "node:crypto";
import { officialName } from "@/core/tenant/identification.ts";
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
import { brandFor } from "./document-brand.ts";
import { type BulletinDocument, renderBulletin } from "./pdf.ts";
import type { StoredBulletin } from "./transparency.ts";

const money = (cents: number) => `R$ ${formatMoneyBRL(cents)}`;

/**
 * The monthly bulletin as a PDF (shared by the public route and by the
 * signing before publishing, decision of 11/11/2026). Drawn with the
 * office's option on private figures as it stands now.
 */
export async function renderBulletinPdf(
  tenant: Tenant,
  referenceMonth: string,
  status: BulletinStatus,
  stored: StoredBulletin,
): Promise<Buffer> {
  const [year, month] = referenceMonth.split("-").map(Number);
  const document: BulletinDocument = {
    office: [officialName(tenant), tenant.subtitle],
    title: `Boletim Mensal, ${formatMonthYear(month, year)}`,
    period: bulletinPeriod(month, year),
    preliminary: status === "preliminary",
    footer: `${officialName(tenant)} · ${tenant.legalFooter}`,
    ...bodyOf(stored, tenant),
  };
  return renderBulletin(document, await brandFor(tenant));
}

/**
 * What a signed bulletin covers: its figures, status and whether private
 * figures were shown. A signed copy is served only while this still holds,
 * so an edit or a change of the option never shows an outdated signature.
 */
export function bulletinFingerprint(
  tenant: Tenant,
  referenceMonth: string,
  status: BulletinStatus,
  stored: StoredBulletin,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        referenceMonth,
        status,
        privateFigures: tenant.publishBulletinPrivateFigures,
        stored,
      }),
    )
    .digest("hex");
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
