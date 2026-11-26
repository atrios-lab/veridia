"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can, type Permission } from "@/core/auth/roles.ts";
import type { PartyRole } from "@/core/ri/acts.ts";
import {
  matriculaNumber,
  PropertyError,
  readProperty,
} from "@/core/ri/property.ts";
import {
  transferFromJson,
  transferFromTable,
  transferFromXml,
} from "@/core/ri/transfer.ts";
import { officeHolidays } from "@/core/scheduling/calendar.ts";
import { db } from "@/db/index.ts";
import { recordAuditWith } from "@/lib/audit.ts";
import { justify } from "@/lib/audit-reason.ts";
import {
  type ActPartyInput,
  addAnnotationWith,
  createActWith,
  createPersonWith,
  createPropertyWith,
  editAnnotationWith,
  generateExportWith,
  markExportImportedWith,
  propertyDetailWith,
  RiError,
  readActInput,
  saveRiSettingsWith,
  setActDeletedWith,
  setAnnotationDeletedWith,
  setCnmInPgvWith,
  setPersonDeletedWith,
  setPropertyDeletedWith,
  updateActWith,
  updatePersonWith,
  updatePropertyWith,
  withdrawExportWith,
} from "@/lib/ri.ts";
import {
  addFileWith,
  applyReadingWith,
  fileWith,
  linkFileWith,
  type ReadingResult,
  RI_FILE_MAX_BYTES,
  readMatriculaFilesWith,
  riFolder,
  saveReadingWith,
  saveSignatureImageWith,
  saveSignerWith,
  setFileDeletedWith,
} from "@/lib/ri-files.ts";
import {
  addGeometryWith,
  readGeometrySource,
  setGeometryDeletedWith,
} from "@/lib/ri-geo.ts";
import {
  createProtocolWith,
  issueRequirementsWith,
  readProtocolInput,
  readRequirements,
  reentryWith,
  registerProtocolWith,
  setProtocolStatusWith,
  setProtocolVoidedWith,
  updateProtocolWith,
} from "@/lib/ri-protocols.ts";
import { SheetFileError, transferFile } from "@/lib/ri-sheet.ts";
import {
  applyTransferWith,
  previewTransferWith,
  type TransferPreview,
  type TransferResult,
} from "@/lib/ri-transfer.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import {
  deleteStoredFile,
  readStoredFile,
  storeRegistryFile,
} from "@/lib/uploads.ts";

export type RiState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const NO_PERMISSION: Partial<Record<Permission, string>> = {
  "ri.edit":
    "Você não tem permissão para alterar o acervo do Registro de Imóveis.",
  "ri.import":
    "Você não tem permissão para importar matrículas, atos e indicadores.",
  "ri.export": "Você não tem permissão para gerar os arquivos para a ONR.",
};

async function access(permission: Permission) {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", permission, session.user.permissions)
  ) {
    return null;
  }
  const tenant = await getTenant();
  if (!tenant.attributions.includes("RI")) return null;
  return { session, tenant, actor: { id: session.user.id } };
}

const text = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "");

function denied(permission: Permission): RiState {
  return {
    status: "error",
    message: NO_PERMISSION[permission] ?? "Você não tem permissão.",
  };
}

function failure(error: unknown, where: string): RiState {
  if (
    error instanceof RiError ||
    error instanceof PropertyError ||
    error instanceof SheetFileError
  ) {
    return { status: "error", message: error.message };
  }
  console.error(where, error);
  return {
    status: "error",
    message: "Não deu para salvar agora. Tente de novo em instantes.",
  };
}

const propertyPath = (id: string) => `/admin/ri/matriculas/${id}`;

// ------------------------------------------------------------ matrículas

