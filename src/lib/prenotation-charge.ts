import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getAct } from "@/core/acts/catalog.ts";
import {
  type FeeItem,
  formatMoney,
  isPrenotationAttribution,
  type PrenotationAttribution,
} from "@/core/fees/prenotation.ts";
import {
  type PrenotationCharge,
  readPrenotation,
  type ServiceRequestStatus,
} from "@/core/request/kinds.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { type Database, db } from "@/db/index.ts";
import { serviceRequests, tenantContent } from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";
import { currentPrenotation, readNewFeeTable } from "./fee-tables.ts";
import { today } from "./office-config.ts";
import {
  findByIdWith,
  reconcileDeadlinePauseWith,
  updateRequestStatusWith,
} from "./service-request.ts";

/**
 * The prenotação charged before the analysis (decision of 22/11/2026): for
 * the acts of Registro de Imóveis, Títulos e Documentos and Pessoas
 * Jurídicas, the value of the prenotação is asked as soon as the signed
 * requerimento is in (or the pedido is filed at the counter), the pedido
 * waits for the payment, and only once the office confirms it does the
 * title go to analysis. Then comes the exigência or the positive answer,
 * and only then the value of the act and its execution.
 *
 * The Tabelião can switch it off at any time (Configurações › Cobrança):
 * the pedidos then go as before, analysed first, with nothing charged up
 * front.
 *
 * The value is always the current fee table's, never typed: it is read again
 * when the pedido is released and every time the table changes, while the
 * citizen has not paid yet (`repricePendingPrenotationsWith`).
 */

export const PRENOTATION_CHARGE_KEY = "prenotation-charge";

export interface PrenotationChargeSetting {
  enabled: boolean;
  /** When and by whom it was last switched; absent while never touched. */
  at?: string;
  by?: string;
}

/** On unless the Tabelião switched it off. */
export async function getPrenotationChargeSettingWith(
  database: Database,
  tenantSlug: string,
): Promise<PrenotationChargeSetting> {
  const [row] = await database
    .select({ published: tenantContent.published })
    .from(tenantContent)
    .where(
      and(
        eq(tenantContent.tenantSlug, tenantSlug),
        eq(tenantContent.key, PRENOTATION_CHARGE_KEY),
      ),
    )
    .limit(1);
  const value = row?.published as Partial<PrenotationChargeSetting> | null;
  return {
    enabled: value?.enabled !== false,
    ...(value?.at ? { at: value.at } : {}),
    ...(value?.by ? { by: value.by } : {}),
  };
}

export function getPrenotationChargeSetting(
  tenantSlug: string,
): Promise<PrenotationChargeSetting> {
  return getPrenotationChargeSettingWith(db, tenantSlug);
}

export async function setPrenotationChargeSettingWith(
  database: Database,
  tenantSlug: string,
  enabled: boolean,
  actorId: string,
): Promise<void> {
  const value: PrenotationChargeSetting = {
    enabled,
    at: new Date().toISOString(),
    by: actorId,
  };
  await database
    .insert(tenantContent)
    .values({
      tenantSlug,
      key: PRENOTATION_CHARGE_KEY,
      published: value,
      updatedBy: actorId,
    })
    .onConflictDoUpdate({
      target: [tenantContent.tenantSlug, tenantContent.key],
      set: { published: value, updatedAt: new Date(), updatedBy: actorId },
    });
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: enabled
      ? "office-settings.prenotation-charge-on"
      : "office-settings.prenotation-charge-off",
    targetType: "office-settings",
    targetId: PRENOTATION_CHARGE_KEY,
  });
}

/** What the table in force asks for a prenotação of this attribution. */
export type PrenotationPrice = (
  attribution: PrenotationAttribution,
) => Promise<
  { item: FeeItem; tableTitle: string; documentId: string } | undefined
>;

export function tablePrice(tenant: Tenant): PrenotationPrice {
  return (attribution) => currentPrenotation(tenant, attribution);
}

