"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { can } from "@/core/auth/roles.ts";
import {
  CedulaDataSchema,
  inferChanges,
  planActs,
} from "@/core/cedulas/analise.ts";
import { isCedulaKind } from "@/core/cedulas/especies.ts";
import { qualificationFromCedula } from "@/core/cedulas/exigencias.ts";
import { requirementProblems } from "@/core/qualificacao/qualificacao.ts";
import { MIN_JUSTIFICATION } from "@/core/text-limits.ts";
import { db } from "@/db/index.ts";
import {
  CEDULA_FILE_MAX_BYTES,
  CEDULA_MAX_FILES,
  CedulaError,
  changeLearnedWith,
  createAnalysisWith,
  getAnalysisWith,
  type IncomingFile,
  linkNoteWith,
  linkRequestWith,
  readCedulaDocumentsWith,
  removeAnalysisWith,
  requestFilesWith,
  restoreAnalysisWith,
  saveChargeNotesWith,
  saveModelWith,
  updateDataWith,
} from "@/lib/cedulas.ts";
import {
  createQualificationWith,
  QualificationError,
} from "@/lib/qualificacao.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, today } from "@/lib/tenant.ts";

export type CedulaState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

const BASE = "/admin/utilitarios/cedulas";
const NO_PERMISSION =
  "Você não tem acesso à análise de cédulas. Peça ao Tabelião em Perfis e permissões.";
const GENERIC = "Não foi possível concluir agora. Tente de novo em instantes.";

async function access() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "cedulas.manage", session.user.permissions)
  ) {
    return undefined;
  }
  return { session, tenant: await getTenant() };
}

const fail = (error: unknown, where: string): CedulaState => {
  if (error instanceof CedulaError) {
    return { status: "error", message: error.message };
  }
  console.error(where, error);
  return { status: "error", message: GENERIC };
};

/** Reads the files (dropped right after) and opens the analysis. */
export async function createCedulaAnalysisAction(
  _previous: CedulaState,
  formData: FormData,
): Promise<CedulaState> {
  const ctx = await access();
  if (!ctx) return { status: "error", message: NO_PERMISSION };
  const kindValue = String(formData.get("especie") ?? "");
  const chosenKind = isCedulaKind(kindValue) ? kindValue : null;
  const requestId = String(formData.get("pedido") ?? "") || null;
  const attachmentIds = formData
    .getAll("anexoPedido")
    .map(String)
    .filter((v) => /^[0-9a-f-]{36}$/i.test(v));
  const uploads = formData
    .getAll("arquivos")
    .filter((v): v is File => v instanceof File && v.size > 0);
  if (uploads.length + attachmentIds.length > CEDULA_MAX_FILES) {
    return {
      status: "error",
      message: `Envie até ${CEDULA_MAX_FILES} arquivos por análise.`,
    };
  }
  const tooBig = uploads.find((f) => f.size > CEDULA_FILE_MAX_BYTES);
  if (tooBig) {
    return {
      status: "error",
      message: `${tooBig.name} passa de 20 MB. Envie o arquivo menor ou em partes.`,
    };
  }
  let id: string;
  try {
    const files: IncomingFile[] = [
      ...(requestId
        ? await requestFilesWith(db, ctx.tenant.slug, requestId, attachmentIds)
        : []),
      ...(await Promise.all(
        uploads.map(async (file) => ({
          name: file.name || "arquivo",
          bytes: new Uint8Array(await file.arrayBuffer()),
          mediaType: file.type || "application/octet-stream",
        })),
      )),
    ];
    if (files.length === 0 && !chosenKind) {
      return {
        status: "error",
        message:
          "Anexe a cédula e os aditivos. Sem o arquivo, abra Preencher à mão e escolha a espécie.",
      };
    }
    // With a file, the document says the kind; the choice is only for
    // filling by hand (decision of 21/11/2026).
    const reading = await readCedulaDocumentsWith(
      db,
      ctx.tenant.slug,
      files,
      files.length > 0 ? null : chosenKind,
    );
    id = await createAnalysisWith(
      db,
      ctx.tenant.slug,
      { reading, requestId },
      ctx.session.user.id,
    );
  } catch (error) {
    return fail(error, "cedulas.create");
  }
  revalidatePath(BASE);
  redirect(`${BASE}/${id}`);
}