export async function savePropertyAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const ok = await access("ri.edit");
  if (!ok) return denied("ri.edit");
  const id = text(formData, "id");
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") raw[key] = value;
  }
  let target = id;
  try {
    const input = readProperty(raw);
    if (id) {
      const changed = await updatePropertyWith(
        db,
        ok.tenant.slug,
        id,
        input,
        ok.actor,
      );
      if (changed === 0) {
        return { status: "success", message: "Nada mudou na matrícula." };
      }
    } else {
      target = await createPropertyWith(db, ok.tenant.slug, input, ok.actor);
    }
  } catch (error) {
    return failure(error, "ri.property.save");
  }
  revalidatePath("/admin/ri", "layout");
  redirect(propertyPath(target));
}

export async function setPropertyDeletedAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access("ri.edit");
  if (!ok) return denied("ri.edit");
  const id = text(formData, "id");
  const deleted = text(formData, "op") !== "restore";
  try {
    await setPropertyDeletedWith(db, ok.tenant.slug, id, deleted, ok.actor);
  } catch (error) {
    return failure(error, "ri.property.delete");
  }
  revalidatePath("/admin/ri", "layout");
  return {
    status: "success",
    message: deleted
      ? "Matrícula apagada do sistema."
      : "Matrícula restaurada.",
  };
}

export async function setCnmInPgvAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const ok = await access("ri.edit");
  if (!ok) return denied("ri.edit");
  const ids = formData.getAll("ids").map(String);
  if (ids.length === 0) {
    return { status: "error", message: "Marque pelo menos uma matrícula." };
  }
  const inPgv = text(formData, "op") !== "remove";
  try {
    const n = await setCnmInPgvWith(db, ok.tenant.slug, ids, inPgv, ok.actor);
    revalidatePath("/admin/ri", "layout");
    return {
      status: "success",
      message: inPgv
        ? `${n} matrícula(s) marcada(s) como já cadastrada(s) no PGV-CNM.`
        : `${n} matrícula(s) voltaram para o próximo lote.`,
    };
  } catch (error) {
    return failure(error, "ri.cnm.pgv");
  }
}

// ------------------------------------------------------------------ atos

function partiesFrom(formData: FormData): ActPartyInput[] {
  try {
    const parsed = JSON.parse(text(formData, "parties") || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 40).map((p) => ({
      personId: typeof p.personId === "string" ? p.personId : undefined,
      name: String(p.name ?? ""),
      document: String(p.document ?? ""),
      role: String(p.role ?? "outro") as PartyRole,
      share: String(p.share ?? ""),
    }));
  } catch {
    return [];
  }
}

export async function saveActAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const ok = await access("ri.edit");
  if (!ok) return denied("ri.edit");
  const propertyId = text(formData, "propertyId");
  const actId = text(formData, "actId");
  try {
    const input = readActInput({
      kind: text(formData, "kind"),
      effect: text(formData, "effect"),
      nature: text(formData, "nature"),
      registeredOn: text(formData, "registeredOn"),
      summary: text(formData, "summary"),
      cancelsActId: text(formData, "cancelsActId"),
      protocol: text(formData, "protocol"),
      seal: text(formData, "seal"),
      value: text(formData, "value"),
      parties: partiesFrom(formData),
    });
    if (actId) {
      await updateActWith(db, ok.tenant.slug, actId, input, ok.actor);
    } else {
      await createActWith(db, ok.tenant.slug, propertyId, input, ok.actor);
    }
  } catch (error) {
    return failure(error, "ri.act.save");
  }
  revalidatePath("/admin/ri", "layout");
  redirect(propertyPath(propertyId));
}

export async function setActDeletedAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access("ri.edit");
  if (!ok) return denied("ri.edit");
  const deleted = text(formData, "op") !== "restore";
  try {
    await setActDeletedWith(
      db,
      ok.tenant.slug,
      text(formData, "actId"),
      deleted,
      ok.actor,
    );
  } catch (error) {
    return failure(error, "ri.act.delete");
  }
  revalidatePath("/admin/ri", "layout");
  return {
    status: "success",
    message: deleted
      ? "Ato apagado. O número dele não volta a ser usado."
      : "Ato restaurado.",
  };
}

