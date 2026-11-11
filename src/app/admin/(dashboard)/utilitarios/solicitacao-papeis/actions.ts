"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { can } from "@/core/auth/roles.ts";
import {
  itemId,
  OfficeOrderDataSchema,
  ORDER_STATUSES,
  type OrderInput,
  OrderLineSchema,
  type OrderStatus,
  type Supplier,
  SupplierItemSchema,
  SupplierSchema,
} from "@/core/paper-orders/catalog.ts";
import type { ModelReading } from "@/core/paper-orders/docx-model.ts";
import { LONG_TEXT_MAX } from "@/core/text-limits.ts";
import { db } from "@/db/index.ts";
import { justify } from "@/lib/audit-reason.ts";
import {
  addStarterSuppliersWith,
  createSupplierWith,
  findSupplierWith,
  issueOrderWith,
  PaperOrderError,
  readModelFile,
  removeOrderWith,
  removeSupplierWith,
  saveOfficeOrderDataWith,
  setOrderStatusWith,
  supplierOf,
  updateOrderWith,
  updateSupplierWith,
} from "@/lib/paper-orders.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { storeSupplierModel } from "@/lib/uploads.ts";

export type OrderFormState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

const HOME = "/admin/utilitarios/solicitacao-papeis";
const NO_PERMISSION =
  "Você não tem permissão para a solicitação de papéis de segurança.";
const MAX_MODEL_BYTES = 10 * 1024 * 1024;

async function access() {
  const session = await getSession();
  if (
    !session ||
    !can(
      session.user.role ?? "",
      "paper-orders.manage",
      session.user.permissions,
    )
  ) {
    return undefined;
  }
  return { session, tenant: await getTenant() };
}

const field = (formData: FormData, name: string, max = 300) =>
  String(formData.get(name) ?? "")
    .trim()
    .slice(0, max);

function fail(error: unknown): OrderFormState {
  if (error instanceof PaperOrderError) {
    return { status: "error", message: error.message };
  }
  console.error("paper-orders", error);
  return {
    status: "error",
    message: "Não foi possível salvar agora. Tente de novo em instantes.",
  };
}

function json(formData: FormData, name: string): unknown {
  try {
    return JSON.parse(String(formData.get(name) ?? "null"));
  } catch {
    return null;
  }
}

/** The .docx sent, checked; null when none. */
async function modelFile(formData: FormData): Promise<Buffer | null> {
  const file = formData.get("modelo");
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > MAX_MODEL_BYTES) {
    throw new PaperOrderError("O modelo passa de 10 MB.");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  // A .docx is a zip: "PK" at the start.
  if (bytes.subarray(0, 2).toString() !== "PK" || !/\.docx$/i.test(file.name)) {
    throw new PaperOrderError(
      "O modelo precisa ser um arquivo do Word (.docx). Se estiver em .doc ou PDF, salve como .docx no Word.",
    );
  }
  return bytes;
}

/* -------------------------------------------------------------- suppliers */

export async function addStarterSuppliers(): Promise<void> {
  const ok = await access();
  if (!ok) return;
  await addStarterSuppliersWith(db, ok.tenant.slug, ok.session.user.id);
  revalidatePath(HOME);
  redirect(`${HOME}?feito=empresas`);
}

/** Reads the uploaded form and hands its texts and items back to the form. */
export async function readSupplierModel(
  formData: FormData,
): Promise<
  { ok: true; reading: ModelReading } | { ok: false; message: string }
> {
  const ok = await access();
  if (!ok) return { ok: false, message: NO_PERMISSION };
  try {
    const bytes = await modelFile(formData);
    if (!bytes) return { ok: false, message: "Escolha o arquivo do modelo." };
    return { ok: true, reading: await readModelFile(bytes) };
  } catch (error) {
    const state = fail(error);
    return {
      ok: false,
      message:
        state.status === "error" ? state.message : "Não foi possível ler.",
    };
  }
}

const lines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 8);

