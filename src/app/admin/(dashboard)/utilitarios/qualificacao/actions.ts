"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { can } from "@/core/auth/roles.ts";
import { buildNote } from "@/core/qualificacao/documents.ts";
import { checkProposalSources } from "@/core/qualificacao/fontes.ts";
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
import { isOpenStatus } from "@/core/request/kinds.ts";
import { requirementTextSchema } from "@/core/request/requirement.ts";
import { officialName } from "@/core/tenant/identification.ts";
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
import { getAiPlatformWith } from "@/lib/ai-platform.ts";
import { askApproval } from "@/lib/approval.ts";
import { currentJustification, justify } from "@/lib/audit-reason.ts";
import { brandFor } from "@/lib/document-brand.ts";
import { notifyCitizen } from "@/lib/email/service-request.ts";
import {
  createKnowledgeRequestWith,
  searchKnowledgeWith,
} from "@/lib/knowledge.ts";
import { readKnowledgeFiles } from "@/lib/knowledge-reading.ts";
import { forDigitalSignature, renderDocument } from "@/lib/pdf.ts";
import {
  applyAiProposalWith,
  createLibraryItemWith,
  createQualificationWith,
  getNoteWith,
  getQualificationWith,
  issueNoteWith,
  listLibraryWith,
  markLibraryItemWith,
  markQualificationWith,
  noteNeedsValidation,
  noteValidatedAtWith,
  QualificationError,
  reexamWith,
  removeNoteWith,
  renumberNoteWith,
  requestDocumentsWith,
  saveDeadlineSettingsWith,
  saveQualificationWith,
  updateLibraryItemWith,
  validateNoteWith,
} from "@/lib/qualificacao.ts";
import {
  learnedStyleWith,
  learnFromReviewWith,
  learnNextExistingWith,
  linkReviewWith,
  pendingLearningCountWith,
  reviewDocumentWith,
} from "@/lib/qualificacao-revisao.ts";
import {
  attachToRequest,
  findByProtocol,
  listAttachments,
  reconcileDeadlinePause,
  registerRequirement,
} from "@/lib/service-request.ts";
import { getSession } from "@/lib/session.ts";
import { CertificatePasswordError } from "@/lib/signature/certificate.ts";
import { requestOrigin, verifyUrlFor } from "@/lib/signature/documents.ts";
import { PdfNotSignableError } from "@/lib/signature/pades.ts";
import {
  findSignedDocumentWith,
  SigningError,
  signNewDocumentWith,
} from "@/lib/signing.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import {
  AttachmentError,
  readStoredFile,
  storeAttachments,
} from "@/lib/uploads.ts";

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
  const asked = await askApproval(
    "qualificacao.note",
    formData,
    "Nota de qualificação",
  );
  if (asked) return asked;
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

const EXTENSION_OF: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.oasis.opendocument.text": "odt",
  "application/rtf": "rtf",
  "text/plain": "txt",
  "application/zip": "zip",
};