// --------------------------------------------------------------- pessoas

export async function savePersonAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const ok = await access("ri.edit");
  if (!ok) return denied("ri.edit");
  const id = text(formData, "id");
  const who = {
    name: text(formData, "name"),
    document: text(formData, "document"),
    notes: text(formData, "notes"),
  };
  let target = id;
  try {
    if (id) {
      const changed = await updatePersonWith(
        db,
        ok.tenant.slug,
        id,
        who,
        ok.actor,
      );
      if (changed === 0) {
        return { status: "success", message: "Nada mudou." };
      }
    } else {
      target = await createPersonWith(db, ok.tenant.slug, who, ok.actor);
    }
  } catch (error) {
    return failure(error, "ri.person.save");
  }
  revalidatePath("/admin/ri", "layout");
  redirect(`/admin/ri/pessoas/${target}`);
}

export async function setPersonDeletedAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access("ri.edit");
  if (!ok) return denied("ri.edit");
  const deleted = text(formData, "op") !== "restore";
  try {
    await setPersonDeletedWith(
      db,
      ok.tenant.slug,
      text(formData, "id"),
      deleted,
      ok.actor,
    );
  } catch (error) {
    return failure(error, "ri.person.delete");
  }
  revalidatePath("/admin/ri", "layout");
  return {
    status: "success",
    message: deleted ? "Pessoa apagada do cadastro." : "Pessoa restaurada.",
  };
}

// ------------------------------------------------- importar e exportar

export type TransferState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | ({ status: "preview"; fileName: string } & TransferPreview)
  | ({ status: "done" } & TransferResult);

const TRANSFER_MAX_BYTES = 40 * 1024 * 1024;

async function transferOf(name: string, bytes: Uint8Array) {
  const file = await transferFile({ name, bytes });
  if (file.type === "table") return transferFromTable(file.rows, file.label);
  if (file.type === "json") return transferFromJson(file.value);
  return transferFromXml(file.text);
}

/**
 * One form, two steps: "Conferir" reads the file (planilha, JSON or XML
 * of the ONR) and shows what would come in; "Importar" reads the same
 * file again and saves only what is missing.
 */
export async function transferImportAction(
  _previous: TransferState,
  formData: FormData,
): Promise<TransferState> {
  const ok = await access("ri.import");
  if (!ok) {
    return { status: "error", message: NO_PERMISSION["ri.import"] ?? "" };
  }
  try {
    let name: string;
    let bytes: Uint8Array;
    const url = text(formData, "url");
    if (url) {
      if (!ownUpload(url, ok.tenant.slug)) {
        return { status: "error", message: "Arquivo não reconhecido." };
      }
      name = text(formData, "nome") || "arquivo";
      bytes = new Uint8Array(await readStoredFile(url));
    } else {
      const file = formData.get("arquivo");
      if (!(file instanceof File) || file.size === 0) {
        return { status: "error", message: "Escolha o arquivo." };
      }
      if (file.size > TRANSFER_MAX_BYTES) {
        return { status: "error", message: "O arquivo passa de 40 MB." };
      }
      name = file.name || "arquivo";
      bytes = new Uint8Array(await file.arrayBuffer());
    }
    const transfer = await transferOf(name, bytes);
    const total =
      transfer.properties.length +
      transfer.acts.length +
      transfer.people.length;
    if (total === 0) {
      return {
        status: "error",
        message:
          transfer.errors[0]?.message ??
          "Não achei nenhuma linha para importar neste arquivo.",
      };
    }
    if (text(formData, "intent") !== "import") {
      const preview = await previewTransferWith(db, ok.tenant.slug, transfer);
      return { status: "preview", fileName: name, ...preview };
    }
    const result = await applyTransferWith(
      db,
      ok.tenant.slug,
      transfer,
      { complete: text(formData, "completar") === "1" },
      ok.actor,
    );
    revalidatePath("/admin/ri", "layout");
    return { status: "done", ...result };
  } catch (error) {
    const state = failure(error, "ri.transfer");
    return {
      status: "error",
      message: state.status === "error" ? state.message : "",
    };
  }
}

