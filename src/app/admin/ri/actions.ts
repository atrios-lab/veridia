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
import { readSheet } from "@/core/ri/sheet.ts";
import { db } from "@/db/index.ts";
import { justify } from "@/lib/audit-reason.ts";
import {
  type ActPartyInput,
  createActWith,
  createPersonWith,
  createPropertyWith,
  generateExportWith,
  importSheetWith,
  markExportImportedWith,
  RiError,
  readActInput,
  saveRiSettingsWith,
  setActDeletedWith,
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
import { SheetFileError, sheetRows } from "@/lib/ri-sheet.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { readStoredFile, storeRegistryFile } from "@/lib/uploads.ts";

export type RiState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const NO_PERMISSION: Partial<Record<Permission, string>> = {
  "ri.edit":
    "Você não tem permissão para alterar o acervo do Registro de Imóveis.",
  "ri.import": "Você não tem permissão para importar a planilha do índice.",
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

// -------------------------------------------------------------- planilha

export type ImportState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "preview";
      fileName: string;
      columns: { header: string; field: string }[];
      rows: {
        line: number;
        number: number;
        situation: number;
        owners: string;
        place: string;
        warnings: string[];
      }[];
      total: number;
      errors: { line: number; message: string }[];
    }
  | {
      status: "done";
      created: number;
      skipped: { line: number; reason: string }[];
    };

/**
 * One form, two steps: "Conferir" reads the sheet and shows what would
 * come in; "Importar" sends the same file again and saves.
 */
export async function importSheetAction(
  _previous: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const ok = await access("ri.import");
  if (!ok) {
    return { status: "error", message: NO_PERMISSION["ri.import"] ?? "" };
  }
  const file = formData.get("planilha");
  if (!(file instanceof File)) {
    return { status: "error", message: "Escolha a planilha do índice." };
  }
  try {
    const reading = readSheet(await sheetRows(file));
    if (reading.rows.length === 0) {
      return {
        status: "error",
        message:
          reading.errors[0]?.message ??
          "Nenhuma linha com número de matrícula na planilha.",
      };
    }
    if (text(formData, "intent") !== "import") {
      return {
        status: "preview",
        fileName: file.name,
        columns: reading.columns,
        rows: reading.rows.slice(0, 200).map((row) => ({
          line: row.line,
          number: row.input.number,
          situation: row.input.status,
          owners: row.owners.map((o) => o.name).join("; "),
          place: row.input.rural.denominacao || row.input.street,
          warnings: row.warnings,
        })),
        total: reading.rows.length,
        errors: reading.errors.slice(0, 100),
      };
    }
    const result = await importSheetWith(
      db,
      ok.tenant.slug,
      reading.rows,
      ok.actor,
    );
    revalidatePath("/admin/ri", "layout");
    return { status: "done", ...result };
  } catch (error) {
    const state = failure(error, "ri.import");
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
 * In the deploy the browser already sent it to the store and this gets its
 * address; in development the form carries the file.
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
  const read =
    text(formData, "ler") === "1" || text(formData, "lerAgora") === "1";
  let fileId: string;
  try {
    let bytes: Uint8Array;
    let path: string;
    let name: string;
    let mime: string;
    const url = text(formData, "url");
    if (url) {
      if (!ownUpload(url, ok.tenant.slug)) {
        return { status: "error", message: "Arquivo não reconhecido." };
      }
      path = url;
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
      path = await storeRegistryFile(
        ok.tenant.slug,
        Buffer.from(bytes),
        name,
        mime,
      );
    }
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
      const result = await readMatriculaFilesWith(db, ok.tenant.slug, [
        { name, mime, bytes },
      ]);
      await saveReadingWith(db, ok.tenant.slug, fileId, result);
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
    const bytes = new Uint8Array(await readStoredFile(file.path));
    const result = await readMatriculaFilesWith(db, ok.tenant.slug, [
      { name: file.name, mime: file.mime, bytes },
    ]);
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
