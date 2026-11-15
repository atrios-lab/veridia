"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import {
  ATTRIBUTION_ORDER,
  type DeadlineSettings,
} from "@/core/qualificacao/prazos.ts";
import {
  ATTRIBUTIONS,
  type Attribution,
  actName,
  currentRound,
  isAttribution,
  qualificationFrom,
} from "@/core/qualificacao/qualificacao.ts";
import { db } from "@/db/index.ts";
import {
  AI_IMAGE_MAX_BYTES,
  AI_IMAGE_TYPES,
  AI_PDF_MAX_BYTES,
  AiError,
  aiBlockedWith,
  proposeQualification,
  type TitleFile,
  transcribeToMarkdown,
} from "@/lib/ai.ts";
import { currentJustification, justify } from "@/lib/audit-reason.ts";
import {
  createKnowledgeRequestWith,
  searchKnowledgeWith,
} from "@/lib/knowledge.ts";
import { readKnowledgeFiles } from "@/lib/knowledge-reading.ts";
import {
  applyAiProposalWith,
  createLibraryItemWith,
  createQualificationWith,
  getQualificationWith,
  issueNoteWith,
  listLibraryWith,
  markLibraryItemWith,
  markQualificationWith,
  QualificationError,
  reexamWith,
  removeNoteWith,
  renumberNoteWith,
  saveDeadlineSettingsWith,
  saveQualificationWith,
  updateLibraryItemWith,
} from "@/lib/qualificacao.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, today } from "@/lib/tenant.ts";

export type QualificationState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "saved"; message: string };

const BASE = "/admin/utilitarios/qualificacao";
const NO_PERMISSION =
  "Você não tem permissão para a qualificação de títulos. Peça ao Tabelião em Perfis e permissões.";
const GENERIC = "Não foi possível salvar agora. Tente de novo em instantes.";

async function access() {
  const session = await getSession();
  if (
    !session ||
    !can(
      session.user.role ?? "",
      "qualificacao.manage",
      session.user.permissions,
    )
  ) {
    return undefined;
  }
  return { session, tenant: await getTenant() };
}

function failure(error: unknown, where: string): QualificationState {
  if (error instanceof QualificationError || error instanceof AiError) {
    return { status: "error", message: error.message };
  }
  console.error(where, error);
  return { status: "error", message: GENERIC };
}

const field = (formData: FormData, name: string) =>
  String(formData.get(name) ?? "").trim();

/** The whole qualificação, sent by the editor as JSON. */
function dataOf(formData: FormData) {
  try {
    return qualificationFrom(JSON.parse(field(formData, "data") || "{}"));
  } catch {
    throw new QualificationError("Dados da qualificação inválidos.");
  }
}

export async function createAction(
  _previous: QualificationState,
  formData: FormData,
): Promise<QualificationState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  let id = "";
  try {
    id = await createQualificationWith(
      db,
      ok.tenant.slug,
      dataOf(formData),
      ok.session.user.id,
    );
  } catch (error) {
    return failure(error, "qualificacao.create");
  }
  revalidatePath(BASE);
  redirect(`${BASE}/${id}`);
}

/**
 * The editor's save: the open round's exigências, the fundamentos, the
 * observações or the presentation. With a note issued, it asks why.
 */
export async function saveAction(
  _previous: QualificationState,
  formData: FormData,
): Promise<QualificationState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const id = field(formData, "id");
  try {
    await saveQualificationWith(
      db,
      ok.tenant.slug,
      id,
      dataOf(formData),
      ok.session.user.id,
      field(formData, "justificativa"),
    );
  } catch (error) {
    return failure(error, "qualificacao.edit");
  }
  revalidatePath(`${BASE}/${id}`);
  if (field(formData, "voltar") === "ficha") redirect(`${BASE}/${id}`);
  return { status: "saved", message: "Qualificação salva." };
}

export async function issueAction(
  _previous: QualificationState,
  formData: FormData,
): Promise<QualificationState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const id = field(formData, "id");
  const kind =
    field(formData, "tipo") === "positiva" ? "positiva" : "devolutiva";
  try {
    await issueNoteWith(
      db,
      ok.tenant.slug,
      id,
      kind,
      {
        issuedOn: field(formData, "data") || today(),
        signer: {
          name: field(formData, "assinante"),
          role: field(formData, "cargo"),
        },
      },
      ok.session.user.id,
    );
  } catch (error) {
    return failure(error, "qualificacao.issue");
  }
  revalidatePath(BASE);
  redirect(`${BASE}/${id}?emitida=${kind}`);
}

export async function reexamAction(
  _previous: QualificationState,
  formData: FormData,
): Promise<QualificationState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const id = field(formData, "id");
  try {
    await reexamWith(
      db,
      ok.tenant.slug,
      id,
      field(formData, "documentos"),
      field(formData, "data") || today(),
      ok.session.user.id,
    );
  } catch (error) {
    return failure(error, "qualificacao.reexam");
  }
  revalidatePath(BASE);
  redirect(`${BASE}/${id}`);
}