// ------------------------------------------------------------- ONR files

export async function generateExportAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const ok = await access("ri.export");
  if (!ok) return denied("ri.export");
  const kind = text(formData, "kind");
  if (
    kind !== "cnm" &&
    kind !== "indicador-real" &&
    kind !== "indicador-pessoal"
  ) {
    return { status: "error", message: "Escolha o arquivo." };
  }
  const mode =
    text(formData, "mode") === "atualizacao" ? "atualizacao" : "completa";
  try {
    const out = await generateExportWith(
      db,
      {
        slug: ok.tenant.slug,
        cns: ok.tenant.cns,
        state: ok.tenant.location.state,
      },
      kind,
      mode,
      ok.actor,
    );
    revalidatePath("/admin/ri", "layout");
    return {
      status: "success",
      message: `Arquivo gerado com ${out.count} linha(s)${out.skipped.length ? `; ${out.skipped.length} ficaram de fora (veja abaixo)` : ""}.`,
    };
  } catch (error) {
    return failure(error, "ri.export");
  }
}

export async function markExportImportedAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const ok = await access("ri.export");
  if (!ok) return denied("ri.export");
  const imported = text(formData, "op") !== "undo";
  try {
    await markExportImportedWith(
      db,
      ok.tenant.slug,
      text(formData, "id"),
      imported,
      ok.actor,
    );
  } catch (error) {
    return failure(error, "ri.export.imported");
  }
  revalidatePath("/admin/ri", "layout");
  return {
    status: "success",
    message: imported
      ? "Marcado como importado na ONR."
      : "Desmarcado: o arquivo volta a contar como não importado.",
  };
}

export async function withdrawExportAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access("ri.export");
  if (!ok) return denied("ri.export");
  try {
    await withdrawExportWith(
      db,
      ok.tenant.slug,
      text(formData, "id"),
      ok.actor,
    );
  } catch (error) {
    return failure(error, "ri.export.delete");
  }
  revalidatePath("/admin/ri", "layout");
  return { status: "success", message: "Arquivo retirado da lista." };
}

// -------------------------------------------------------------- settings

export async function saveRiSettingsAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const ok = await access("ri.edit");
  if (!ok) return denied("ri.edit");
  try {
    await saveRiSettingsWith(
      db,
      ok.tenant.slug,
      text(formData, "ibgeCity"),
      ok.actor,
    );
  } catch (error) {
    return failure(error, "ri.settings");
  }
  revalidatePath("/admin/ri", "layout");
  return { status: "success", message: "Configurações salvas." };
}

// ------------------------------------------------------------ anexos

/** A file the browser sent straight to the store: only this office's folder. */
function ownUpload(url: string, tenantSlug: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname.endsWith(".blob.vercel-storage.com") &&
      parsed.pathname.startsWith(`/${riFolder(tenantSlug)}`)
    );
  } catch {
    return false;
  }
}

const KINDS = ["ficha", "titulo", "documento"] as const;

/**
 * Attaches a file (and, when asked, reads it and opens the conferência).
 * With "só o texto" (`md`), the file is read, kept as Markdown in the
 * database and the original is discarded, so it takes no room in the
 * store (decision of 26/11/2026). `livro=3` tells the reading it is a
 * registro of the Livro 3.
 */
