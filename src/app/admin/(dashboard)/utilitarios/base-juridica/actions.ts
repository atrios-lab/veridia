"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import {
  isOfficialUrl,
  isSourceKind,
  OFFICIAL_CATALOG,
  SOURCE_AREAS,
  type SourceArea,
  type SourceMeta,
  toMarkdown,
} from "@/core/conhecimento/base.ts";
import { db } from "@/db/index.ts";
import {
  AiError,
  aiBlockedWith,
  checkOfficialSource,
  transcribeToMarkdown,
} from "@/lib/ai.ts";
import { askApproval } from "@/lib/approval.ts";
import { recordAuditWith } from "@/lib/audit.ts";
import { currentJustification, justify } from "@/lib/audit-reason.ts";
import {
  confirmSourceWith,
  createSourceWith,
  getRequestWith,
  getSourceWith,
  KnowledgeError,
  listSourcesWith,
  recordCheckWith,
  removeSourceWith,
  resolveRequestWith,
  restoreSourceWith,
  updateSourceMetaWith,
} from "@/lib/knowledge.ts";
import {
  fetchOfficialText,
  type ReadOptions,
  readKnowledgeFiles,
} from "@/lib/knowledge-reading.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export type KnowledgeState =
  | { status: "idle" }
  | { status: "error"; message: string };

export interface SendReport {
  files: number;
  read: number;
  saved: { id: string; title: string; viaAi: boolean; pending: string[] }[];
  notes: string[];
}

export type SendState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "done"; report: SendReport };

const BASE = "/admin/utilitarios/base-juridica";
const NO_PERMISSION =
  "Você não tem permissão para a base jurídica. Peça ao Tabelião em Perfis e permissões.";
const GENERIC = "Não foi possível salvar agora. Tente de novo em instantes.";

async function access() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "knowledge.manage", session.user.permissions)
  ) {
    return undefined;
  }
  return { session, tenant: await getTenant() };
}

function failure(error: unknown, where: string): KnowledgeState {
  if (error instanceof KnowledgeError || error instanceof AiError) {
    return { status: "error", message: error.message };
  }
  console.error(where, error);
  return { status: "error", message: GENERIC };
}

const field = (formData: FormData, name: string) =>
  String(formData.get(name) ?? "").trim();

function metaFromForm(formData: FormData): SourceMeta {
  const kind = field(formData, "tipo");
  const areas = formData
    .getAll("areas")
    .map(String)
    .filter((a): a is SourceArea => Object.hasOwn(SOURCE_AREAS, a));
  return {
    kind: isSourceKind(kind) ? kind : "outro",
    title: field(formData, "titulo"),
    reference: field(formData, "referencia"),
    issuer: field(formData, "orgao"),
    date: field(formData, "data"),
    status: field(formData, "situacao") === "revogada" ? "revogada" : "vigente",
    url: field(formData, "endereco"),
    areas,
    notes: field(formData, "notas"),
  };
}

/** How the office's documents are read: the AI only when it is on. */
async function readOptions(tenantSlug: string): Promise<ReadOptions> {
  const blocked = await aiBlockedWith(db, tenantSlug);
  return blocked
    ? { aiOff: blocked }
    : { transcribe: (input) => transcribeToMarkdown(input) };
}

const filesOf = (formData: FormData, name: string) =>
  formData
    .getAll(name)
    .filter((f): f is File => typeof f === "object" && f.size > 0);

/**
 * Files, a ZIP or pasted text: each document read, made Markdown and
 * dropped; one source each. What looks wrong stays "em conferência".
 */