/** The attribution whose prenotação a pedido pays, when its act has one. */
export function prenotationAttributionOf(
  actId: string | null,
): PrenotationAttribution | undefined {
  const act = actId ? getAct(actId) : undefined;
  return act?.chargesPrenotation && isPrenotationAttribution(act.attribution)
    ? act.attribution
    : undefined;
}

/** Charged and not settled yet: neither paid nor skipped. */
export function prenotationPending(
  charge: PrenotationCharge | undefined,
): charge is PrenotationCharge {
  return Boolean(charge && !charge.paidAt && !charge.skippedAt);
}

async function writeCharge(
  database: Database,
  tenantSlug: string,
  requestId: string,
  charge: PrenotationCharge,
  amountCents: number | null | undefined,
): Promise<void> {
  await database
    .update(serviceRequests)
    .set({
      // Merged, never assigned over: the consents live in the same column.
      details: sql`${serviceRequests.details} || ${JSON.stringify({ prenotation: charge })}::jsonb`,
      ...(amountCents !== undefined ? { amountCents } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.id, requestId),
      ),
    );
}

/**
 * The charge at the price of the table in force: the same one when nothing
 * changed, a new one (keeping the old price in `repriced`) when the table
 * did. Undefined when the table has no prenotação item for it.
 */
async function freshCharge(
  charge: PrenotationCharge | undefined,
  attribution: PrenotationAttribution,
  price: PrenotationPrice,
): Promise<{ charge: PrenotationCharge; changed: boolean } | undefined> {
  const found = await price(attribution);
  if (!found) return charge ? { charge, changed: false } : undefined;
  const next = {
    ...found.item,
    tableTitle: found.tableTitle,
    tableId: found.documentId,
  };
  if (!charge) return { charge: next, changed: true };
  if (charge.totalCents === next.totalCents && charge.code === next.code) {
    return { charge, changed: false };
  }
  return {
    changed: true,
    charge: {
      ...charge,
      ...next,
      repriced: [
        ...(charge.repriced ?? []),
        {
          totalCents: charge.totalCents,
          code: charge.code,
          tableTitle: charge.tableTitle,
          at: new Date().toISOString(),
        },
      ].slice(-20),
    },
  };
}

async function auditReprice(
  database: Database,
  tenantSlug: string,
  requestId: string,
  before: PrenotationCharge,
  after: PrenotationCharge,
  actorId: string | null,
) {
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "service-request.prenotation-repriced",
    targetType: "service-request",
    targetId: requestId,
    reason: `${formatMoney(before.totalCents)} → ${formatMoney(after.totalCents)} (código ${after.code}, ${after.tableTitle})`,
  });
}

/**
 * The requerimento was accepted (by its digital signature, or checked by the
 * office): where the pedido goes now. With the charge on and a prenotação to
 * pay, it waits for the payment at the table's current price; otherwise it
 * goes to the office as "Novo", as before. Returns the andamento reached.
 */
export async function releaseRequestWith(
  database: Database,
  tenant: Tenant,
  requestId: string,
  actorId: string | null,
  price: PrenotationPrice,
): Promise<ServiceRequestStatus> {
  const request = await findByIdWith(database, tenant.slug, requestId);
  if (!request) throw new Error("Pedido não encontrado.");
  const attribution = prenotationAttributionOf(request.actId);
  const stored = readPrenotation(request.details);
  const setting = await getPrenotationChargeSettingWith(database, tenant.slug);

  let status: ServiceRequestStatus = "new";
  if (attribution && setting.enabled && !stored?.paidAt) {
    const fresh = await freshCharge(
      stored?.skippedAt ? undefined : stored,
      attribution,
      price,
    );
    if (fresh && fresh.charge.totalCents > 0) {
      await writeCharge(
        database,
        tenant.slug,
        requestId,
        fresh.charge,
        fresh.charge.totalCents,
      );
      if (stored && fresh.changed) {
        await auditReprice(
          database,
          tenant.slug,
          requestId,
          stored,
          fresh.charge,
          actorId,
        );
      }
      status = "awaiting-payment";
    }
  } else if (prenotationPending(stored) && !setting.enabled) {
    // Charged on filing, but the Tabelião switched the charge off since:
    // the pedido is analysed first, with nothing asked up front.
    await writeCharge(
      database,
      tenant.slug,
      requestId,
      { ...stored, skippedAt: new Date().toISOString() },
      null,
    );
  }
  await updateRequestStatusWith(
    database,
    tenant.slug,
    requestId,
    status,
    actorId,
  );
  await reconcileDeadlinePauseWith(
    database,
    tenant,
    requestId,
    actorId,
    today(),
  );
  return status;
}