export async function uploadFileAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const ok = await access("ri.edit");
  if (!ok) return denied("ri.edit");
  const propertyId = text(formData, "propertyId") || null;
  const kindRaw = text(formData, "kind");
  const kind = KINDS.find((k) => k === kindRaw) ?? "documento";
  const keepText = text(formData, "md") === "1";
  const read =
    keepText ||
    text(formData, "ler") === "1" ||
    text(formData, "lerAgora") === "1";
  const book = text(formData, "livro") === "3" ? 3 : undefined;
  let fileId: string;
  try {
    let bytes: Uint8Array;
    let name: string;
    let mime: string;
    const url = text(formData, "url");
    if (url) {
      if (!ownUpload(url, ok.tenant.slug)) {
        return { status: "error", message: "Arquivo não reconhecido." };
      }
      name = text(formData, "nome") || "arquivo";
      mime = text(formData, "tipo") || "application/octet-stream";
      bytes = read
        ? new Uint8Array(await readStoredFile(url))
        : new Uint8Array();
    } else {
      const file = formData.get("arquivo");
      if (!(file instanceof File) || file.size === 0) {
        return { status: "error", message: "Escolha o arquivo." };
      }
      if (file.size > RI_FILE_MAX_BYTES) {
        return { status: "error", message: "O arquivo passa de 40 MB." };
      }
      bytes = new Uint8Array(await file.arrayBuffer());
      name = file.name || "arquivo";
      mime = file.type || "application/octet-stream";
    }
    if (keepText) {
      const result = await readMatriculaFilesWith(
        db,
        ok.tenant.slug,
        [{ name, mime, bytes }],
        { book },
      );
      const markdown = result.markdown?.trim() ?? "";
      if (!markdown) {
        return {
          status: "error",
          message:
            'Não deu para tirar o texto deste arquivo. Anexe sem marcar "só o texto" para guardar o original.',
        };
      }
      fileId = await addFileWith(
        db,
        ok.tenant.slug,
        {
          propertyId,
          kind,
          name: `${name.replace(/\.[^.]+$/, "")}.md`,
          mime: "text/markdown",
          size: new TextEncoder().encode(markdown).byteLength,
          path: "",
        },
        ok.actor,
      );
      await saveReadingWith(db, ok.tenant.slug, fileId, result);
      // The original goes: only the text stays.
      if (url) await deleteStoredFile(url);
      await recordAuditWith(db, {
        tenantSlug: ok.tenant.slug,
        actorId: ok.actor.id,
        action: "ri.file-markdown",
        targetType: "ri-property",
        targetId: propertyId,
      });
    } else {
      const path = url
        ? url
        : await storeRegistryFile(
            ok.tenant.slug,
            Buffer.from(bytes),
            name,
            mime,
          );
      const size = url
        ? Number(text(formData, "tamanho")) || 0
        : bytes.byteLength;
      fileId = await addFileWith(
        db,
        ok.tenant.slug,
        { propertyId, kind, name, mime, size, path },
        ok.actor,
      );
      if (read) {
        const { markdown: _md, ...result } = await readMatriculaFilesWith(
          db,
          ok.tenant.slug,
          [{ name, mime, bytes }],
          { book },
        );
        await saveReadingWith(db, ok.tenant.slug, fileId, result);
      }
    }
  } catch (error) {
    return failure(error, "ri.file.upload");
  }
  revalidatePath("/admin/ri", "layout");
  if (read) redirect(`/admin/ri/leitura/${fileId}`);
  return { status: "success", message: "Documento anexado." };
}

export async function setFileDeletedAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access("ri.edit");
  if (!ok) return denied("ri.edit");
  const deleted = text(formData, "op") !== "restore";
  try {
    await setFileDeletedWith(
      db,
      ok.tenant.slug,
      text(formData, "id"),
      deleted,
      ok.actor,
    );
  } catch (error) {
    return failure(error, "ri.file.delete");
  }
  revalidatePath("/admin/ri", "layout");
  return {
    status: "success",
    message: deleted
      ? "Documento apagado da lista. O arquivo fica guardado."
      : "Documento restaurado.",
  };
}

