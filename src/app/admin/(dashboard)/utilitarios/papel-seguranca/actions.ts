"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import {
  REPORT_KINDS,
  type ReportKind,
  SecurityPaperSettingsSchema,
} from "@/core/security-paper/documents.ts";
import {
  MOVEMENT_TYPES,
  type MovementType,
  monthOf,
  PAPER_KINDS,
  type PaperKind,
  type Period,
  parseSheet,
  quarterOf,
} from "@/core/security-paper/stock.ts";
import { LONG_TEXT_MAX } from "@/core/text-limits.ts";
import { db } from "@/db/index.ts";
import { justify } from "@/lib/audit-reason.ts";
import {
  addLotWith,
  addMovementWith,
  findLotWith,
  issueReportWith,
  recordReportSentWith,
  SecurityPaperError,
  saveSecurityPaperSettingsWith,
  updateLotDetailsWith,
  voidLotWith,
  voidMovementWith,
} from "@/lib/security-paper.ts";
import { getSession } from "@/lib/session.ts";
import { getGuideSettings } from "@/lib/tax-guides.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { AttachmentError, storeAttachments } from "@/lib/uploads.ts";

export type PaperFormState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

const HOME = "/admin/utilitarios/papel-seguranca";
const NO_PERMISSION = "Você não tem permissão para o papel de segurança.";

async function access() {
  const session = await getSession();
  if (
    !session ||
    !can(
      session.user.role ?? "",
      "security-paper.manage",
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

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

function fail(error: unknown): PaperFormState {
  if (error instanceof SecurityPaperError || error instanceof AttachmentError) {
    return { status: "error", message: error.message };
  }
  console.error("security-paper", error);
  return {
    status: "error",
    message: "Não foi possível salvar agora. Tente de novo em instantes.",
  };
}

/** The nota fiscal, scanned: optional, PDF or image. */
async function invoiceFileOf(formData: FormData, tenantSlug: string) {
  const file = formData.get("arquivo");
  if (!(file instanceof File) || file.size === 0) return null;
  const [stored] = await storeAttachments([file], {
    tenantSlug,
    limit: 1,
    name: "Nota fiscal do papel de segurança",
  });
  return stored ? { path: stored.path, name: stored.displayName } : null;
}

/* ------------------------------------------------------------------ lots */

export async function addLot(
  _previous: PaperFormState,
  formData: FormData,
): Promise<PaperFormState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const kind = field(formData, "tipo") as PaperKind;
  if (!PAPER_KINDS.includes(kind)) {
    return { status: "error", message: "Escolha o tipo de papel." };
  }
  const first = parseSheet(field(formData, "primeira", 40));
  const last = parseSheet(
    field(formData, "ultima", 40) || field(formData, "primeira", 40),
  );
  if (!first || !last) {
    return {
      status: "error",
      message:
        "Informe a numeração da primeira e da última folha, como impressa (por exemplo, AB 000001).",
    };
  }
  if (first.prefix !== last.prefix) {
    return {
      status: "error",
      message: "A primeira e a última folha têm letras (série) diferentes.",
    };
  }
  const receivedOn = field(formData, "recebido", 10);
  if (!isDate(receivedOn) || receivedOn > today()) {
    return { status: "error", message: "Confira a data de recebimento." };
  }
  try {
    await addLotWith(
      db,
      ok.tenant.slug,
      {
        kind,
        kindLabel: field(formData, "nome", 120),
        prefix: first.prefix,
        first: first.n,
        last: last.n,
        digits: Math.max(first.digits, last.digits),
        receivedOn,
        opening: formData.get("anterior") === "on",
        supplier: field(formData, "grafica", 160),
        invoice: field(formData, "nota", 80),
        requisition: field(formData, "requisicao", 120),
        notes: field(formData, "observacoes", LONG_TEXT_MAX),
        invoiceFile: await invoiceFileOf(formData, ok.tenant.slug),
      },
      ok.session.user.id,
    );
  } catch (error) {
    return fail(error);
  }
  revalidatePath(HOME);
  redirect(`${HOME}?feito=lote`);
}

export async function updateLot(
  _previous: PaperFormState,
  formData: FormData,
): Promise<PaperFormState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const id = field(formData, "id", 40);
  try {
    await updateLotDetailsWith(
      db,
      ok.tenant.slug,
      id,
      {
        supplier: field(formData, "grafica", 160),
        invoice: field(formData, "nota", 80),
        requisition: field(formData, "requisicao", 120),
        notes: field(formData, "observacoes", LONG_TEXT_MAX),
        invoiceFile: await invoiceFileOf(formData, ok.tenant.slug),
      },
      ok.session.user.id,
    );
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`${HOME}/lotes/${id}`);
  return { status: "saved", message: "Dados do lote salvos." };
}

export async function voidLot(
  _previous: PaperFormState,
  formData: FormData,
): Promise<PaperFormState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const problem = justify(formData);
  if (problem) return { status: "error", message: problem };
  const reason = String(formData.get("justificativa") ?? "").trim();
  try {
    await voidLotWith(
      db,
      ok.tenant.slug,
      field(formData, "id", 40),
      reason,
      ok.session.user.id,
    );
  } catch (error) {
    return fail(error);
  }
  revalidatePath(HOME);
  redirect(`${HOME}?feito=lote-anulado`);
}

