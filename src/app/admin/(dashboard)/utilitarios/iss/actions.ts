"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import {
  IssDeclarationSchema,
  IssSettingsSchema,
  issOf,
} from "@/core/iss/declaration.ts";
import {
  mergeReports,
  parseNotarisReport,
  type ReportFigures,
} from "@/core/iss/notaris-report.ts";
import { formatTaxId, isValidTaxId } from "@/core/tax-id.ts";
import { parseMoneyBRL } from "@/core/transparency/bulletin.ts";
import { FUNDS_BY_STATE } from "@/core/transparency/rubrics.ts";
import { db } from "@/db/index.ts";
import { recordAuditWith } from "@/lib/audit.ts";
import { justify } from "@/lib/audit-reason.ts";
import { pdfTableText } from "@/lib/fee-tables.ts";
import {
  applyIssToBulletinWith,
  getIssSettings,
  type IssAttachment,
  IssDeclarationError,
  issueIssDeclarationWith,
  type PendingBulletin,
  publishBulletinFromIssWith,
  recordIssFilingWith,
  removeIssDeclarationWith,
  saveIssSettingsWith,
  updateIssDeclarationWith,
} from "@/lib/iss-declarations.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AttachmentError, storeAttachments } from "@/lib/uploads.ts";

export type IssFormState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

const NO_PERMISSION = "Você não tem permissão para a Declaração de ISS.";

async function access(permission: "iss.manage" | "content.edit") {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", permission, session.user.permissions)
  ) {
    return undefined;
  }
  return { session, tenant: await getTenant() };
}

/** "5,00" or "5" -> 500 basis points. */
function rateOf(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? "")
    .replace("%", "")
    .replace(",", ".")
    .trim();
  const rate = Number(text);
  if (!text || Number.isNaN(rate)) return null;
  return Math.round(rate * 100);
}

const sentFiles = (entries: FormDataEntryValue[]) =>
  entries.filter((f): f is File => f instanceof File && f.size > 0);

function onlyPdfs(files: File[]): void {
  if (
    files.some((f) => f.type !== "application/pdf" && !/\.pdf$/i.test(f.name))
  ) {
    throw new IssDeclarationError("Anexe o livro e os relatórios em PDF.");
  }
}

/** The PDFs sent (the book, the system's reports), in the order chosen. */
async function storedPdfs(
  entries: FormDataEntryValue[],
  tenantSlug: string,
  name: string,
): Promise<IssAttachment[]> {
  const files = sentFiles(entries);
  if (files.length === 0) return [];
  onlyPdfs(files);
  const stored = await storeAttachments(files, { tenantSlug, kind: name });
  if (stored.length !== files.length) {
    throw new IssDeclarationError("Não foi possível guardar os anexos.");
  }
  return stored.map((s, i) => ({
    path: s.path,
    name: files[i]?.name ?? "anexo.pdf",
  }));
}

async function storedPdf(
  file: FormDataEntryValue | null,
  tenantSlug: string,
  name: string,
): Promise<IssAttachment | null> {
  const [one] = await storedPdfs(file ? [file] : [], tenantSlug, name);
  return one ?? null;
}

export type ReadReportsState =
  | { status: "read"; figures: ReportFigures; unread: string[] }
  | { status: "error"; message: string };

/**
 * Reads the month's reports printed by the office's system (productivity,
 * taxes) as they are attached, so the form fills itself in; nothing is
 * stored here, and everything read stays editable.
 */
export async function readIssReports(
  formData: FormData,
): Promise<ReadReportsState> {
  const ok = await access("iss.manage");
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const files = sentFiles(formData.getAll("livro"));
  const read: ReportFigures[] = [];
  const unread: string[] = [];
  for (const file of files) {
    try {
      const figures = parseNotarisReport(
        await pdfTableText(new Uint8Array(await file.arrayBuffer())),
      );
      if (figures.kind === "desconhecido") unread.push(file.name);
      else read.push(figures);
    } catch {
      unread.push(file.name);
    }
  }
  return { status: "read", figures: mergeReports(read), unread };
}

const cents = (value: FormDataEntryValue | null) =>
  parseMoneyBRL(String(value ?? "")) ?? undefined;

/** Every fund key any State has: the form sends only its own State's. */
const FUND_KEYS = [
  ...new Set(
    Object.values(FUNDS_BY_STATE).flatMap((funds) => funds.map((f) => f.key)),
  ),
];