function supplierFrom(formData: FormData): Supplier | string {
  const rawItems = json(formData, "itens");
  const items = z
    .array(
      SupplierItemSchema.omit({ id: true }).extend({
        id: z.string().max(60).optional(),
      }),
    )
    .max(60)
    .safeParse(rawItems ?? []);
  if (!items.success) return "Confira os itens: nome, unidade e mínimo.";
  const taken: string[] = [];
  const withIds = items.data.map((item) => {
    const id =
      item.id && !taken.includes(item.id) ? item.id : itemId(item.name, taken);
    taken.push(id);
    return { ...item, id };
  });
  const parsed = SupplierSchema.safeParse({
    name: field(formData, "nome", 160),
    cnpj: field(formData, "cnpj", 20),
    address: field(formData, "endereco", 300),
    phone: field(formData, "fone", 60),
    email: field(formData, "email", 160),
    website: field(formData, "site", 160),
    title: field(formData, "titulo", 120),
    intro: field(formData, "abertura", 2000),
    items: withIds,
    freightOptions: lines(field(formData, "fretes", 1200)),
    paymentOptions: lines(field(formData, "pagamentos", 1200)),
    delivery: field(formData, "prazo", 2000),
    deliveryAddress: field(formData, "entrega", 2000),
    conditions: field(formData, "condicoes", LONG_TEXT_MAX),
    signatureNote: field(formData, "assinatura", 160),
  });
  if (!parsed.success)
    return "Informe o nome da empresa (e confira os campos).";
  return parsed.data;
}

export async function saveSupplier(
  _previous: OrderFormState,
  formData: FormData,
): Promise<OrderFormState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const supplier = supplierFrom(formData);
  if (typeof supplier === "string")
    return { status: "error", message: supplier };
  const id = field(formData, "id", 40);
  try {
    const bytes = await modelFile(formData);
    const model = bytes
      ? {
          path: await storeSupplierModel(ok.tenant.slug, bytes),
          name: field(formData, "modeloNome", 160) || "Modelo da empresa.docx",
        }
      : null;
    if (id) {
      await updateSupplierWith(
        db,
        ok.tenant.slug,
        id,
        supplier,
        ok.session.user.id,
        model,
      );
    } else {
      await createSupplierWith(
        db,
        ok.tenant.slug,
        supplier,
        ok.session.user.id,
        model,
      );
    }
  } catch (error) {
    return fail(error);
  }
  revalidatePath(HOME);
  redirect(`${HOME}?feito=empresa`);
}

export async function removeSupplier(
  _previous: OrderFormState,
  formData: FormData,
): Promise<OrderFormState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const problem = justify(formData);
  if (problem) return { status: "error", message: problem };
  try {
    await removeSupplierWith(
      db,
      ok.tenant.slug,
      field(formData, "id", 40),
      String(formData.get("justificativa") ?? "").trim(),
      ok.session.user.id,
    );
  } catch (error) {
    return fail(error);
  }
  revalidatePath(HOME);
  redirect(`${HOME}?feito=empresa-excluida`);
}

/* ----------------------------------------------------------------- orders */

const PostedLine = OrderLineSchema.extend({
  /** Keep a typed item in the supplier's list for the next orders. */
  save: z.boolean().optional(),
});

async function orderFrom(
  formData: FormData,
  tenantSlug: string,
  actorId: string,
): Promise<{ supplierId: string; order: OrderInput } | string> {
  const supplierId = field(formData, "empresa", 40);
  const supplierRow = await findSupplierWith(db, tenantSlug, supplierId);
  if (!supplierRow || supplierRow.removedAt) return "Escolha a empresa.";
  const posted = z
    .array(PostedLine)
    .max(60)
    .safeParse(json(formData, "linhas"));
  if (!posted.success) return "Confira os itens: nome, unidade e quantidade.";
  if (posted.data.length === 0)
    return "Informe a quantidade de ao menos um item.";
  const orderDate = field(formData, "data", 10) || today();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(orderDate))
    return "Confira a data do pedido.";

  // New items marked to keep go into the supplier's list.
  const supplier = supplierOf(supplierRow);
  const toSave = posted.data.filter((l) => l.save && !l.itemId);
  const lineIds = new Map<number, string>();
  if (toSave.length) {
    const taken = supplier.items.map((i) => i.id);
    const added = toSave.map((l) => {
      const id = itemId(l.name, taken);
      taken.push(id);
      lineIds.set(posted.data.indexOf(l), id);
      return {
        id,
        name: l.name,
        unit: l.unit,
        minimum: 0,
        unitPriceCents: l.unitPriceCents,
        note: l.note,
        paperKind: null,
      };
    });
    await updateSupplierWith(
      db,
      tenantSlug,
      supplierId,
      { ...supplier, items: [...supplier.items, ...added] },
      actorId,
    );
  }
  return {
    supplierId,
    order: {
      lines: posted.data.map(({ save: _save, ...line }, i) => ({
        ...line,
        itemId: line.itemId ?? lineIds.get(i) ?? null,
      })),
      freight: field(formData, "frete", 160),
      payment: field(formData, "pagamento", 160),
      notes: field(formData, "observacoes", LONG_TEXT_MAX),
      orderDate,
      signer: Number(field(formData, "assina", 3)) || 0,
    },
  };
}

