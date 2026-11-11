import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import JSZip from "jszip";
import { formatGuideNumber } from "@/core/guides/schema.ts";
import {
  buildOrderDocument,
  defaultOfficeOrderData,
  fillInputOf,
  type OfficeOrderData,
  OfficeOrderDataSchema,
  type OrderInput,
  OrderInputSchema,
  type OrderStatus,
  orderProblems,
  STARTER_SUPPLIERS,
  type Supplier,
  SupplierSchema,
} from "@/core/paper-orders/catalog.ts";
import {
  fillModel,
  type ModelReading,
  readModel,
} from "@/core/paper-orders/docx-model.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { officeYear } from "@/core/time/office-time.ts";
import { isPostgresError, UNIQUE_VIOLATION } from "@/db/errors.ts";
import type { Database } from "@/db/index.ts";
import { paperOrders, paperSuppliers, tenantContent } from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";
import { brandFor } from "./document-brand.ts";
import { nextNumberWith } from "./document-numbering.ts";
import { getIssSettingsWith } from "./iss-declarations.ts";
import { OFFICE_PAPER_ORDERS_KEY } from "./office-config.ts";
import { renderDocument } from "./pdf.ts";
import { readStoredFile } from "./uploads.ts";

export class PaperOrderError extends Error {}

/* ------------------------------------------------------------ office data */

export async function getOfficeOrderDataWith(
  database: Database,
  tenant: Tenant,
): Promise<OfficeOrderData> {
  try {
    const [row] = await database
      .select({ published: tenantContent.published })
      .from(tenantContent)
      .where(
        and(
          eq(tenantContent.tenantSlug, tenant.slug),
          eq(tenantContent.key, OFFICE_PAPER_ORDERS_KEY),
        ),
      )
      .limit(1);
    const parsed = OfficeOrderDataSchema.safeParse(row?.published);
    if (parsed.success) return parsed.data;
    // Not saved yet: the office's settings, the CNPJ of the ISS included.
    const iss = await getIssSettingsWith(database, tenant);
    return defaultOfficeOrderData(tenant, iss.cnpj);
  } catch {
    return defaultOfficeOrderData(tenant);
  }
}

export async function saveOfficeOrderDataWith(
  database: Database,
  tenantSlug: string,
  data: OfficeOrderData,
  actorId: string,
): Promise<void> {
  const now = new Date();
  await database
    .insert(tenantContent)
    .values({
      tenantSlug,
      key: OFFICE_PAPER_ORDERS_KEY,
      published: data,
      publishedAt: now,
      updatedBy: actorId,
    })
    .onConflictDoUpdate({
      target: [tenantContent.tenantSlug, tenantContent.key],
      set: {
        published: data,
        publishedAt: now,
        updatedAt: now,
        updatedBy: actorId,
      },
    });
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "office-settings.save",
    targetType: "tenant-content",
    targetId: OFFICE_PAPER_ORDERS_KEY,
  });
}

/* -------------------------------------------------------------- suppliers */

export type StoredSupplier = typeof paperSuppliers.$inferSelect;
export type StoredOrder = typeof paperOrders.$inferSelect;

export function supplierOf(row: Pick<StoredSupplier, "data">): Supplier {
  return SupplierSchema.parse(row.data);
}

const isId = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

export async function listSuppliersWith(
  database: Database,
  tenantSlug: string,
  options: { withRemoved?: boolean } = {},
) {
  return database
    .select()
    .from(paperSuppliers)
    .where(
      options.withRemoved
        ? eq(paperSuppliers.tenantSlug, tenantSlug)
        : and(
            eq(paperSuppliers.tenantSlug, tenantSlug),
            isNull(paperSuppliers.removedAt),
          ),
    )
    .orderBy(paperSuppliers.createdAt);
}

export async function findSupplierWith(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<StoredSupplier | undefined> {
  if (!isId(id)) return undefined;
  const [row] = await database
    .select()
    .from(paperSuppliers)
    .where(
      and(eq(paperSuppliers.tenantSlug, tenantSlug), eq(paperSuppliers.id, id)),
    )
    .limit(1);
  return row;
}

export async function createSupplierWith(
  database: Database,
  tenantSlug: string,
  supplier: Supplier,
  actorId: string,
  model?: { path: string; name: string } | null,
): Promise<StoredSupplier> {
  const [row] = await database
    .insert(paperSuppliers)
    .values({
      tenantSlug,
      data: SupplierSchema.parse(supplier),
      modelPath: model?.path ?? null,
      modelName: model?.name ?? null,
      createdBy: actorId,
    })
    .returning();
  if (!row) throw new Error("empresa não gravada");
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "paper-supplier.create",
    targetType: "paper-supplier",
    targetId: row.id,
  });
  return row;
}