/* ------------------------------------------------------------- movements */

export async function addMovement(
  _previous: PaperFormState,
  formData: FormData,
): Promise<PaperFormState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const type = field(formData, "tipo") as MovementType;
  if (!MOVEMENT_TYPES.includes(type)) {
    return {
      status: "error",
      message: "Escolha o que aconteceu com as folhas.",
    };
  }
  const lot = await findLotWith(
    db,
    ok.tenant.slug,
    field(formData, "lote", 40),
  );
  if (!lot) return { status: "error", message: "Escolha o lote." };
  const occurredOn = field(formData, "data", 10);
  if (!isDate(occurredOn) || occurredOn > today()) {
    return { status: "error", message: "Confira a data." };
  }
  const byQuantity = field(formData, "modo") === "quantidade";
  let range: { first?: number; last?: number; quantity?: number };
  if (byQuantity) {
    const quantity = Number(field(formData, "quantidade", 9));
    if (!Number.isInteger(quantity) || quantity < 1) {
      return { status: "error", message: "Informe quantas folhas." };
    }
    range = { quantity };
  } else {
    const first = parseSheet(field(formData, "primeira", 40));
    const last = parseSheet(
      field(formData, "ultima", 40) || field(formData, "primeira", 40),
    );
    if (!first || !last) {
      return {
        status: "error",
        message: "Informe o número da folha (ou da primeira e da última).",
      };
    }
    for (const typed of [first, last]) {
      if (typed.prefix && typed.prefix !== lot.prefix) {
        return {
          status: "error",
          message: `As folhas deste lote são da série ${lot.prefix || "sem letras"}: confira a numeração.`,
        };
      }
    }
    range = { first: first.n, last: last.n };
  }
  const reference = field(formData, "referencia", 300);
  if (
    (type === "extraviado" || type === "subtraido") &&
    !reference &&
    !field(formData, "observacoes")
  ) {
    return {
      status: "error",
      message:
        "Conte o que houve: onde e como a folha sumiu (e o boletim de ocorrência, se houver). Vai no ofício à Corregedoria.",
    };
  }
  try {
    await addMovementWith(
      db,
      ok.tenant.slug,
      {
        lotId: lot.id,
        type,
        ...range,
        occurredOn,
        reference,
        notes: field(formData, "observacoes", LONG_TEXT_MAX),
      },
      ok.session.user.id,
    );
  } catch (error) {
    return fail(error);
  }
  revalidatePath(HOME);
  redirect(`${HOME}?feito=${type}`);
}

export async function voidMovement(
  _previous: PaperFormState,
  formData: FormData,
): Promise<PaperFormState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const problem = justify(formData);
  if (problem) return { status: "error", message: problem };
  const reason = String(formData.get("justificativa") ?? "").trim();
  try {
    await voidMovementWith(
      db,
      ok.tenant.slug,
      field(formData, "id", 40),
      reason,
      ok.session.user.id,
    );
  } catch (error) {
    return fail(error);
  }
  revalidatePath(HOME);
  return {
    status: "saved",
    message: "Lançamento anulado. As folhas voltaram ao estoque.",
  };
}