export async function removeNoteAction(
  _previous: QualificationState,
  formData: FormData,
): Promise<QualificationState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  let id = "";
  try {
    id = await removeNoteWith(
      db,
      ok.tenant.slug,
      field(formData, "id"),
      currentJustification() ?? "",
      ok.session.user.id,
    );
  } catch (error) {
    return failure(error, "qualificacao.note-remove");
  }
  revalidatePath(BASE);
  redirect(`${BASE}/${id}`);
}

export async function renumberNoteAction(
  _previous: QualificationState,
  formData: FormData,
): Promise<QualificationState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  try {
    await renumberNoteWith(
      db,
      ok.tenant.slug,
      field(formData, "id"),
      Number.parseInt(field(formData, "sequence"), 10),
      currentJustification() ?? "",
      ok.session.user.id,
    );
  } catch (error) {
    return failure(error, "qualificacao.note-renumber");
  }
  revalidatePath(BASE);
  redirect(`${BASE}/${field(formData, "qualificacao")}`);
}

export async function markAction(
  _previous: QualificationState,
  formData: FormData,
): Promise<QualificationState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const id = field(formData, "id");
  const restore = field(formData, "estornar") === "1";
  try {
    await markQualificationWith(
      db,
      ok.tenant.slug,
      id,
      currentJustification() ?? "",
      ok.session.user.id,
      restore,
    );
  } catch (error) {
    return failure(error, "qualificacao.mark");
  }
  revalidatePath(BASE);
  redirect(restore ? `${BASE}/${id}` : BASE);
}

// ---------------------------------------------------------------- library

function libraryInput(formData: FormData) {
  const attribution = field(formData, "atribuicao");
  return {
    attribution: (isAttribution(attribution)
      ? attribution
      : "rcpn") as Attribution,
    acts: formData.getAll("atos").map(String),
    title: field(formData, "titulo"),
    description: field(formData, "descricao"),
    howToComply: field(formData, "cumprimento"),
    basis: field(formData, "fundamento"),
  };
}

export async function saveLibraryAction(
  _previous: QualificationState,
  formData: FormData,
): Promise<QualificationState> {
  const id = field(formData, "id");
  if (id) {
    const why = justify(formData);
    if (why) return { status: "error", message: why };
  }
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const input = libraryInput(formData);
  try {
    if (id) {
      await updateLibraryItemWith(
        db,
        ok.tenant.slug,
        id,
        input,
        currentJustification() ?? "",
        ok.session.user.id,
      );
    } else {
      await createLibraryItemWith(
        db,
        ok.tenant.slug,
        input,
        ok.session.user.id,
      );
    }
  } catch (error) {
    return failure(error, "qualificacao.library");
  }
  revalidatePath(`${BASE}/biblioteca`);
  redirect(`${BASE}/biblioteca?atribuicao=${input.attribution}`);
}

export async function markLibraryAction(
  _previous: QualificationState,
  formData: FormData,
): Promise<QualificationState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const restore = field(formData, "estornar") === "1";
  try {
    await markLibraryItemWith(
      db,
      ok.tenant.slug,
      field(formData, "id"),
      currentJustification() ?? "",
      ok.session.user.id,
      restore,
    );
  } catch (error) {
    return failure(error, "qualificacao.library-mark");
  }
  revalidatePath(`${BASE}/biblioteca`);
  redirect(
    `${BASE}/biblioteca?atribuicao=${field(formData, "atribuicao") || "rcpn"}`,
  );
}

/**
 * The terms by attribution: "lei" keeps the law's suggestion, "sem" sets
 * no term, a number sets the office's own.
 */
export async function saveDeadlinesAction(
  _previous: QualificationState,
  formData: FormData,
): Promise<QualificationState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const deadlines: DeadlineSettings = {};
  for (const attribution of ATTRIBUTION_ORDER) {
    const choice = field(formData, `modo-${attribution}`);
    if (choice === "sem") deadlines[attribution] = null;
    else if (choice === "proprio") {
      const days = Number.parseInt(field(formData, `dias-${attribution}`), 10);
      if (!Number.isInteger(days) || days < 1 || days > 365) {
        return {
          status: "error",
          message: "Informe o prazo em dias úteis, de 1 a 365.",
        };
      }
      deadlines[attribution] = days;
    }
  }
  try {
    await saveDeadlineSettingsWith(
      db,
      ok.tenant.slug,
      deadlines,
      ok.session.user.id,
    );
  } catch (error) {
    return failure(error, "qualificacao.deadlines");
  }
  revalidatePath(BASE);
  return { status: "saved", message: "Prazos salvos." };
}

const TOTAL_AI_BYTES = 30 * 1024 * 1024;

/**
 * The AI's fixed task (phase 2): the título's documents are read and
 * dropped, the office's library and legal base go along, and the proposal
 * comes back as draft exigências a person checks one by one.
 */