/** Saves the data the clerk checked (the previous goes to the history). */
export async function updateCedulaDataAction(
  _previous: CedulaState,
  formData: FormData,
): Promise<CedulaState> {
  const ctx = await access();
  if (!ctx) return { status: "error", message: NO_PERMISSION };
  const id = String(formData.get("id") ?? "");
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("dados") ?? "{}"));
  } catch {
    return { status: "error", message: "Os dados não vieram completos." };
  }
  const parsed = CedulaDataSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      message:
        "Confira os campos: algum texto passou do limite ou ficou sem a espécie.",
    };
  }
  // What the before and after say is marked too (valor, prazo).
  const data = {
    ...parsed.data,
    addenda: parsed.data.addenda.map((a) => ({
      ...a,
      changes: inferChanges(a),
    })),
  };
  try {
    const { learned } = await updateDataWith(
      db,
      ctx.tenant.slug,
      id,
      data,
      ctx.session.user.id,
    );
    revalidatePath(`${BASE}/${id}`);
    return {
      status: "success",
      message: learned
        ? `Dados salvos. Aprendido: títulos com "${learned}" são desta espécie.`
        : "Dados salvos. Os atos e os modelos foram refeitos com eles.",
    };
  } catch (error) {
    return fail(error, "cedulas.update");
  }
}

/** Saves a model as edited, or goes back to the generated text. */
export async function saveCedulaModelAction(
  _previous: CedulaState,
  formData: FormData,
): Promise<CedulaState> {
  const ctx = await access();
  if (!ctx) return { status: "error", message: NO_PERMISSION };
  const id = String(formData.get("id") ?? "");
  const modelId = String(formData.get("modelo") ?? "");
  const reset = formData.get("voltar") === "1";
  const text = String(formData.get("texto") ?? "");
  try {
    await saveModelWith(
      db,
      ctx.tenant.slug,
      id,
      modelId,
      reset ? null : text,
      ctx.session.user.id,
    );
    revalidatePath(`${BASE}/${id}`);
    return {
      status: "success",
      message: reset
        ? "Voltou ao texto gerado. O texto editado ficou no histórico."
        : "Modelo salvo. O texto anterior ficou no histórico.",
    };
  } catch (error) {
    return fail(error, "cedulas.model");
  }
}

/** "Apagar": hidden with a reason; restorable. */
export async function removeCedulaAnalysisAction(
  _previous: CedulaState,
  formData: FormData,
): Promise<CedulaState> {
  const ctx = await access();
  if (!ctx) return { status: "error", message: NO_PERMISSION };
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("justificativa") ?? "").trim();
  if (reason.length < MIN_JUSTIFICATION) {
    return { status: "error", message: "Diga o motivo de apagar a análise." };
  }
  try {
    await removeAnalysisWith(
      db,
      ctx.tenant.slug,
      id,
      reason,
      ctx.session.user.id,
    );
  } catch (error) {
    return fail(error, "cedulas.remove");
  }
  revalidatePath(BASE);
  redirect(`${BASE}?apagada=1`);
}

export async function restoreCedulaAnalysisAction(
  _previous: CedulaState,
  formData: FormData,
): Promise<CedulaState> {
  const ctx = await access();
  if (!ctx) return { status: "error", message: NO_PERMISSION };
  const id = String(formData.get("id") ?? "");
  try {
    await restoreAnalysisWith(db, ctx.tenant.slug, id, ctx.session.user.id);
  } catch (error) {
    return fail(error, "cedulas.restore");
  }
  revalidatePath(BASE);
  redirect(`${BASE}/${id}`);
}

/** Links to a pedido by its protocol, or unlinks (empty). */
export async function linkCedulaRequestAction(
  _previous: CedulaState,
  formData: FormData,
): Promise<CedulaState> {
  const ctx = await access();
  if (!ctx) return { status: "error", message: NO_PERMISSION };
  const id = String(formData.get("id") ?? "");
  const protocol = String(formData.get("protocolo") ?? "").trim();
  const unlink = formData.get("desligar") === "1";
  if (!unlink && !protocol) {
    return { status: "error", message: "Informe o protocolo do pedido." };
  }
  try {
    await linkRequestWith(
      db,
      ctx.tenant.slug,
      id,
      unlink ? null : protocol,
      ctx.session.user.id,
    );
    revalidatePath(`${BASE}/${id}`);
    return {
      status: "success",
      message: unlink
        ? "Vínculo com o pedido desfeito."
        : `Análise ligada ao pedido ${protocol.toUpperCase()}.`,
    };
  } catch (error) {
    return fail(error, "cedulas.link");
  }
}