/** The production singleton. */
export function releaseRequest(
  tenant: Tenant,
  requestId: string,
  actorId: string | null,
): Promise<ServiceRequestStatus> {
  return releaseRequestWith(db, tenant, requestId, actorId, tablePrice(tenant));
}

/**
 * A pedido filed at the counter for an act with prenotação: charged at once
 * (the requerimento is signed there, in front of the clerk) and waiting for
 * the payment. Returns the charge, or undefined when nothing was charged
 * (the charge off, or no prenotação item in the table).
 */
export async function chargeAtCounterWith(
  database: Database,
  tenant: Tenant,
  requestId: string,
  actorId: string,
  price: PrenotationPrice,
): Promise<PrenotationCharge | undefined> {
  const request = await findByIdWith(database, tenant.slug, requestId);
  const attribution = prenotationAttributionOf(request?.actId ?? null);
  if (!request || !attribution) return undefined;
  const setting = await getPrenotationChargeSettingWith(database, tenant.slug);
  if (!setting.enabled) return undefined;
  const fresh = await freshCharge(undefined, attribution, price);
  if (!fresh || fresh.charge.totalCents <= 0) return undefined;
  await writeCharge(
    database,
    tenant.slug,
    requestId,
    fresh.charge,
    fresh.charge.totalCents,
  );
  await recordAuditWith(database, {
    tenantSlug: tenant.slug,
    actorId,
    action: "service-request.amount",
    targetType: "service-request",
    targetId: requestId,
    reason: `prenotação ${formatMoney(fresh.charge.totalCents)} (código ${fresh.charge.code})`,
  });
  await updateRequestStatusWith(
    database,
    tenant.slug,
    requestId,
    "awaiting-payment",
    actorId,
  );
  await reconcileDeadlinePauseWith(
    database,
    tenant,
    requestId,
    actorId,
    today(),
  );
  return fresh.charge;
}

export function chargeAtCounter(
  tenant: Tenant,
  requestId: string,
  actorId: string,
): Promise<PrenotationCharge | undefined> {
  return chargeAtCounterWith(
    db,
    tenant,
    requestId,
    actorId,
    tablePrice(tenant),
  );
}

export class PrenotationError extends Error {}

/**
 * "Pagamento conferido": by the comprovante the citizen sent, or paid in
 * person at the counter. The prenotação is marked paid, the amount is
 * cleared (the value of the act comes after the analysis) and the pedido
 * goes to analysis.
 */
export async function confirmPrenotationPaymentWith(
  database: Database,
  tenant: Tenant,
  requestId: string,
  actorId: string,
  how: "receipt" | "counter",
): Promise<void> {
  const request = await findByIdWith(database, tenant.slug, requestId);
  const charge = readPrenotation(request?.details);
  if (!request || !prenotationPending(charge)) {
    throw new PrenotationError("Este pedido não tem prenotação a pagar.");
  }
  if (
    request.status !== "awaiting-payment" &&
    request.status !== "payment-reported"
  ) {
    throw new PrenotationError(
      "O pedido não está aguardando o pagamento da prenotação.",
    );
  }
  await writeCharge(
    database,
    tenant.slug,
    requestId,
    {
      ...charge,
      paidAt: new Date().toISOString(),
      paidBy: actorId,
      paidHow: how,
    },
    null,
  );
  await recordAuditWith(database, {
    tenantSlug: tenant.slug,
    actorId,
    action: "service-request.prenotation-paid",
    targetType: "service-request",
    targetId: requestId,
    reason: `${formatMoney(charge.totalCents)}, ${how === "counter" ? "pago no balcão, à vista do funcionário" : "pelo comprovante enviado"}`,
  });
  await updateRequestStatusWith(
    database,
    tenant.slug,
    requestId,
    "in-review",
    actorId,
  );
  await reconcileDeadlinePauseWith(
    database,
    tenant,
    requestId,
    actorId,
    today(),
  );
}