/** The bulletin's figures the form carries, read from the report. */
function bulletinOf(formData: FormData, issCents: number): PendingBulletin {
  const out: PendingBulletin = { issCents };
  const acts = Number(String(formData.get("b_atos") ?? "").trim());
  if (
    String(formData.get("b_atos") ?? "").trim() &&
    Number.isInteger(acts) &&
    acts >= 0
  ) {
    out.actsCount = acts;
  }
  const funds: Record<string, number> = {};
  for (const key of FUND_KEYS) {
    const value = cents(formData.get(`b_${key}`));
    if (value !== undefined) funds[key] = value;
  }
  if (Object.keys(funds).length) out.fundAmountsCents = funds;
  const gross = cents(formData.get("b_arrecadacao"));
  if (gross !== undefined) out.grossRevenueCents = gross;
  const expenses = cents(formData.get("b_despesas"));
  if (expenses !== undefined) out.expensesCents = expenses;
  return out;
}

/** Issues (no id) or corrects (with id) a declaration. */
export async function saveIssDeclaration(
  _previous: IssFormState,
  formData: FormData,
): Promise<IssFormState> {
  const ok = await access("iss.manage");
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const { session, tenant } = ok;
  const emoluments = parseMoneyBRL(String(formData.get("emolumentos") ?? ""));
  if (emoluments === null) {
    return {
      status: "error",
      message: "Informe o total de emolumentos do mês, por exemplo 12.345,67.",
    };
  }
  const parsed = IssDeclarationSchema.safeParse({
    competence: `${formData.get("ano")}-${String(formData.get("mes")).padStart(2, "0")}`,
    emolumentsCents: emoluments,
    rateBasisPoints: rateOf(formData.get("aliquota")) ?? 0,
    damNumber: String(formData.get("dam") ?? ""),
    dueDate: String(formData.get("vencimento") ?? ""),
    paidOn: String(formData.get("pagamento") ?? ""),
    notes: String(formData.get("observacoes") ?? ""),
    signer: Number(formData.get("assina") ?? 0) || 0,
    // The ISS worked out act by act, when the report gave it.
    issCents:
      formData.get("iss_relatorio") === "on"
        ? (parseMoneyBRL(String(formData.get("iss") ?? "")) ?? -1)
        : null,
  });
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    return {
      status: "error",
      message:
        field === "rateBasisPoints"
          ? "A alíquota vai de 2% a 5% (LC 116/2003, art. 8º-A e art. 8º, II)."
          : field === "issCents"
            ? "Informe o ISS do relatório, por exemplo 159,17."
            : "Confira a competência e os valores.",
    };
  }
  const id = String(formData.get("id") ?? "");
  if (formData.get("lido") === "1" && formData.get("conferido") !== "on") {
    return {
      status: "error",
      message:
        "Confira os valores lidos do relatório e marque a conferência antes de gerar.",
    };
  }
  let savedId: string;
  try {
    const attachments = await storedPdfs(
      formData.getAll("livro"),
      tenant.slug,
      `livro-${parsed.data.competence}`,
    );
    const row = id
      ? await updateIssDeclarationWith(
          db,
          tenant.slug,
          id,
          parsed.data,
          attachments,
          session.user.id,
        )
      : await issueIssDeclarationWith(
          db,
          tenant.slug,
          parsed.data,
          attachments,
          session.user.id,
        );
    savedId = row.id;
    if (formData.get("lido") === "1") {
      // Who checked the figures the system read, in the audit.
      await recordAuditWith(db, {
        tenantSlug: tenant.slug,
        actorId: session.user.id,
        action: "iss-declaration.checked",
        targetType: "iss-declaration",
        targetId: row.id,
        reason: `Valores lidos do relatório conferidos por ${session.user.name}.`,
      });
    }
    const choice = String(formData.get("boletim") ?? "rascunho");
    if (choice === "rascunho" || choice === "publicar") {
      const figures = bulletinOf(formData, issOf(parsed.data));
      const result =
        choice === "publicar" &&
        can(
          session.user.role ?? "",
          "transparency.manage",
          session.user.permissions,
        )
          ? await publishBulletinFromIssWith(
              db,
              tenant,
              parsed.data.competence,
              figures,
              session.user.id,
            )
          : await applyIssToBulletinWith(
              db,
              tenant.slug,
              parsed.data.competence,
              figures,
              session.user.id,
            );
      revalidatePath("/admin/transparencia");
      revalidatePath("/transparencia");
      savedId = `${savedId}?boletim=${result}`;
    }
  } catch (error) {
    if (
      error instanceof IssDeclarationError ||
      error instanceof AttachmentError
    ) {
      return { status: "error", message: error.message };
    }
    console.error("iss.salvar", error);
    return { status: "error", message: "Não foi possível salvar agora." };
  }
  revalidatePath("/admin/utilitarios/iss");
  redirect(
    `/admin/utilitarios/iss/${savedId}${savedId.includes("?") ? "&" : "?"}${id ? "corrigida=1" : "emitida=1"}`,
  );
}