export async function proposeAction(
  _previous: QualificationState,
  formData: FormData,
): Promise<QualificationState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const blocked = await aiBlockedWith(db, ok.tenant.slug);
  if (blocked) return { status: "error", message: blocked };
  const id = field(formData, "id");
  const files = formData
    .getAll("titulo")
    .filter((f): f is File => typeof f === "object" && f.size > 0);
  if (files.length === 0) {
    return {
      status: "error",
      message: "Anexe o título e os documentos que vieram com ele.",
    };
  }
  let count = 0;
  try {
    const q = await getQualificationWith(db, ok.tenant.slug, id);
    if (!q || q.removedAt) {
      return { status: "error", message: "Qualificação não encontrada." };
    }
    if (currentRound(q.data).result !== "aberta") {
      return {
        status: "error",
        message:
          "O Assistente Virtual propõe só na rodada aberta: registre a reapresentação primeiro.",
      };
    }
    const titleFiles: TitleFile[] = [];
    const notes: string[] = [];
    let total = 0;
    for (const file of files) {
      total += file.size;
      if (total > TOTAL_AI_BYTES) {
        notes.push(
          `${file.name}: passou de 30 MB no envio ao Assistente Virtual.`,
        );
        continue;
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      const ext = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase() ?? "";
      if (String.fromCharCode(...bytes.subarray(0, 4)) === "%PDF") {
        if (bytes.length > AI_PDF_MAX_BYTES)
          notes.push(`${file.name}: PDF grande demais.`);
        else titleFiles.push({ kind: "pdf", name: file.name, bytes });
      } else if (Object.hasOwn(AI_IMAGE_TYPES, ext)) {
        if (bytes.length > AI_IMAGE_MAX_BYTES)
          notes.push(`${file.name}: imagem maior que 5 MB.`);
        else
          titleFiles.push({
            kind: "image",
            name: file.name,
            bytes,
            mediaType: AI_IMAGE_TYPES[ext as keyof typeof AI_IMAGE_TYPES],
          });
      } else {
        const read = await readKnowledgeFiles([file], {
          transcribe: (input) => transcribeToMarkdown(input),
        });
        for (const d of read.documents) {
          titleFiles.push({ kind: "text", name: d.name, text: d.markdown });
        }
        notes.push(...read.notes);
      }
    }
    if (titleFiles.length === 0) {
      return {
        status: "error",
        message: notes[0] ?? "Nenhum arquivo pôde ser lido.",
      };
    }
    const act = actName(q.data);
    const [library, passages] = await Promise.all([
      listLibraryWith(db, ok.tenant.slug, q.data.attribution, {
        act: q.data.act,
      }),
      searchKnowledgeWith(
        db,
        ok.tenant.slug,
        `${act} ${q.data.object}`.slice(0, 300),
        { area: q.data.attribution, limit: 12 },
      ),
    ]);
    const proposal = await proposeQualification({
      attribution: ATTRIBUTIONS[q.data.attribution],
      act,
      object: q.data.object,
      document: q.data.document,
      library: library.map((l) => ({
        id: l.id,
        title: l.title,
        description: l.description,
        howToComply: l.howToComply,
        basis: l.basis,
      })),
      passages: passages.map((p) => ({
        reference: p.reference || p.title,
        heading: p.heading,
        text: p.text,
      })),
      files: titleFiles,
      previous: currentRound(q.data)
        .requirements.filter((r) => r.round < currentRound(q.data).n)
        .map((r) => ({ id: r.id, title: r.title, howToComply: r.howToComply })),
    });
    count = await applyAiProposalWith(
      db,
      ok.tenant.slug,
      id,
      {
        summary: [
          proposal.resultado === "positiva"
            ? "O Assistente Virtual não encontrou exigência: sugere a qualificação positiva."
            : "",
          proposal.resumo,
          notes.length ? `Arquivos não lidos: ${notes.join(" ")}` : "",
        ]
          .filter(Boolean)
          .join(" "),
        previous: proposal.anteriores.map((a) => ({
          id: a.id,
          status: a.situacao,
          reason: a.motivo,
        })),
        requirements: proposal.exigencias.map((e) => ({
          libraryId: e.biblioteca,
          title: e.titulo,
          description: e.descricao,
          howToComply: e.comoCumprir,
          basis: e.fundamento,
          reference: e.referencia,
          excerpt: e.trecho,
        })),
      },
      ok.session.user.id,
    );
    for (const missing of proposal.fontesFaltando.slice(0, 5)) {
      await createKnowledgeRequestWith(
        db,
        ok.tenant.slug,
        {
          topic: missing.tema,
          detail: `Apontada pelo Assistente Virtual ao qualificar ${act.toLowerCase()}.`,
          officialUrl: missing.endereco,
        },
        ok.session.user.id,
      );
    }
  } catch (error) {
    return failure(error, "qualificacao.ai");
  }
  revalidatePath(`${BASE}/${id}`);
  redirect(`${BASE}/${id}?ia=${count}`);
}