/* --------------------------------------------------------------- reports */

/** The period chosen: a quarter ("2026-3"), a month ("2026-10") or dates. */
function periodOf(kind: ReportKind, formData: FormData): Period | string {
  if (kind === "prestacao") {
    const [year, quarter] = field(formData, "trimestre", 7)
      .split("-")
      .map(Number);
    if (!year || !quarter || quarter < 1 || quarter > 4) {
      return "Escolha o trimestre.";
    }
    return quarterOf(`${year}-${String(quarter * 3).padStart(2, "0")}-01`);
  }
  if (kind === "extravio") {
    const month = field(formData, "mes", 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return "Escolha o mês.";
    return monthOf(`${month}-01`);
  }
  const start = field(formData, "inicio", 10);
  const end = field(formData, "fim", 10);
  if (!isDate(start) || !isDate(end) || end < start) {
    return "Confira o período do relatório.";
  }
  return { start, end };
}

export async function issueReport(
  _previous: PaperFormState,
  formData: FormData,
): Promise<PaperFormState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const kind = field(formData, "tipo") as ReportKind;
  if (!REPORT_KINDS.includes(kind)) {
    return { status: "error", message: "Escolha o documento." };
  }
  const period = periodOf(kind, formData);
  if (typeof period === "string") return { status: "error", message: period };
  if (period.start > today()) {
    return { status: "error", message: "Esse período ainda não começou." };
  }
  const issuedOn = field(formData, "data", 10) || today();
  if (!isDate(issuedOn)) {
    return { status: "error", message: "Confira a data do ofício." };
  }
  let id: string;
  try {
    const row = await issueReportWith(
      db,
      ok.tenant,
      {
        kind,
        period,
        issuedOn,
        notes: field(formData, "observacoes", LONG_TEXT_MAX),
        signerIndex: Number(field(formData, "assina", 3)) || 0,
        signers: (await getGuideSettings(ok.tenant)).signers,
      },
      ok.session.user.id,
    );
    id = row.id;
  } catch (error) {
    return fail(error);
  }
  revalidatePath(HOME);
  redirect(`${HOME}/oficios/${id}?gerado=1`);
}

export async function recordSent(
  _previous: PaperFormState,
  formData: FormData,
): Promise<PaperFormState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const sentOn = field(formData, "enviado", 10);
  if (sentOn && (!isDate(sentOn) || sentOn > today())) {
    return { status: "error", message: "Confira a data do envio." };
  }
  const id = field(formData, "id", 40);
  try {
    await recordReportSentWith(
      db,
      ok.tenant.slug,
      id,
      sentOn,
      field(formData, "protocolo", 160),
      ok.session.user.id,
    );
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`${HOME}/oficios/${id}`);
  return {
    status: "saved",
    message: sentOn ? "Envio registrado." : "Envio desmarcado.",
  };
}

/* -------------------------------------------------------------- settings */

export async function saveSettings(
  _previous: PaperFormState,
  formData: FormData,
): Promise<PaperFormState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const day = field(formData, "prazo", 2);
  const parsed = SecurityPaperSettingsSchema.safeParse({
    authority: field(formData, "orgao", 200),
    headName: field(formData, "nome", 160),
    headTitle: field(formData, "cargo", 160),
    address: field(formData, "endereco", 300),
    email: field(formData, "email", 160),
    stateRule: field(formData, "norma", 400),
    deadlineDay: day ? Number(day) : null,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Confira os campos (o prazo vai de 1 a 31).",
    };
  }
  try {
    await saveSecurityPaperSettingsWith(
      db,
      ok.tenant.slug,
      parsed.data,
      ok.session.user.id,
    );
  } catch (error) {
    return fail(error);
  }
  revalidatePath(HOME);
  return { status: "saved", message: "Configuração salva." };
}