/** The two suppliers of the ANOREG/RN's forms, for an office with none. */
export async function addStarterSuppliersWith(
  database: Database,
  tenantSlug: string,
  actorId: string,
): Promise<void> {
  const existing = await listSuppliersWith(database, tenantSlug);
  const names = new Set(existing.map((r) => supplierOf(r).name));
  for (const supplier of STARTER_SUPPLIERS) {
    if (!names.has(supplier.name)) {
      await createSupplierWith(database, tenantSlug, supplier, actorId);
    }
  }
}

export async function updateSupplierWith(
  database: Database,
  tenantSlug: string,
  id: string,
  supplier: Supplier,
  actorId: string,
  model?: { path: string; name: string } | null,
): Promise<void> {
  const row = await findSupplierWith(database, tenantSlug, id);
  if (!row || row.removedAt)
    throw new PaperOrderError("Empresa não encontrada.");
  await database
    .update(paperSuppliers)
    .set({
      data: SupplierSchema.parse(supplier),
      ...(model ? { modelPath: model.path, modelName: model.name } : {}),
      updatedAt: new Date(),
    })
    .where(eq(paperSuppliers.id, id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "paper-supplier.update",
    targetType: "paper-supplier",
    targetId: id,
  });
}

export async function removeSupplierWith(
  database: Database,
  tenantSlug: string,
  id: string,
  reason: string,
  actorId: string,
): Promise<void> {
  const updated = await database
    .update(paperSuppliers)
    .set({ removedAt: new Date(), removedBy: actorId, removeReason: reason })
    .where(
      and(
        eq(paperSuppliers.tenantSlug, tenantSlug),
        eq(paperSuppliers.id, id),
        isNull(paperSuppliers.removedAt),
      ),
    )
    .returning({ id: paperSuppliers.id });
  if (!updated.length) throw new PaperOrderError("Empresa não encontrada.");
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "paper-supplier.remove",
    targetType: "paper-supplier",
    targetId: id,
    reason,
  });
}

/** Reads a supplier's Word form: its title, items and conditions. */
export async function readModelFile(bytes: Buffer): Promise<ModelReading> {
  const xml = await documentXml(bytes);
  return readModel(xml);
}

async function documentXml(bytes: Buffer): Promise<string> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new PaperOrderError(
      "O modelo precisa ser um arquivo do Word (.docx).",
    );
  }
  const file = zip.file("word/document.xml");
  if (!file) {
    throw new PaperOrderError(
      "O modelo precisa ser um arquivo do Word (.docx).",
    );
  }
  return file.async("string");
}

/* ----------------------------------------------------------------- orders */

export function orderOf(row: Pick<StoredOrder, "order">): OrderInput {
  return OrderInputSchema.parse(row.order);
}

export function orderNumber(row: Pick<StoredOrder, "year" | "sequence">) {
  return formatGuideNumber(row.year, row.sequence);
}

export async function listOrdersWith(
  database: Database,
  tenantSlug: string,
  options: { withRemoved?: boolean } = {},
) {
  return database
    .select()
    .from(paperOrders)
    .where(
      options.withRemoved
        ? eq(paperOrders.tenantSlug, tenantSlug)
        : and(
            eq(paperOrders.tenantSlug, tenantSlug),
            isNull(paperOrders.removedAt),
          ),
    )
    .orderBy(desc(paperOrders.createdAt));
}