/** Reads (again) a file already attached, and opens the conferência. */
export async function readFileAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const ok = await access("ri.edit");
  if (!ok) return denied("ri.edit");
  const id = text(formData, "id");
  try {
    const file = await fileWith(db, ok.tenant.slug, id);
    if (!file || file.deletedAt) {
      return { status: "error", message: "Arquivo não encontrado." };
    }
    const previous = file.reading as ReadingResult | null;
    // A file kept only as Markdown is read again from its text.
    const bytes = file.path
      ? new Uint8Array(await readStoredFile(file.path))
      : new TextEncoder().encode(previous?.markdown ?? "");
    const property = file.propertyId
      ? await propertyDetailWith(db, ok.tenant.slug, file.propertyId)
      : null;
    const result = await readMatriculaFilesWith(
      db,
      ok.tenant.slug,
      [{ name: file.name, mime: file.path ? file.mime : "text/plain", bytes }],
      { book: property?.property.book === 3 ? 3 : undefined },
    );
    if (file.path) delete result.markdown;
    else result.markdown = previous?.markdown;
    await saveReadingWith(db, ok.tenant.slug, id, result);
  } catch (error) {
    return failure(error, "ri.file.read");
  }
  redirect(`/admin/ri/leitura/${id}`);
}

/** Saves what the clerk confirmed from a reading. */
export async function applyReadingAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const ok = await access("ri.edit");
  if (!ok) return denied("ri.edit");
  const fileId = text(formData, "fileId");
  let target: string;
  try {
    const file = await fileWith(db, ok.tenant.slug, fileId);
    const stored = file?.reading as ReadingResult | null | undefined;
    if (!file || !stored?.reading) {
      return { status: "error", message: "Leia o arquivo antes de aplicar." };
    }
    const reading = { ...stored.reading };
    const typed = matriculaNumber(text(formData, "number"));
    if (typed) reading.number = typed;
    if (text(formData, "book") === "3") reading.book = 3;
    const seqs = formData.getAll("seqs").map((s) => Number(s));
    const result = await applyReadingWith(
      db,
      ok.tenant.slug,
      reading,
      { propertyId: file.propertyId, seqs },
      ok.actor,
    );
    if (!file.propertyId) {
      await linkFileWith(db, ok.tenant.slug, fileId, result.propertyId);
    }
    target = result.propertyId;
  } catch (error) {
    return failure(error, "ri.reading.apply");
  }
  revalidatePath("/admin/ri", "layout");
  redirect(`/admin/ri/matriculas/${target}`);
}

// ----------------------------------------------- quem assina e assinatura

export async function saveSignerAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const ok = await access("ri.edit");
  if (!ok) return denied("ri.edit");
  try {
    await saveSignerWith(
      db,
      ok.tenant.slug,
      Number(text(formData, "signer")),
      ok.actor,
    );
  } catch (error) {
    return failure(error, "ri.signer");
  }
  revalidatePath("/admin/ri", "layout");
  return { status: "success", message: "Quem assina foi salvo." };
}

/**
 * The image of the handwritten signature: only who manages the office's
 * certificates (the Tabelião/Registrador, unless he granted it).
 */
export async function saveSignatureImageAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const ok = await access("certificates.manage");
  if (!ok) {
    return {
      status: "error",
      message:
        "Só quem cuida dos certificados digitais da serventia cadastra a imagem da assinatura.",
    };
  }
  try {
    if (text(formData, "op") === "remove") {
      await saveSignatureImageWith(db, ok.tenant.slug, null, ok.actor);
    } else {
      const file = formData.get("imagem");
      if (!(file instanceof File) || file.size === 0) {
        return { status: "error", message: "Escolha a foto da assinatura." };
      }
      await saveSignatureImageWith(
        db,
        ok.tenant.slug,
        new Uint8Array(await file.arrayBuffer()),
        ok.actor,
      );
    }
  } catch (error) {
    return failure(error, "ri.signature");
  }
  revalidatePath("/admin/ri", "layout");
  return {
    status: "success",
    message:
      text(formData, "op") === "remove"
        ? "Imagem retirada."
        : "Imagem da assinatura salva.",
  };
}