export async function sendAction(
  _previous: SendState,
  formData: FormData,
): Promise<SendState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const files = filesOf(formData, "documentos");
  const pasted = field(formData, "texto");
  if (files.length === 0 && !pasted) {
    return {
      status: "error",
      message: "Escolha os arquivos ou cole o texto da fonte.",
    };
  }
  const meta = metaFromForm(formData);
  try {
    const report = await readKnowledgeFiles(
      files,
      await readOptions(ok.tenant.slug),
    );
    if (pasted) {
      report.documents.push({
        name: "texto colado",
        markdown: toMarkdown(pasted, meta.title),
        viaAi: false,
      });
    }
    const viaAi = report.documents.filter((d) => d.viaAi).length;
    if (viaAi > 0) {
      await recordAuditWith(db, {
        tenantSlug: ok.tenant.slug,
        actorId: ok.session.user.id,
        action: "ai.transcribe",
        targetType: "tenant",
        targetId: ok.tenant.slug,
      });
    }
    const single = report.documents.length === 1;
    const saved: SendReport["saved"] = [];
    for (const document of report.documents) {
      const ownTitle =
        document.name
          .split(/[/›]/)
          .pop()
          ?.replace(/\.[a-z0-9]+$/i, "")
          .trim() || "Fonte";
      const title = single ? meta.title || ownTitle : ownTitle;
      try {
        const created = await createSourceWith(
          db,
          ok.tenant.slug,
          {
            meta: {
              ...meta,
              title,
              // A reference names one norma: only for a single document.
              reference: single ? meta.reference : "",
              url: single ? meta.url : "",
            },
            markdown: document.markdown,
            origin: document.name,
            viaAi: document.viaAi,
          },
          ok.session.user.id,
        );
        saved.push({
          id: created.id,
          title,
          viaAi: document.viaAi,
          pending: created.pending,
        });
        // When one revokes the other (decision of 15/11/2026), it shows.
        if (created.revoked.length) {
          report.notes.push(
            `${title}: revoga ${created.revoked.join(", ")}, que ${created.revoked.length > 1 ? "foram marcadas" : "foi marcada"} como revogada${created.revoked.length > 1 ? "s" : ""} e deixa${created.revoked.length > 1 ? "m" : ""} de ser usada${created.revoked.length > 1 ? "s" : ""}.`,
          );
        }
        if (created.revokedBy) {
          report.notes.push(
            `${title}: entrou como revogada, porque ${created.revokedBy}, já na base, a revoga.`,
          );
        }
      } catch (error) {
        report.notes.push(
          `${document.name}: ${error instanceof KnowledgeError ? error.message : "não foi possível guardar."}`,
        );
        if (!(error instanceof KnowledgeError))
          console.error("knowledge", error);
      }
    }
    revalidatePath(BASE);
    return {
      status: "done",
      report: {
        files: files.length + (pasted ? 1 : 0),
        read: report.documents.length,
        saved,
        notes: report.notes,
      },
    };
  } catch (error) {
    const failed = failure(error, "knowledge.send");
    return failed.status === "error" ? failed : { status: "idle" };
  }
}

/**
 * The text in force read straight from the official site: a norma of the
 * catalog or an official address. An earlier import of the same address
 * becomes the old version (kept, out of the search).
 */
export async function importOfficialAction(
  _previous: KnowledgeState,
  formData: FormData,
): Promise<KnowledgeState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const key = field(formData, "catalogo");
  const fromCatalog = OFFICIAL_CATALOG.find((c) => c.key === key);
  const meta: SourceMeta = fromCatalog
    ? (({ key: _key, ...rest }) => rest)(fromCatalog)
    : metaFromForm(formData);
  if (!isOfficialUrl(meta.url)) {
    return {
      status: "error",
      message:
        "Use o endereço do site oficial (Planalto, Diário Oficial, CNJ, tribunais, Câmara ou Senado), começando com https://.",
    };
  }
  if (!meta.title) meta.title = meta.reference || "Norma oficial";
  const requestId = field(formData, "pedido");
  let id = "";
  try {
    const text = await fetchOfficialText(meta.url);
    const current = (await listSourcesWith(db, ok.tenant.slug)).find(
      (s) => s.meta.url === meta.url && !s.meta.replacedBy,
    );
    ({ id } = await createSourceWith(
      db,
      ok.tenant.slug,
      {
        meta,
        markdown: toMarkdown(text, meta.title),
        origin: meta.url,
        ...(current
          ? {
              replaces: current.id,
              reason: "Texto vigente lido de novo na fonte oficial.",
            }
          : {}),
      },
      ok.session.user.id,
    ));
    if (requestId) {
      const request = await getRequestWith(db, ok.tenant.slug, requestId);
      if (request?.status === "open") {
        await resolveRequestWith(
          db,
          ok.tenant.slug,
          request.id,
          "done",
          "Texto importado da fonte oficial.",
          ok.session.user.id,
        );
      }
    }
  } catch (error) {
    if (error instanceof Error && !(error instanceof KnowledgeError)) {
      return {
        status: "error",
        message: `Não foi possível ler a fonte oficial agora (${error.message}). Tente de novo ou envie o arquivo baixado do site.`,
      };
    }
    return failure(error, "knowledge.import");
  }
  revalidatePath(BASE);
  redirect(`${BASE}/${id}`);
}

/**
 * The wrong file swapped (decision of 15/11/2026: "precisa ter a opção
 * alterar os já anexados, para caso de anexar PDF errado"): the new file,
 * or the text corrected, becomes the new version; the old one is kept.
 */