export async function findOrderWith(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<StoredOrder | undefined> {
  if (!isId(id)) return undefined;
  const [row] = await database
    .select()
    .from(paperOrders)
    .where(and(eq(paperOrders.tenantSlug, tenantSlug), eq(paperOrders.id, id)))
    .limit(1);
  return row;
}

function checkOrder(order: OrderInput): OrderInput {
  const parsed = OrderInputSchema.safeParse(order);
  if (!parsed.success) {
    throw new PaperOrderError("Informe ao menos um item com a quantidade.");
  }
  const problems = orderProblems(parsed.data.lines);
  if (problems.length) throw new PaperOrderError(problems.join(" "));
  return parsed.data;
}

const ATTEMPTS = 5;

export async function issueOrderWith(
  database: Database,
  tenantSlug: string,
  supplierId: string,
  input: OrderInput,
  actorId: string,
  now = new Date(),
): Promise<StoredOrder> {
  const order = checkOrder(input);
  const supplierRow = await findSupplierWith(database, tenantSlug, supplierId);
  if (!supplierRow || supplierRow.removedAt) {
    throw new PaperOrderError("Escolha a empresa.");
  }
  const year = officeYear(now);
  for (let attempt = 1; ; attempt++) {
    try {
      const sequence = await nextNumberWith(
        database,
        tenantSlug,
        "pedido-papel",
        year,
      );
      const [row] = await database
        .insert(paperOrders)
        .values({
          tenantSlug,
          year,
          sequence,
          supplierId,
          supplier: supplierOf(supplierRow),
          order,
          createdBy: actorId,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!row) throw new Error("pedido não gravado");
      await recordAuditWith(database, {
        tenantSlug,
        actorId,
        action: "paper-order.issue",
        targetType: "paper-order",
        targetId: row.id,
      });
      return row;
    } catch (error) {
      if (!isPostgresError(error, UNIQUE_VIOLATION) || attempt >= ATTEMPTS) {
        throw error;
      }
    }
  }
}

/** Edits an order; the supplier's data is taken again as it is now. */
export async function updateOrderWith(
  database: Database,
  tenantSlug: string,
  id: string,
  input: OrderInput,
  actorId: string,
): Promise<void> {
  const order = checkOrder(input);
  const row = await findOrderWith(database, tenantSlug, id);
  if (!row || row.removedAt)
    throw new PaperOrderError("Pedido não encontrado.");
  const supplierRow = await findSupplierWith(
    database,
    tenantSlug,
    row.supplierId,
  );
  await database
    .update(paperOrders)
    .set({
      order,
      ...(supplierRow && !supplierRow.removedAt
        ? { supplier: supplierOf(supplierRow) }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(paperOrders.id, id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "paper-order.update",
    targetType: "paper-order",
    targetId: id,
  });
}

export async function setOrderStatusWith(
  database: Database,
  tenantSlug: string,
  id: string,
  status: { status: OrderStatus; sentOn: string; receivedOn: string },
  actorId: string,
): Promise<void> {
  const row = await findOrderWith(database, tenantSlug, id);
  if (!row || row.removedAt)
    throw new PaperOrderError("Pedido não encontrado.");
  await database
    .update(paperOrders)
    .set({ ...status, updatedAt: new Date() })
    .where(eq(paperOrders.id, id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "paper-order.status",
    targetType: "paper-order",
    targetId: id,
  });
}

export async function removeOrderWith(
  database: Database,
  tenantSlug: string,
  id: string,
  reason: string,
  actorId: string,
): Promise<void> {
  const updated = await database
    .update(paperOrders)
    .set({ removedAt: new Date(), removedBy: actorId, removeReason: reason })
    .where(
      and(
        eq(paperOrders.tenantSlug, tenantSlug),
        eq(paperOrders.id, id),
        isNull(paperOrders.removedAt),
      ),
    )
    .returning({ id: paperOrders.id });
  if (!updated.length) throw new PaperOrderError("Pedido não encontrado.");
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "paper-order.remove",
    targetType: "paper-order",
    targetId: id,
    reason,
  });
}

/* ------------------------------------------------------------- documents */

/** The order on the office's letterhead, in the supplier's pattern. */
export async function renderOrderPdf(
  tenant: Tenant,
  row: StoredOrder,
  office: OfficeOrderData,
  signers: { name: string; title: string; note?: string }[],
): Promise<Buffer> {
  const order = orderOf(row);
  return renderDocument(
    buildOrderDocument(tenant, {
      number: orderNumber(row),
      supplier: SupplierSchema.parse(row.supplier),
      order,
      office,
      signer: signers[order.signer] ?? signers[0],
    }),
    await brandFor(tenant),
  );
}

/** The supplier's own Word form, filled with this order. */
export async function renderOrderModel(
  tenant: Tenant,
  row: StoredOrder,
  model: { path: string },
  office: OfficeOrderData,
): Promise<Buffer> {
  const bytes = await readStoredFile(model.path);
  const zip = await JSZip.loadAsync(bytes);
  const file = zip.file("word/document.xml");
  if (!file) throw new PaperOrderError("O modelo da empresa não é um .docx.");
  const filled = fillModel(
    await file.async("string"),
    fillInputOf({
      supplier: SupplierSchema.parse(row.supplier),
      order: orderOf(row),
      office,
      city: office.city || `${tenant.location.city}/${tenant.location.state}`,
    }),
  );
  zip.file("word/document.xml", filled);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

/** The items printed on the supplier's Word form, by name. */
export async function modelItemNames(path: string): Promise<string[]> {
  try {
    const reading = await readModelFile(await readStoredFile(path));
    return reading.items.map((i) => i.name);
  } catch {
    return [];
  }
}