// ------------------------------------------------- protocolo (Livro 1)

const protocolPath = (id: string) => `/admin/ri/protocolo/${id}`;

function rawOf(formData: FormData): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") raw[key] = value;
  }
  return raw;
}

export async function saveProtocolAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const ok = await access("ri.edit");
  if (!ok) return denied("ri.edit");
  const id = text(formData, "id");
  let target = id;
  let warning = "";
  try {
    const input = readProtocolInput(rawOf(formData));
    const holidays = officeHolidays(ok.tenant);
    if (id) {
      const { changed, missing } = await updateProtocolWith(
        db,
        ok.tenant.slug,
        id,
        input,
        holidays,
        ok.actor,
      );
      if (missing.length) {
        warning = ` Não achei no Livro 2: ${missing.join(", ")}.`;
      }
      if (changed === 0 && !warning) {
        return { status: "success", message: "Nada mudou no protocolo." };
      }
    } else {
      const created = await createProtocolWith(
        db,
        ok.tenant.slug,
        input,
        holidays,
        ok.actor,
      );
      target = created.id;
    }
  } catch (error) {
    return failure(error, "ri.protocol.save");
  }
  revalidatePath("/admin/ri", "layout");
  if (!id) redirect(protocolPath(target));
  return { status: "success", message: `Protocolo salvo.${warning}` };
}

export async function issueRequirementsAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const ok = await access("ri.edit");
  if (!ok) return denied("ri.edit");
  const id = text(formData, "id");
  try {
    await issueRequirementsWith(
      db,
      ok.tenant.slug,
      id,
      readRequirements(text(formData, "exigencias")),
      ok.actor,
    );
  } catch (error) {
    return failure(error, "ri.protocol.requirements");
  }
  revalidatePath(protocolPath(id));
  return {
    status: "success",
    message:
      "Nota devolutiva pronta. Imprima ou assine e entregue ao apresentante.",
  };
}

export async function reentryAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const ok = await access("ri.edit");
  if (!ok) return denied("ri.edit");
  const id = text(formData, "id");
  try {
    await reentryWith(
      db,
      ok.tenant.slug,
      id,
      text(formData, "data"),
      officeHolidays(ok.tenant),
      ok.actor,
    );
  } catch (error) {
    return failure(error, "ri.protocol.reentry");
  }
  revalidatePath("/admin/ri", "layout");
  return {
    status: "success",
    message: "Reingresso lançado: o registro vence em 5 dias úteis.",
  };
}

export async function protocolStatusAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access("ri.edit");
  if (!ok) return denied("ri.edit");
  const id = text(formData, "id");
  try {
    await setProtocolStatusWith(
      db,
      ok.tenant.slug,
      id,
      text(formData, "status"),
      text(formData, "justificativa"),
      ok.actor,
    );
  } catch (error) {
    return failure(error, "ri.protocol.status");
  }
  revalidatePath("/admin/ri", "layout");
  return { status: "success", message: "Situação do protocolo alterada." };
}

export async function registerProtocolAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const ok = await access("ri.edit");
  if (!ok) return denied("ri.edit");
  const id = text(formData, "id");
  try {
    await registerProtocolWith(db, ok.tenant.slug, id, ok.actor);
  } catch (error) {
    return failure(error, "ri.protocol.register");
  }
  revalidatePath("/admin/ri", "layout");
  return { status: "success", message: "Protocolo concluído: registrado." };
}