export async function replaceAction(
  _previous: KnowledgeState,
  formData: FormData,
): Promise<KnowledgeState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const previousId = field(formData, "id");
  const files = filesOf(formData, "arquivo");
  const text = String(formData.get("texto") ?? "").trim();
  let id = "";
  try {
    const previous = await getSourceWith(db, ok.tenant.slug, previousId);
    if (!previous || previous.removedAt) {
      return { status: "error", message: "Fonte não encontrada." };
    }
    let markdown = "";
    let viaAi = false;
    let origin = previous.origin;
    if (files.length > 0) {
      const read = await readKnowledgeFiles(
        files.slice(0, 1),
        await readOptions(ok.tenant.slug),
      );
      const document = read.documents[0];
      if (!document) {
        return {
          status: "error",
          message: read.notes[0] ?? "O arquivo não tem texto para ler.",
        };
      }
      markdown = document.markdown;
      viaAi = document.viaAi;
      origin = document.name;
      if (viaAi) {
        await recordAuditWith(db, {
          tenantSlug: ok.tenant.slug,
          actorId: ok.session.user.id,
          action: "ai.transcribe",
          targetType: "knowledge-source",
          targetId: previous.id,
        });
      }
    } else if (text) {
      markdown = text;
      origin = "texto corrigido no painel";
    } else {
      return {
        status: "error",
        message: "Escolha o arquivo certo ou corrija o texto.",
      };
    }
    const { pending: _p, check: _c, ...meta } = previous.meta;
    ({ id } = await createSourceWith(
      db,
      ok.tenant.slug,
      {
        meta,
        markdown,
        origin,
        viaAi,
        replaces: previous.id,
        reason: currentJustification() ?? "",
      },
      ok.session.user.id,
    ));
    const requestId = field(formData, "pedido");
    if (requestId) {
      const request = await getRequestWith(db, ok.tenant.slug, requestId);
      if (request?.status === "open") {
        await resolveRequestWith(
          db,
          ok.tenant.slug,
          request.id,
          "done",
          "Documento atualizado enviado.",
          ok.session.user.id,
        );
      }
    }
  } catch (error) {
    return failure(error, "knowledge.replace");
  }
  revalidatePath(BASE);
  redirect(`${BASE}/${id}?nova=1`);
}

export async function editMetaAction(
  _previous: KnowledgeState,
  formData: FormData,
): Promise<KnowledgeState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const id = field(formData, "id");
  try {
    await updateSourceMetaWith(
      db,
      ok.tenant.slug,
      id,
      metaFromForm(formData),
      currentJustification() ?? "",
      ok.session.user.id,
    );
  } catch (error) {
    return failure(error, "knowledge.edit");
  }
  revalidatePath(BASE);
  redirect(`${BASE}/${id}`);
}

export async function confirmAction(
  _previous: KnowledgeState,
  formData: FormData,
): Promise<KnowledgeState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const id = field(formData, "id");
  try {
    await confirmSourceWith(
      db,
      ok.tenant.slug,
      id,
      currentJustification() ?? "",
      ok.session.user.id,
    );
  } catch (error) {
    return failure(error, "knowledge.confirm");
  }
  revalidatePath(BASE);
  redirect(`${BASE}/${id}`);
}

export async function removeAction(
  _previous: KnowledgeState,
  formData: FormData,
): Promise<KnowledgeState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const asked = await askApproval(
    "knowledge.remove",
    formData,
    "Documento da base jurídica",
  );
  if (asked) return asked;
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  try {
    await removeSourceWith(
      db,
      ok.tenant.slug,
      field(formData, "id"),
      currentJustification() ?? "",
      ok.session.user.id,
    );
  } catch (error) {
    return failure(error, "knowledge.remove");
  }
  revalidatePath(BASE);
  redirect(BASE);
}

export async function restoreAction(
  _previous: KnowledgeState,
  formData: FormData,
): Promise<KnowledgeState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const id = field(formData, "id");
  try {
    await restoreSourceWith(
      db,
      ok.tenant.slug,
      id,
      currentJustification() ?? "",
      ok.session.user.id,
    );
  } catch (error) {
    return failure(error, "knowledge.restore");
  }
  revalidatePath(BASE);
  redirect(`${BASE}/${id}`);
}

/** The AI's fixed task: check the source on the official sites only. */
export async function checkAction(
  _previous: KnowledgeState,
  formData: FormData,
): Promise<KnowledgeState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const blocked = await aiBlockedWith(db, ok.tenant.slug);
  if (blocked) return { status: "error", message: blocked };
  const id = field(formData, "id");
  try {
    const source = await getSourceWith(db, ok.tenant.slug, id);
    if (!source || source.removedAt) {
      return { status: "error", message: "Fonte não encontrada." };
    }
    const check = await checkOfficialSource(source.meta);
    await recordCheckWith(db, ok.tenant.slug, id, check, ok.session.user.id);
  } catch (error) {
    return failure(error, "knowledge.check");
  }
  revalidatePath(BASE);
  redirect(`${BASE}/${id}?conferida=1`);
}

/** A request of the AI dismissed, with the reason. */
export async function dismissRequestAction(
  _previous: KnowledgeState,
  formData: FormData,
): Promise<KnowledgeState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const asked = await askApproval(
    "knowledge.request",
    formData,
    "Pedido de inclusão na base jurídica",
  );
  if (asked) return asked;
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  try {
    await resolveRequestWith(
      db,
      ok.tenant.slug,
      field(formData, "id"),
      "dismissed",
      currentJustification() ?? "",
      ok.session.user.id,
    );
  } catch (error) {
    return failure(error, "knowledge.request-dismiss");
  }
  revalidatePath(BASE);
  redirect(BASE);
}