/** Edits, removes or restores what the analysis learned. */
export async function changeLearnedAction(
  _previous: CedulaState,
  formData: FormData,
): Promise<CedulaState> {
  const ctx = await access();
  if (!ctx) return { status: "error", message: NO_PERMISSION };
  const id = String(formData.get("id") ?? "");
  const kind = String(formData.get("especie") ?? "");
  const op = String(formData.get("operacao") ?? "");
  try {
    await changeLearnedWith(
      db,
      ctx.tenant.slug,
      id,
      op === "apagar"
        ? { removed: true }
        : op === "restaurar"
          ? { removed: false }
          : isCedulaKind(kind)
            ? { kind }
            : {},
      ctx.session.user.id,
    );
    revalidatePath(`${BASE}/configuracao`);
    return {
      status: "success",
      message:
        op === "apagar"
          ? "Aprendizado apagado (fica guardado)."
          : op === "restaurar"
            ? "Aprendizado restaurado."
            : "Espécie alterada.",
    };
  } catch (error) {
    return fail(error, "cedulas.learned");
  }
}

/** The office's note on how each kind of act is charged. */
export async function saveChargeNotesAction(
  _previous: CedulaState,
  formData: FormData,
): Promise<CedulaState> {
  const ctx = await access();
  if (!ctx) return { status: "error", message: NO_PERMISSION };
  const notes: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("nota:")) notes[key.slice(5)] = String(value);
  }
  try {
    await saveChargeNotesWith(db, ctx.tenant.slug, notes, ctx.session.user.id);
    revalidatePath(BASE, "layout");
    return { status: "success", message: "Notas de cobrança salvas." };
  } catch (error) {
    return fail(error, "cedulas.charge");
  }
}

const ChosenSchema = z
  .array(
    z.object({
      title: z.string().max(300),
      description: z.string().max(5000),
      howToComply: z.string().max(5000),
      basis: z.string().max(2000),
      reference: z.string().max(500),
    }),
  )
  .max(60);

/**
 * The nota de exigência after the analysis (decision of 21/11/2026): the
 * exigências the clerk kept open a qualificação of Registro de Imóveis,
 * where the note is numbered, signed, printed and delivered.
 */
export async function createCedulaNoteAction(
  _previous: CedulaState,
  formData: FormData,
): Promise<CedulaState> {
  const ctx = await access();
  if (!ctx) return { status: "error", message: NO_PERMISSION };
  if (
    !can(
      ctx.session.user.role ?? "",
      "qualificacao.manage",
      ctx.session.user.permissions,
    )
  ) {
    return {
      status: "error",
      message:
        "A nota de exigência é emitida pela Qualificação de títulos. Peça ao Tabelião essa permissão em Perfis e permissões.",
    };
  }
  const id = String(formData.get("id") ?? "");
  const presenter = String(formData.get("apresentante") ?? "").trim();
  let chosen: z.infer<typeof ChosenSchema>;
  try {
    chosen = ChosenSchema.parse(
      JSON.parse(String(formData.get("exigencias") ?? "[]")),
    );
  } catch {
    return { status: "error", message: "As exigências não vieram completas." };
  }
  if (chosen.length === 0) {
    return {
      status: "error",
      message: "Marque ou escreva ao menos uma exigência para a nota.",
    };
  }
  if (!presenter) {
    return { status: "error", message: "Informe quem apresentou o título." };
  }
  let qualificationId: string;
  try {
    const analysis = await getAnalysisWith(db, ctx.tenant.slug, id);
    if (!analysis)
      return { status: "error", message: "Análise não encontrada." };
    if (analysis.removedAt) {
      return {
        status: "error",
        message: "Restaure a análise antes de abrir a nota.",
      };
    }
    const data = qualificationFromCedula({
      data: analysis.data,
      plan: planActs(analysis.data),
      presenter,
      protocol: analysis.protocolNumber ?? "",
      today: today(),
      requirements: chosen,
      newId: () => crypto.randomUUID(),
    });
    const problems = (data.rounds[0]?.requirements ?? []).flatMap(
      requirementProblems,
    );
    if (problems.length > 0) {
      return { status: "error", message: problems.join(" ") };
    }
    qualificationId = await createQualificationWith(
      db,
      ctx.tenant.slug,
      data,
      ctx.session.user.id,
    );
    await linkNoteWith(
      db,
      ctx.tenant.slug,
      id,
      qualificationId,
      ctx.session.user.id,
    );
  } catch (error) {
    if (error instanceof QualificationError) {
      return { status: "error", message: error.message };
    }
    return fail(error, "cedulas.note");
  }
  revalidatePath(`${BASE}/${id}`);
  redirect(`/admin/utilitarios/qualificacao/${qualificationId}`);
}