export async function setProtocolVoidedAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access("ri.edit");
  if (!ok) return denied("ri.edit");
  const id = text(formData, "id");
  const voided = text(formData, "op") !== "restore";
  try {
    await setProtocolVoidedWith(
      db,
      ok.tenant.slug,
      id,
      voided,
      text(formData, "justificativa"),
      ok.actor,
    );
  } catch (error) {
    return failure(error, "ri.protocol.void");
  }
  revalidatePath("/admin/ri", "layout");
  return {
    status: "success",
    message: voided
      ? "Protocolo apagado (fica marcado no Livro 1)."
      : "Protocolo restaurado.",
  };
}

// ------------------------------------------------- anotações (Livro 3)

export async function saveAnnotationAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const ok = await access("ri.edit");
  if (!ok) return denied("ri.edit");
  const propertyId = text(formData, "propertyId");
  const noteId = text(formData, "noteId");
  const note = { on: text(formData, "on"), text: text(formData, "texto") };
  try {
    if (noteId) {
      const changed = await editAnnotationWith(
        db,
        ok.tenant.slug,
        propertyId,
        noteId,
        note,
        ok.actor,
      );
      if (!changed) return { status: "success", message: "Nada mudou." };
    } else {
      await addAnnotationWith(db, ok.tenant.slug, propertyId, note, ok.actor);
    }
  } catch (error) {
    return failure(error, "ri.annotation.save");
  }
  revalidatePath(propertyPath(propertyId));
  return {
    status: "success",
    message: noteId ? "Anotação alterada." : "Anotação lançada.",
  };
}

export async function setAnnotationDeletedAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access("ri.edit");
  if (!ok) return denied("ri.edit");
  const propertyId = text(formData, "propertyId");
  const deleted = text(formData, "op") !== "restore";
  try {
    await setAnnotationDeletedWith(
      db,
      ok.tenant.slug,
      propertyId,
      text(formData, "noteId"),
      deleted,
      ok.actor,
    );
  } catch (error) {
    return failure(error, "ri.annotation.delete");
  }
  revalidatePath(propertyPath(propertyId));
  return {
    status: "success",
    message: deleted
      ? "Anotação apagada (fica no histórico)."
      : "Anotação restaurada.",
  };
}

// ------------------------------------------- georreferenciamento e mapa

export async function addGeometryAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const ok = await access("ri.edit");
  if (!ok) return denied("ri.edit");
  const propertyId = text(formData, "propertyId");
  try {
    const file = formData.get("arquivo");
    const reading = await readGeometrySource({
      text: text(formData, "memorial"),
      file:
        file instanceof File && file.size > 0
          ? { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }
          : null,
    });
    if (reading.vertices.length < 3) {
      return {
        status: "error",
        message:
          reading.notes[0] ??
          "Não achei pelo menos 3 vértices com coordenadas.",
      };
    }
    await addGeometryWith(
      db,
      ok.tenant.slug,
      propertyId,
      {
        vertices: reading.vertices,
        source: reading.source,
        sourceText: reading.sourceText,
        actId: text(formData, "actId") || null,
        sigefCode: text(formData, "sigef"),
        notes: reading.notes.join(" "),
      },
      ok.actor,
    );
  } catch (error) {
    return failure(error, "ri.geometry.add");
  }
  revalidatePath("/admin/ri", "layout");
  return {
    status: "success",
    message: "Perímetro lançado: confira a planta, a área e as sobreposições.",
  };
}

export async function setGeometryDeletedAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access("ri.edit");
  if (!ok) return denied("ri.edit");
  const deleted = text(formData, "op") !== "restore";
  try {
    await setGeometryDeletedWith(
      db,
      ok.tenant.slug,
      text(formData, "id"),
      deleted,
      ok.actor,
    );
  } catch (error) {
    return failure(error, "ri.geometry.delete");
  }
  revalidatePath("/admin/ri", "layout");
  return {
    status: "success",
    message: deleted
      ? "Perímetro apagado (fica guardado)."
      : "Perímetro restaurado.",
  };
}