/** When the declaration reached the prefeitura, and the protocol it got. */
export async function recordIssFiling(
  _previous: IssFormState,
  formData: FormData,
): Promise<IssFormState> {
  const ok = await access("iss.manage");
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const filedOn = String(formData.get("entregue") ?? "");
  if (filedOn && !/^\d{4}-\d{2}-\d{2}$/.test(filedOn)) {
    return { status: "error", message: "Confira a data da entrega." };
  }
  const id = String(formData.get("id") ?? "");
  try {
    await recordIssFilingWith(
      db,
      ok.tenant.slug,
      id,
      { filedOn, reference: String(formData.get("protocolo") ?? "") },
      ok.session.user.id,
    );
  } catch (error) {
    if (error instanceof IssDeclarationError) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: "Não foi possível salvar agora." };
  }
  revalidatePath("/admin/utilitarios/iss");
  revalidatePath(`/admin/utilitarios/iss/${id}`);
  return {
    status: "saved",
    message: filedOn ? "Entrega anotada." : "Entrega desmarcada.",
  };
}

export type RemoveIssState =
  | { status: "idle" }
  | { status: "error"; message: string };

/** "Excluir": out of the list, kept with its trail; the number is free. */
export async function removeIssDeclaration(
  _previous: RemoveIssState,
  formData: FormData,
): Promise<RemoveIssState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access("iss.manage");
  if (!ok) return { status: "error", message: NO_PERMISSION };
  try {
    await removeIssDeclarationWith(
      db,
      ok.tenant.slug,
      String(formData.get("id") ?? ""),
      ok.session.user.id,
    );
  } catch {
    return { status: "error", message: "Não foi possível excluir agora." };
  }
  revalidatePath("/admin/utilitarios/iss");
  redirect("/admin/utilitarios/iss?excluida=1");
}

/** The rate, the law, the office's registration, the law attached. */
export async function saveIssSettings(
  _previous: IssFormState,
  formData: FormData,
): Promise<IssFormState> {
  const ok = await access("content.edit");
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const current = await getIssSettings(ok.tenant);
  const due = Number(formData.get("vencimentoDia") ?? "");
  let lawAttachment = current.lawAttachment;
  let appointmentAttachment = current.appointmentAttachment;
  try {
    const sent = await storedPdf(
      formData.get("lei"),
      ok.tenant.slug,
      "lei-iss",
    );
    if (sent) lawAttachment = sent;
    const portaria = await storedPdf(
      formData.get("portaria"),
      ok.tenant.slug,
      "portaria-prefeitura",
    );
    if (portaria) appointmentAttachment = portaria;
  } catch (error) {
    if (
      error instanceof IssDeclarationError ||
      error instanceof AttachmentError
    ) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
  const parsed = IssSettingsSchema.safeParse({
    rateBasisPoints: rateOf(formData.get("aliquota")) ?? 0,
    municipalLaw: String(formData.get("lei_municipal") ?? ""),
    authority: String(formData.get("prefeitura") ?? ""),
    department: String(formData.get("secretaria") ?? ""),
    cnpj: String(formData.get("cnpj") ?? ""),
    municipalRegistration: String(formData.get("inscricao") ?? ""),
    cnae: String(formData.get("cnae") ?? ""),
    dueDay: Number.isInteger(due) && due >= 1 && due <= 31 ? due : null,
    lawAttachment,
    filing: formData.get("envio") === "portal" ? "portal" : "semut",
    portalUrl: String(formData.get("portal") ?? ""),
    portalRevenue: String(formData.get("receita") ?? ""),
    authorityCnpj: formatTaxId(String(formData.get("cnpj_prefeitura") ?? "")),
    authorityAddress: String(formData.get("endereco_prefeitura") ?? ""),
    mayorName: String(formData.get("prefeito") ?? ""),
    secretaryName: String(formData.get("secretario") ?? ""),
    appointmentAttachment,
    officeAddress: String(formData.get("endereco_serventia") ?? ""),
    officePhone: String(formData.get("telefone_serventia") ?? ""),
    officeEmail: String(formData.get("email_serventia") ?? ""),
  });
  if (parsed.success) {
    // Typed with or without dots, kept with them; a wrong digit is refused.
    parsed.data.cnpj = formatTaxId(parsed.data.cnpj);
    if (!isValidTaxId(parsed.data.cnpj)) {
      return {
        status: "error",
        message: "Confira o CNPJ (ou CPF) da serventia: um dígito não confere.",
      };
    }
    if (!isValidTaxId(parsed.data.authorityCnpj)) {
      return {
        status: "error",
        message: "Confira o CNPJ da prefeitura: um dígito não confere.",
      };
    }
  }
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    return {
      status: "error",
      message:
        field === "portalUrl"
          ? "Informe o endereço do site da prefeitura começando com https://."
          : "A alíquota vai de 2% a 5% (LC 116/2003, art. 8º-A e art. 8º, II).",
    };
  }
  await saveIssSettingsWith(
    db,
    ok.tenant.slug,
    parsed.data,
    ok.session.user.id,
  );
  revalidatePath("/admin/utilitarios/iss");
  return { status: "saved", message: "Configuração salva." };
}