export async function saveOrder(
  _previous: OrderFormState,
  formData: FormData,
): Promise<OrderFormState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const id = field(formData, "id", 40);
  let target = id;
  try {
    const built = await orderFrom(formData, ok.tenant.slug, ok.session.user.id);
    if (typeof built === "string") return { status: "error", message: built };
    if (id) {
      await updateOrderWith(
        db,
        ok.tenant.slug,
        id,
        built.order,
        ok.session.user.id,
      );
    } else {
      const row = await issueOrderWith(
        db,
        ok.tenant.slug,
        built.supplierId,
        built.order,
        ok.session.user.id,
      );
      target = row.id;
    }
  } catch (error) {
    return fail(error);
  }
  revalidatePath(HOME);
  redirect(`${HOME}/${target}?${id ? "editado" : "gerado"}=1`);
}

export async function setOrderStatus(
  _previous: OrderFormState,
  formData: FormData,
): Promise<OrderFormState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const status = field(formData, "situacao") as OrderStatus;
  if (!ORDER_STATUSES.includes(status)) {
    return { status: "error", message: "Escolha a situação." };
  }
  const sentOn = field(formData, "enviado", 10);
  const receivedOn = field(formData, "recebido", 10);
  for (const date of [sentOn, receivedOn]) {
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today())) {
      return { status: "error", message: "Confira as datas." };
    }
  }
  const id = field(formData, "id", 40);
  try {
    await setOrderStatusWith(
      db,
      ok.tenant.slug,
      id,
      { status, sentOn, receivedOn },
      ok.session.user.id,
    );
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`${HOME}/${id}`);
  return { status: "saved", message: "Situação do pedido salva." };
}

export async function removeOrder(
  _previous: OrderFormState,
  formData: FormData,
): Promise<OrderFormState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const problem = justify(formData);
  if (problem) return { status: "error", message: problem };
  try {
    await removeOrderWith(
      db,
      ok.tenant.slug,
      field(formData, "id", 40),
      String(formData.get("justificativa") ?? "").trim(),
      ok.session.user.id,
    );
  } catch (error) {
    return fail(error);
  }
  revalidatePath(HOME);
  redirect(`${HOME}?feito=pedido-excluido`);
}

/* ------------------------------------------------------------ office data */

export async function saveOfficeData(
  _previous: OrderFormState,
  formData: FormData,
): Promise<OrderFormState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const parsed = OfficeOrderDataSchema.safeParse({
    office: field(formData, "cartorio", 200),
    cns: field(formData, "cns", 20),
    holderName: field(formData, "responsavel", 160),
    holderCpf: field(formData, "cpf", 20),
    billingCnpj: field(formData, "cnpj", 20),
    billingCpf: field(formData, "cpfFaturamento", 20),
    address: field(formData, "endereco", 300),
    cep: field(formData, "cep", 12),
    city: field(formData, "municipio", 120),
    phone: field(formData, "fone", 60),
    email: field(formData, "email", 160),
  });
  if (!parsed.success)
    return { status: "error", message: "Confira os campos." };
  try {
    await saveOfficeOrderDataWith(
      db,
      ok.tenant.slug,
      parsed.data,
      ok.session.user.id,
    );
  } catch (error) {
    return fail(error);
  }
  revalidatePath(HOME);
  return { status: "saved", message: "Dados do cartório salvos." };
}