export function confirmPrenotationPayment(
  tenant: Tenant,
  requestId: string,
  actorId: string,
  how: "receipt" | "counter",
): Promise<void> {
  return confirmPrenotationPaymentWith(db, tenant, requestId, actorId, how);
}

/** Andamentos in which an unpaid prenotação follows the table: the citizen
 * has not sent a comprovante of the old price. */
const REPRICEABLE: ServiceRequestStatus[] = [
  "awaiting-signed-form",
  "new",
  "awaiting-payment",
];

/**
 * The fee table changed (a new one made current, the prenotação items
 * corrected): every prenotação not paid yet takes the new price, with the
 * old one kept in its history and the change in the audit. A comprovante
 * already sent is never repriced under it. Returns how many changed.
 */
export async function repricePendingPrenotationsWith(
  database: Database,
  tenant: Tenant,
  price: PrenotationPrice,
  actorId: string | null,
): Promise<number> {
  const rows = await database
    .select({
      id: serviceRequests.id,
      actId: serviceRequests.actId,
      status: serviceRequests.status,
      details: serviceRequests.details,
      amountCents: serviceRequests.amountCents,
    })
    .from(serviceRequests)
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenant.slug),
        eq(serviceRequests.kind, "service-request"),
        inArray(serviceRequests.status, REPRICEABLE),
        sql`${serviceRequests.details} ? 'prenotation'`,
      ),
    );
  // One read of the table per attribution, however many pedidos.
  const seen = new Map<PrenotationAttribution, ReturnType<PrenotationPrice>>();
  const once: PrenotationPrice = (attribution) => {
    const known = seen.get(attribution);
    if (known) return known;
    const read = price(attribution);
    seen.set(attribution, read);
    return read;
  };
  let changed = 0;
  for (const row of rows) {
    const charge = readPrenotation(row.details);
    const attribution = prenotationAttributionOf(row.actId);
    if (!attribution || !prenotationPending(charge)) continue;
    const fresh = await freshCharge(charge, attribution, once);
    if (!fresh?.changed) continue;
    // The amount follows only while it is the prenotação's own.
    const amount =
      row.amountCents === charge.totalCents
        ? fresh.charge.totalCents
        : undefined;
    await writeCharge(database, tenant.slug, row.id, fresh.charge, amount);
    await auditReprice(
      database,
      tenant.slug,
      row.id,
      charge,
      fresh.charge,
      actorId,
    );
    changed++;
  }
  return changed;
}

/** The production singleton; a failure never takes the screen that called
 * it down (the next change of the table, or the next release, retries). */
export async function repricePendingPrenotations(
  tenant: Tenant,
  actorId: string | null,
): Promise<number> {
  try {
    return await repricePendingPrenotationsWith(
      db,
      tenant,
      tablePrice(tenant),
      actorId,
    );
  } catch (error) {
    console.error("prenotation.reprice", error);
    return 0;
  }
}

/**
 * A table was sent, made current or published: its prenotação items are
 * read, then every unpaid prenotação follows them. For `after()`, so the
 * screen does not wait.
 */
export async function readTableThenReprice(
  tenant: Tenant,
  documentId: string,
  actorId: string | null,
): Promise<void> {
  await readNewFeeTable(tenant, documentId).catch((error) =>
    console.error("fee-table.read", error),
  );
  await repricePendingPrenotations(tenant, actorId);
}
