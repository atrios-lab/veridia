"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import {
  IssDeclarationSchema,
  IssSettingsSchema,
  issOn,
} from "@/core/iss/declaration.ts";
import { parseMoneyBRL } from "@/core/transparency/bulletin.ts";
import { db } from "@/db/index.ts";
import { justify } from "@/lib/audit-reason.ts";
import {
  applyIssToBulletinWith,
  getIssSettings,
  type IssAttachment,
  IssDeclarationError,
  issueIssDeclarationWith,
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

async function access(permission: "requests.manage" | "content.edit") {
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

/** One PDF of the month's book (or cash report), when sent. */
async function storedPdf(
  file: FormDataEntryValue | null,
  tenantSlug: string,
  name: string,
): Promise<IssAttachment | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
    throw new IssDeclarationError("Anexe o livro ou relatório em PDF.");
  }
  const [stored] = await storeAttachments([file], { tenantSlug, kind: name });
  if (!stored)
    throw new IssDeclarationError("Não foi possível guardar o anexo.");
  return { path: stored.path, name: file.name };
}

/** Issues (no id) or corrects (with id) a declaration. */
export async function saveIssDeclaration(
  _previous: IssFormState,
  formData: FormData,
): Promise<IssFormState> {
  const ok = await access("requests.manage");
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
  });
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    return {
      status: "error",
      message:
        field === "rateBasisPoints"
          ? "A alíquota vai de 2% a 5% (LC 116/2003, art. 8º-A e art. 8º, II)."
          : "Confira a competência e os valores.",
    };
  }
  const id = String(formData.get("id") ?? "");
  let savedId: string;
  try {
    const attachment = await storedPdf(
      formData.get("livro"),
      tenant.slug,
      `livro-${parsed.data.competence}`,
    );
    const row = id
      ? await updateIssDeclarationWith(
          db,
          tenant.slug,
          id,
          parsed.data,
          attachment,
          session.user.id,
        )
      : await issueIssDeclarationWith(
          db,
          tenant.slug,
          parsed.data,
          attachment,
          session.user.id,
        );
    savedId = row.id;
    if (formData.get("boletim") === "on") {
      const result = await applyIssToBulletinWith(
        db,
        tenant.slug,
        parsed.data.competence,
        issOn(parsed.data.emolumentsCents, parsed.data.rateBasisPoints),
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
  const ok = await access("requests.manage");
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
  try {
    const sent = await storedPdf(
      formData.get("lei"),
      ok.tenant.slug,
      "lei-iss",
    );
    if (sent) lawAttachment = sent;
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
  });
  if (!parsed.success) {
    return {
      status: "error",
      message:
        "A alíquota vai de 2% a 5% (LC 116/2003, art. 8º-A e art. 8º, II).",
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
