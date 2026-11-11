import "server-only";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { type PaperKind, remainingIn } from "@/core/security-paper/stock.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { db } from "@/db/index.ts";
import { listSuppliersWith, supplierOf } from "@/lib/paper-orders.ts";
import { classifierWith } from "@/lib/security-paper.ts";
import { getSession } from "@/lib/session.ts";
import type { SupplierChoice } from "../forms.tsx";

/** The screens of the solicitação answer 404 without the permission. */
export async function requireOrderAccess() {
  const session = await getSession();
  if (
    !session ||
    !can(
      session.user.role ?? "",
      "paper-orders.manage",
      session.user.permissions,
    )
  ) {
    notFound();
  }
  return session;
}

/** Sheets in the drawer now, by papel de segurança kind. */
export async function stockByPaperKind(
  tenantSlug: string,
): Promise<Map<PaperKind, number>> {
  const { lots, movements } = await classifierWith(db, tenantSlug);
  const stock = new Map<PaperKind, number>();
  for (const lot of lots.filter((l) => !l.voided)) {
    stock.set(
      lot.kind,
      (stock.get(lot.kind) ?? 0) + remainingIn(lot, movements),
    );
  }
  return stock;
}

/** The suppliers for the order form, each item with its stock. */
export async function supplierChoices(
  tenant: Tenant,
): Promise<SupplierChoice[]> {
  const [rows, stock] = await Promise.all([
    listSuppliersWith(db, tenant.slug),
    stockByPaperKind(tenant.slug),
  ]);
  return rows.map((row) => {
    const s = supplierOf(row);
    return {
      id: row.id,
      name: s.name,
      freightOptions: s.freightOptions,
      paymentOptions: s.paymentOptions,
      items: s.items.map((i) => ({
        id: i.id,
        name: i.name,
        unit: i.unit,
        minimum: i.minimum,
        unitPriceCents: i.unitPriceCents,
        note: i.note,
        stock: i.paperKind ? (stock.get(i.paperKind) ?? 0) : null,
      })),
    };
  });
}