/** A stored attachment's name with the extension its type says. */
function fileNameFor(doc: { displayName: string; mimeType: string }): string {
  const ext = EXTENSION_OF[doc.mimeType];
  const base = doc.displayName.trim() || "documento";
  return ext && !base.toLowerCase().endsWith(`.${ext}`)
    ? `${base}.${ext}`
    : base;
}

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
  // A new file is optional (decision of 15/11/2026): what the client
  // already attached to the pedido is read first.
  const uploaded = formData
    .getAll("titulo")
    .filter((f): f is File => typeof f === "object" && f.size > 0);
  let count = 0;
  try {
    const q = await getQualificationWith(db, ok.tenant.slug, id);
    if (!q || q.removedAt) {
      return { status: "error", message: "Qualificação não encontrada." };
    }
    const fromRequest: File[] = [];
    const unread: string[] = [];
    for (const doc of await requestDocumentsWith(
      db,
      ok.tenant.slug,
      q.data.protocol,
    )) {
      try {
        const bytes = await readStoredFile(doc.path);
        fromRequest.push(
          new File([new Uint8Array(bytes)], fileNameFor(doc), {
            type: doc.mimeType,
          }),
        );
      } catch {
        unread.push(
          `${doc.displayName}: não foi possível abrir o arquivo do pedido.`,
        );
      }
    }
    const files = [...fromRequest, ...uploaded];
    if (files.length === 0) {
      return {
        status: "error",
        message: q.data.protocol.trim()
          ? "O pedido não tem documentos do cliente disponíveis. Anexe o título e os documentos para o Assistente Virtual ler."
          : "Anexe o título e os documentos que vieram com ele.",
      };
    }
    if (currentRound(q.data).result !== "aberta") {
      return {
        status: "error",
        message:
          "O Assistente Virtual propõe só na rodada aberta: registre a reapresentação primeiro.",
      };
    }
    const titleFiles: TitleFile[] = [];
    const notes: string[] = [...unread];
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
    const [library, passages, style] = await Promise.all([
      listLibraryWith(db, ok.tenant.slug, q.data.attribution, {
        act: q.data.act,
      }),
      searchKnowledgeWith(
        db,
        ok.tenant.slug,
        `${act} ${q.data.object}`.slice(0, 300),
        { area: q.data.attribution, limit: 12 },
      ),
      learnedStyleWith(db, ok.tenant.slug, q.data.attribution).catch(
        (): string[] => [],
      ),
    ]);
    const proposal = await proposeQualification({
      style,
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
    // Never invented (decision of 15/11/2026): an exigência whose
    // fundamento cannot be checked is set aside and named in the summary.
    const checked = checkProposalSources(proposal.exigencias, {
      libraryIds: library.map((l) => l.id),
      references: passages.map((p) => `${p.reference} ${p.title}`),
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
          checked.setAside.length
            ? `Deixadas de fora por não terem fundamento conferido na base, na biblioteca ou em site oficial (confira antes de incluir): ${checked.setAside.join("; ")}.`
            : "",
          notes.length ? `Arquivos não lidos: ${notes.join(" ")}` : "",
        ]
          .filter(Boolean)
          .join(" "),
        previous: proposal.anteriores.map((a) => ({
          id: a.id,
          status: a.situacao,
          reason: a.motivo,
        })),
        requirements: checked.kept.map((e) => ({
          libraryId: e.biblioteca,
          title: e.titulo,
          description: e.descricao,
          howToComply: e.comoCumprir,
          basis: e.endereco
            ? `${e.fundamento} (fonte oficial: ${e.endereco})`
            : e.fundamento,
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

/**
 * The nota devolutiva sent to the client through the pedido it came from
 * (decision of 15/11/2026: "que ofereça todas as opções"): the exigência
 * written as text, as the office does today, and, if chosen, the note's
 * PDF made by the platform and/or a file the office picks (the note
 * signed, for instance). The citizen is told, as with any exigência.
 */
export async function sendNoteToRequestAction(
  _previous: QualificationState,
  formData: FormData,
): Promise<QualificationState> {
  const ok = await access();
  if (
    !ok ||
    !can(
      ok.session.user.role ?? "",
      "requests.manage",
      ok.session.user.permissions,
    )
  ) {
    return { status: "error", message: NO_PERMISSION };
  }
  const parsed = requirementTextSchema.safeParse(field(formData, "text"));
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Texto inválido.",
    };
  }
  // How the note's PDF goes (decision of 15/11/2026): not at all, as it
  // is, signed with the person's A1 certificate, or printed, signed by
  // hand and handed over in person.
  const pdfMode = field(formData, "pdfModo");
  const withPdf = pdfMode === "sem-assinatura" || pdfMode === "a1";
  const picked = formData
    .getAll("arquivo")
    .filter((f): f is File => typeof f === "object" && f.size > 0);
  try {
    const note = await getNoteWith(
      db,
      ok.tenant.slug,
      field(formData, "noteId"),
    );
    if (!note || note.removedAt || note.kind !== "devolutiva") {
      return { status: "error", message: "Nota não encontrada." };
    }
    // What the Assistente Virtual proposed goes out only validated.
    if (
      noteNeedsValidation(note) &&
      !can(
        ok.session.user.role ?? "",
        "qualificacao.validate",
        ok.session.user.permissions,
      ) &&
      !(await noteValidatedAtWith(db, ok.tenant.slug, note.id))
    ) {
      return {
        status: "error",
        message:
          "Esta nota tem exigência proposta pelo Assistente Virtual: o Tabelião precisa validá-la antes de ir ao cliente.",
      };
    }
    const request = await findByProtocol(
      ok.tenant.slug,
      note.snapshot.protocol,
    );
    if (!request || request.kind !== "service-request") {
      return {
        status: "error",
        message: "Esta qualificação não está ligada a um pedido do balcão.",
      };
    }
    if (!isOpenStatus("service-request", request.status)) {
      return {
        status: "error",
        message: "O pedido já foi encerrado: não recebe exigência nova.",
      };
    }
    const files: File[] = [];
    if (withPdf) {
      const document = buildNote(ok.tenant, {
        number: note.number,
        data: note.snapshot,
        issuedOn: note.issuedOn,
        signer: note.signer,
        roundIndex: note.roundIndex,
      });
      const brand = await brandFor(ok.tenant);
      let pdf: Uint8Array<ArrayBuffer>;
      if (pdfMode === "a1") {
        // The version for a digital signature (no line to sign by hand),
        // signed by the platform's assinador: band, QR and record.
        const unsigned = await forDigitalSignature(() =>
          renderDocument(document, brand),
        );
        const origin = await requestOrigin();
        const signed = await signNewDocumentWith(
          db,
          ok.tenant.slug,
          {
            certificateId: field(formData, "certificateId"),
            password: String(formData.get("password") ?? ""),
            pdf: Buffer.from(unsigned),
            title: `Nota devolutiva nº ${note.number}`,
            originalName: `nota-devolutiva-${note.number.replace("/", "-")}.pdf`,
            verifyUrl: (code) => verifyUrlFor(ok.tenant, origin, code),
            location: `${ok.tenant.location.city}/${ok.tenant.location.state}`,
            officeName: officialName(ok.tenant),
          },
          ok.session.user.id,
        );
        const view = await findSignedDocumentWith(db, ok.tenant.slug, {
          id: signed.id,
        });
        if (!view?.filePath) throw new SigningError("Assinatura sem arquivo.");
        pdf = new Uint8Array(await readStoredFile(view.filePath));
      } else {
        pdf = new Uint8Array(await renderDocument(document, brand));
      }
      files.push(
        new File(
          [pdf],
          `nota-devolutiva-${note.number.replace("/", "-")}.pdf`,
          { type: "application/pdf" },
        ),
      );
    }
    files.push(...picked);
    const stored = files.length
      ? await storeAttachments(files, {
          tenantSlug: ok.tenant.slug,
          kind: "formulario-exigencia",
          name: files.map((f, i) =>
            withPdf && i === 0
              ? `Nota devolutiva nº ${note.number}`
              : f.name.replace(/\.[a-z0-9]+$/i, ""),
          ),
        })
      : [];
    const text =
      pdfMode === "pessoalmente"
        ? `${parsed.data}\n\nA nota devolutiva assinada foi entregue pessoalmente pela serventia.`
        : parsed.data;
    const { id: requirementId } = await registerRequirement(
      ok.tenant.slug,
      request.id,
      text,
      ok.session.user.id,
    );
    if (stored.length) {
      await attachToRequest(
        ok.tenant.slug,
        request.id,
        stored,
        "office",
        requirementId,
      );
      // The files the clerk added (external notes) are reviewed and
      // learned from after the answer (decision of 16/11/2026), so the
      // send is not slowed: the review shows under each file on the
      // request, and the library gains the generic models.
      const pickedNames = stored
        .slice(withPdf ? 1 : 0)
        .map((s) => s.storedName);
      if (pickedNames.length) {
        const tenantSlug = ok.tenant.slug;
        const actorId = ok.session.user.id;
        const requestId = request.id;
        const attribution = note.snapshot.attribution;
        const act = actName(note.snapshot);
        after(async () => {
          try {
            const [aiBlocked, platform] = await Promise.all([
              aiBlockedWith(db, tenantSlug),
              getAiPlatformWith(db, tenantSlug),
            ]);
            // With the AI only when the office's mode says so; otherwise
            // by the legal base alone, with no credit.
            const mode = platform.noteReview === "ia" ? "ia" : "base";
            const rows = (await listAttachments(tenantSlug, requestId)).filter(
              (a) => pickedNames.includes(a.storedName) && a.path,
            );
            for (const row of rows) {
              const review = await reviewDocumentWith(db, tenantSlug, {
                bytes: new Uint8Array(await readStoredFile(row.path ?? "")),
                name: row.displayName,
                mimeType: row.mimeType,
                requestId,
                attribution,
                act,
                actorId,
                aiBlocked,
                mode,
              });
              await linkReviewWith(db, tenantSlug, {
                reviewId: review.id,
                attachmentId: row.id,
                requestId,
                actorId,
              });
              await learnFromReviewWith(db, tenantSlug, review.id, attribution);
            }
          } catch (error) {
            console.error("qualificacao.review-picked", error);
          }
        });
      }
    }
    await reconcileDeadlinePause(
      ok.tenant,
      request.id,
      ok.session.user.id,
      today(),
    );
    await notifyCitizen({
      tenant: ok.tenant,
      contact: request.contact,
      protocolNumber: request.protocolNumber,
      subject: "Exigência registrada",
      body: stored.length
        ? "Há uma exigência no seu pedido, com documento anexo. Consulte o protocolo com a sua chave de acesso para ver o que foi solicitado e responder."
        : "Há uma exigência no seu pedido. Consulte o protocolo com a sua chave de acesso para ver o que foi solicitado e responder.",
    });
  } catch (error) {
    if (
      error instanceof AttachmentError ||
      error instanceof SigningError ||
      error instanceof CertificatePasswordError ||
      error instanceof PdfNotSignableError
    ) {
      return { status: "error", message: error.message };
    }
    return failure(error, "qualificacao.send-note");
  }
  revalidatePath(BASE, "layout");
  revalidatePath("/admin/pedidos", "layout");
  return {
    status: "saved",
    message: "Exigência registrada no pedido. O cliente foi avisado.",
  };
}

/**
 * "Guardar na biblioteca" (decision of 15/11/2026): an exigência written
 * in a note becomes a model for the next ones, for the same attribution
 * and act. What the office keeps teaching the Assistente Virtual.
 */
export async function saveRequirementToLibraryAction(input: {
  attribution: string;
  act: string;
  title: string;
  description: string;
  howToComply: string;
  basis: string;
}): Promise<QualificationState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  if (!isAttribution(input.attribution)) {
    return { status: "error", message: "Atribuição inválida." };
  }
  try {
    await createLibraryItemWith(
      db,
      ok.tenant.slug,
      {
        attribution: input.attribution,
        acts: input.act && input.act !== "outro" ? [input.act] : [],
        title: input.title.trim(),
        description: input.description.trim(),
        howToComply: input.howToComply.trim(),
        basis: input.basis.trim(),
      },
      ok.session.user.id,
    );
  } catch (error) {
    return failure(error, "qualificacao.library-from-note");
  }
  revalidatePath(`${BASE}/biblioteca`);
  return {
    status: "saved",
    message:
      "Exigência guardada na biblioteca. Ela aparece nas próximas qualificações deste ato.",
  };
}

/** The Tabelião validates the note for the client (`qualificacao.validate`). */
export async function validateNoteAction(
  _previous: QualificationState,
  formData: FormData,
): Promise<QualificationState> {
  const ok = await access();
  if (
    !ok ||
    !can(
      ok.session.user.role ?? "",
      "qualificacao.validate",
      ok.session.user.permissions,
    )
  ) {
    return {
      status: "error",
      message: "Só o Tabelião (ou quem ele autorizar) valida a nota.",
    };
  }
  try {
    await validateNoteWith(
      db,
      ok.tenant.slug,
      field(formData, "noteId"),
      ok.session.user.id,
    );
  } catch (error) {
    return failure(error, "qualificacao.note-validate");
  }
  revalidatePath(BASE, "layout");
  return {
    status: "saved",
    message: "Nota validada. Ela já pode ir ao cliente.",
  };
}

export type LearnState =
  | { status: "error"; message: string }
  | {
      status: "success";
      /** Nothing left to read. */
      done: boolean;
      remaining: number;
      item?: {
        protocolNumber: string;
        fileName: string;
        headline: string;
        findings: number;
        learned: number;
      };
    };

/**
 * One note already attached, reviewed and learned from (decision of
 * 16/11/2026: "se tiver algo já anexado nas plataformas já pode aprender a
 * partir de agora"). The screen calls it again until nothing is left, so
 * each call is one note and the clerk sees the progress.
 */
export async function learnNextAttachedAction(): Promise<LearnState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  try {
    // With the AI only in the office's "ia" mode and when it may run; else
    // from the notes' own text and the legal base, with no credit.
    const [blocked, platform] = await Promise.all([
      aiBlockedWith(db, ok.tenant.slug),
      getAiPlatformWith(db, ok.tenant.slug),
    ]);
    const mode = platform.noteReview === "ia" && !blocked ? "ia" : "base";
    const next = await learnNextExistingWith(
      db,
      ok.tenant.slug,
      blocked,
      undefined,
      mode,
    );
    const remaining = await pendingLearningCountWith(db, ok.tenant.slug);
    revalidatePath(`${BASE}/biblioteca`);
    if (!next) return { status: "success", done: true, remaining };
    return {
      status: "success",
      done: remaining === 0,
      remaining,
      item: {
        protocolNumber: next.protocolNumber,
        fileName: next.review.fileName,
        headline: next.review.headline,
        findings: next.review.result.findings.length,
        learned: next.learned,
      },
    };
  } catch (error) {
    if (error instanceof AiError) {
      return { status: "error", message: error.message };
    }
    console.error("qualificacao.learn-attached", error);
    return { status: "error", message: GENERIC };
  }
}
