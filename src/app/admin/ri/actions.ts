"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { can, type Permission } from "@/core/auth/roles.ts";
import {
  decidesDeletions,
  type OfficialKind,
} from "@/core/deletion/official.ts";
import type { PartyRole } from "@/core/ri/acts.ts";
import {
  readForeignImport,
  readProtocolImport,
} from "@/core/ri/book-import.ts";
import {
  ForeignError,
  foreignWarnings,
  readForeignInput,
} from "@/core/ri/foreign.ts";
import {
  isoDate,
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
import { askApproval } from "@/lib/approval.ts";
import { recordAuditWith } from "@/lib/audit.ts";
import { justify } from "@/lib/audit-reason.ts";
import { requestDeletionWith } from "@/lib/deletion-requests.ts";
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
  setActSealImageWith,
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
  closeBookWith,
  fichaLegalPdfWith,
  openBookWith,
  openIndexBooksWith,
  readBookInput,
  reopenBookWith,
  setBookDeletedWith,
  updateBookWith,
} from "@/lib/ri-books.ts";
import {
  addFileWith,
  applyReadingWith,
  copySignatureToRubricWith,
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
  signatureSettingsWith,
} from "@/lib/ri-files.ts";
import {
  addForeignAverbacaoWith,
  createForeignWith,
  importForeignWith,
  recordForeignReportWith,
  setForeignDeletedWith,
  setForeignReportDeletedWith,
  updateForeignWith,
} from "@/lib/ri-foreign.ts";
import {
  addGeometryWith,
  readGeometrySource,
  setGeometryDeletedWith,
} from "@/lib/ri-geo.ts";
import { forgetLearnedActWith, learnActWith } from "@/lib/ri-learning.ts";
import {
  applyOnrReadingWith,
  hideOnrImageFromListWith,
  prepareOnrImageWith,
  setCopiedWith,
  setOnrImageDeletedWith,
} from "@/lib/ri-onr-images.ts";
import { markPendencyWith } from "@/lib/ri-pendencies.ts";
import { importPgvReturnWith, savePgvCredentialWith } from "@/lib/ri-pgv.ts";
import {
  closeDaysWith,
  closePhysicalDaysWith,
  reopenDayWith,
} from "@/lib/ri-protocol-days.ts";
import {
  createProtocolWith,
  fulfillRequirementWith,
  importProtocolsWith,
  issueRequirementsWith,
  officeToday,
  readProtocolInput,
  readRequirements,
  reentryWith,
  registerProtocolWith,
  setProtocolStatusWith,
  setProtocolVoidedWith,
  updateProtocolWith,
} from "@/lib/ri-protocols.ts";
import { SheetFileError, sheetRows, transferFile } from "@/lib/ri-sheet.ts";
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
  "ri.books":
    "Você não tem permissão para abrir, alterar ou encerrar os livros do Registro de Imóveis.",
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

/**
 * An official document is deleted only by the Tabelião: anyone else sends
 * the request, with the reason, for the holder to decide (decision of
 * 26/11/2026). Returns the state to answer with, or null to go on.
 */
async function askTabeliao(
  ok: NonNullable<Awaited<ReturnType<typeof access>>>,
  kind: OfficialKind,
  targetId: string,
  label: string,
  formData: FormData,
): Promise<RiState | null> {
  if (decidesDeletions(ok.session.user.role ?? "", ok.session.user.permissions))
    return null;
  try {
    await requestDeletionWith(
      db,
      ok.tenant.slug,
      {
        kind,
        targetId,
        label,
        reason: String(formData.get("justificativa") ?? ""),
      },
      ok.actor,
    );
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Não deu para pedir.",
    };
  }
  revalidatePath("/admin", "layout");
  return {
    status: "success",
    message:
      "Pedido de exclusão enviado ao Tabelião, com o seu motivo. O documento só sai depois que ele aprovar.",
  };
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
  if (deleted) {
    const asked = await askTabeliao(
      ok,
      "ri-property",
      id,
      `Matrícula ${text(formData, "label") || id}`,
      formData,
    );
    if (asked) return asked;
  }
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

export async function importPgvReturnAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const ok = await access("ri.edit");
  if (!ok) return denied("ri.edit");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return {
      status: "error",
      message: "Escolha o arquivo baixado do PGV-CNM.",
    };
  }
  if (file.size > 20 * 1024 * 1024) {
    return { status: "error", message: "O arquivo passa de 20 MB." };
  }
  try {
    const out = await importPgvReturnWith(
      db,
      { slug: ok.tenant.slug, cns: ok.tenant.cns },
      await file.text(),
      ok.actor,
    );
    revalidatePath("/admin/ri", "layout");
    const parts = [
      `${out.found} CNM lido(s) no arquivo`,
      `${out.marked} matrícula(s) marcada(s) como já no PGV`,
    ];
    if (out.filled) parts.push(`${out.filled} receberam o CNM do PGV`);
    if (out.already) parts.push(`${out.already} já estavam marcadas`);
    if (out.differ.length) {
      parts.push(
        `${out.differ.length} com CNM diferente do PGV (corrija na matrícula: ${out.differ
          .slice(0, 5)
          .map((d) => `nº ${d.number}`)
          .join(", ")})`,
      );
    }
    if (out.missing.length) {
      parts.push(`${out.missing.length} não estão no acervo daqui`);
    }
    return { status: "success", message: `${parts.join("; ")}.` };
  } catch (error) {
    return failure(error, "ri.pgv-import");
  }
}

export async function savePgvCredentialAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const ok = await access("ri.export");
  if (!ok) return denied("ri.export");
  const clear = text(formData, "op") === "clear";
  if (clear) {
    const why = justify(formData);
    if (why) return { status: "error", message: why };
  }
  try {
    await savePgvCredentialWith(
      db,
      ok.tenant.slug,
      {
        clientId: text(formData, "clientId"),
        hash: String(formData.get("hash") ?? ""),
        clear,
      },
      ok.actor,
    );
    revalidatePath("/admin/ri/cnm");
    return {
      status: "success",
      message: clear
        ? "Credencial apagada. A auditoria guarda quem apagou."
        : "Credencial salva. O Hash fica guardado cifrado e não aparece mais na tela.",
    };
  } catch (error) {
    return failure(error, "ri.pgv-credential");
  }
}

export async function forgetLearnedActAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const asked = await askApproval(
    "ri.learned",
    formData,
    "Modelo aprendido de ato (RI)",
  );
  if (asked) return asked;
  const ok = await access("ri.edit");
  if (!ok) return denied("ri.edit");
  try {
    await forgetLearnedActWith(
      db,
      ok.tenant.slug,
      text(formData, "id"),
      String(formData.get("justificativa") ?? ""),
      ok.actor,
    );
  } catch (error) {
    return failure(error, "ri.learned-act.forget");
  }
  revalidatePath("/admin/ri/configuracoes");
  return {
    status: "success",
    message: "Esquecido. Fica guardado e na auditoria.",
  };
}

export async function fulfillRequirementAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const ok = await access("ri.edit");
  if (!ok) return denied("ri.edit");
  const undo = text(formData, "op") === "undo";
  const id = text(formData, "id");
  try {
    await fulfillRequirementWith(
      db,
      ok.tenant.slug,
      id,
      Number(text(formData, "index")),
      String(formData.get("justificativa") ?? formData.get("note") ?? ""),
      undo,
      ok.actor,
    );
  } catch (error) {
    return failure(error, "ri.requirement.fulfill");
  }
  revalidatePath(`/admin/ri/protocolo/${id}`);
  return {
    status: "success",
    message: undo
      ? "A exigência voltou a ficar pendente."
      : "Exigência marcada como cumprida. Pode continuar.",
  };
}

export async function markPendencyAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const ok = await access("ri.edit");
  if (!ok) return denied("ri.edit");
  const undo = text(formData, "op") === "undo";
  try {
    await markPendencyWith(
      db,
      ok.tenant.slug,
      text(formData, "key"),
      String(formData.get("justificativa") ?? ""),
      undo,
      ok.actor,
    );
  } catch (error) {
    return failure(error, "ri.pendency.mark");
  }
  revalidatePath("/admin/ri", "layout");
  return {
    status: "success",
    message: undo
      ? "A pendência voltou para a lista."
      : "Pendência concluída. Ela sai da lista e fica no histórico.",
  };
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
    let savedId = actId;
    if (actId) {
      await updateActWith(db, ok.tenant.slug, actId, input, ok.actor);
    } else {
      savedId = (
        await createActWith(db, ok.tenant.slug, propertyId, input, ok.actor)
      ).id;
    }
    // The office teaches the system with every ato it saves or corrects.
    await learnActWith(
      db,
      ok.tenant.slug,
      { nature: input.nature, kind: input.kind, effect: input.effect },
      ok.actor,
    );
    const file = formData.get("sealImage");
    if (file instanceof File && file.size > 0) {
      if (file.size > 3 * 1024 * 1024) {
        return { status: "error", message: "A imagem do selo passa de 3 MB." };
      }
      const png = await sharp(Buffer.from(await file.arrayBuffer()))
        .resize({ width: 420, withoutEnlargement: true })
        .png()
        .toBuffer();
      await setActSealImageWith(
        db,
        ok.tenant.slug,
        savedId,
        png.toString("base64"),
        ok.actor,
      );
    } else if (text(formData, "removeSealImage") === "1") {
      await setActSealImageWith(db, ok.tenant.slug, savedId, "", ok.actor);
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
  if (deleted) {
    const asked = await askTabeliao(
      ok,
      "ri-act",
      text(formData, "actId"),
      `Ato ${text(formData, "label") || text(formData, "actId")}`,
      formData,
    );
    if (asked) return asked;
  }
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
  const asked = await askApproval(
    "ri.person",
    formData,
    "Pessoa do Indicador Pessoal (RI)",
  );
  if (asked) return asked;
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
  const asked = await askApproval(
    "ri.export",
    formData,
    "Carga gerada para a ONR (RI)",
  );
  if (asked) return asked;
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
  const asked = await askApproval(
    "ri.file",
    formData,
    "Anexo da matrícula (RI)",
  );
  if (asked) return asked;
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
  const rubric = text(formData, "tipo") === "rubrica";
  try {
    if (rubric && text(formData, "op") === "copy") {
      await copySignatureToRubricWith(db, ok.tenant.slug, ok.actor);
      revalidatePath("/admin/ri", "layout");
      return {
        status: "success",
        message: "A rubrica agora é a mesma imagem da assinatura.",
      };
    }
    if (text(formData, "op") === "remove") {
      await saveSignatureImageWith(
        db,
        ok.tenant.slug,
        null,
        ok.actor,
        rubric ? "rubrica" : "assinatura",
      );
    } else {
      const file = formData.get("imagem");
      if (!(file instanceof File) || file.size === 0) {
        return {
          status: "error",
          message: rubric
            ? "Escolha a foto da rubrica."
            : "Escolha a foto da assinatura.",
        };
      }
      await saveSignatureImageWith(
        db,
        ok.tenant.slug,
        new Uint8Array(await file.arrayBuffer()),
        ok.actor,
        rubric ? "rubrica" : "assinatura",
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
        : rubric
          ? "Imagem da rubrica salva."
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
  if (voided) {
    const asked = await askTabeliao(
      ok,
      "ri-protocol",
      id,
      `Protocolo ${text(formData, "label") || id}`,
      formData,
    );
    if (asked) return asked;
  }
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
  const asked = await askApproval(
    "ri.annotation",
    formData,
    "Anotação da matrícula (RI)",
  );
  if (asked) return asked;
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
  const asked = await askApproval(
    "ri.geometry",
    formData,
    "Georreferenciamento do imóvel (RI)",
  );
  if (asked) return asked;
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

/* ------------------------------------------------------------- the books */

const bookPath = (id: string) => `/admin/ri/livros/${id}`;

/** Opens a volume, or changes its data (the old values go to the history). */
export async function saveBookAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const ok = await access("ri.books");
  if (!ok) return denied("ri.books");
  const id = text(formData, "id");
  let target = id;
  try {
    const input = readBookInput(rawOf(formData));
    if (id) {
      await updateBookWith(db, ok.tenant.slug, id, input, ok.actor);
    } else {
      target = await openBookWith(db, ok.tenant.slug, input, ok.actor);
    }
  } catch (error) {
    return failure(error, "ri.book.save");
  }
  revalidatePath("/admin/ri", "layout");
  if (!id) redirect(bookPath(target));
  return {
    status: "success",
    message: "Livro alterado. Os dados anteriores ficaram no histórico.",
  };
}

/**
 * Optional (decision of 27/11/2026): opens the Livros 4 and 5 that were
 * never opened, in meio eletrônico, on the day of the Livro 2 in use. An
 * office that already keeps them launches its own or imports instead.
 */
export async function openIndexBooksAction(
  _previous: RiState,
  _formData: FormData,
): Promise<RiState> {
  const ok = await access("ri.books");
  if (!ok) return denied("ri.books");
  let opened = 0;
  try {
    opened = await openIndexBooksWith(db, ok.tenant.slug, ok.actor);
  } catch (error) {
    return failure(error, "ri.book.save");
  }
  revalidatePath("/admin/ri", "layout");
  return opened
    ? {
        status: "success",
        message:
          "Livros 4 e 5 abertos na data do Livro 2, em meio eletrônico. O termo de abertura já pode ser assinado.",
      }
    : {
        status: "error",
        message:
          "Abra antes o Livro 2: os Livros 4 e 5 tomam a data dele. Se já estão abertos, nada muda.",
      };
}

/** Closes the volume: date, last folha, and the termo de encerramento. */
export async function closeBookAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const ok = await access("ri.books");
  if (!ok) return denied("ri.books");
  const toNumber = (key: string) => {
    const digits = text(formData, key).replace(/\D/g, "");
    return digits ? Number(digits) : null;
  };
  try {
    await closeBookWith(
      db,
      ok.tenant.slug,
      text(formData, "id"),
      {
        closedOn: text(formData, "closedOn"),
        lastSheet: toNumber("lastSheet"),
        lastItem: toNumber("lastItem"),
        notes: text(formData, "notes"),
      },
      ok.actor,
    );
  } catch (error) {
    return failure(error, "ri.book.close");
  }
  revalidatePath("/admin/ri", "layout");
  return {
    status: "success",
    message: "Livro encerrado: assine o termo de encerramento.",
  };
}

export async function reopenBookAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access("ri.books");
  if (!ok) return denied("ri.books");
  try {
    await reopenBookWith(db, ok.tenant.slug, text(formData, "id"), ok.actor);
  } catch (error) {
    return failure(error, "ri.book.reopen");
  }
  revalidatePath("/admin/ri", "layout");
  return {
    status: "success",
    message: "Encerramento desfeito. Ele ficou no histórico do livro.",
  };
}

export async function setBookDeletedAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access("ri.books");
  if (!ok) return denied("ri.books");
  const deleted = text(formData, "op") !== "restore";
  if (deleted) {
    const asked = await askTabeliao(
      ok,
      "ri-book",
      text(formData, "id"),
      `Livro ${text(formData, "label") || text(formData, "id")}`,
      formData,
    );
    if (asked) return asked;
  }
  try {
    await setBookDeletedWith(
      db,
      ok.tenant.slug,
      text(formData, "id"),
      deleted,
      ok.actor,
    );
  } catch (error) {
    return failure(error, "ri.book.delete");
  }
  revalidatePath("/admin/ri", "layout");
  return {
    status: "success",
    message: deleted ? "Livro apagado (fica guardado)." : "Livro restaurado.",
  };
}

/* --------------------------------------------- the images for the ONR */

export type OnrImageState =
  | { status: "idle" }
  | {
      status: "saved";
      id: string;
      number: number;
      issues: string[];
      changes: {
        kind: string;
        label: string;
        before?: string;
        after?: string;
      }[];
      read: boolean;
      book?: {
        date: string | null;
        fromTransport: boolean;
        volume: string;
        firstItem: number;
      };
    }
  | { status: "check"; number: number | null; issues: string[] }
  | { status: "error"; message: string };

/**
 * One matrícula (PDF or Word) into the TIFF of the manual. The client
 * sends one file per call, in order. With "check", nothing was saved: the
 * office looks at what was pointed out and sends again with "conferi".
 */
/**
 * "Exportar para a ONR" straight from the matrícula (decision of
 * 26/11/2026): the ficha the system keeps becomes the PDF, and the PDF the
 * signed TIFF of the manual, with no file to attach.
 */
export async function exportMatriculaToOnrAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const ok = await access("ri.export");
  if (!ok) return denied("ri.export");
  try {
    // The ficha in the model annexed to the Lei nº 6.015/1973.
    const ficha = await fichaLegalPdfWith(db, ok.tenant, text(formData, "id"));
    if (!ficha)
      return { status: "error", message: "Matrícula não encontrada." };
    const pdf = ficha.bytes;
    const settings = await signatureSettingsWith(db, ok.tenant.slug);
    const result = await prepareOnrImageWith(
      db,
      ok.tenant,
      {
        name: `matricula-${ficha.number}.pdf`,
        bytes: new Uint8Array(pdf),
        typed: ficha.number,
        pattern: "p12",
        sign: Boolean(settings.signatureImage),
        rubric: Boolean(settings.rubricImage),
        confirmed: true,
      },
      ok.actor,
    );
    if (!result.id) {
      return {
        status: "error",
        message: result.issues.join(" ") || "Não deu para gerar a imagem.",
      };
    }
    revalidatePath("/admin/ri", "layout");
    return {
      status: "success",
      message: `Imagem da matrícula nº ${ficha.number} gerada${settings.signatureImage ? " e assinada" : " (sem assinatura: cadastre a sua em RI › Configurações)"}. Baixe em Arquivos para a ONR › Imagens.`,
    };
  } catch (error) {
    return failure(error, "ri.onr-image.export");
  }
}

export async function prepareOnrImageAction(
  formData: FormData,
): Promise<OnrImageState> {
  const ok = await access("ri.export");
  if (!ok)
    return { status: "error", message: NO_PERMISSION["ri.export"] ?? "" };
  const file = formData.get("arquivo");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Escolha o arquivo da matrícula." };
  }
  const typedRaw = text(formData, "numero").replace(/\D/g, "");
  try {
    const result = await prepareOnrImageWith(
      db,
      ok.tenant,
      {
        name: file.name,
        bytes: new Uint8Array(await file.arrayBuffer()),
        typed: typedRaw ? Number(typedRaw) : null,
        pattern: text(formData, "padrao"),
        sign: text(formData, "assinar") === "1",
        rubric: text(formData, "rubricar") === "1",
        confirmed: text(formData, "conferi") === "1",
      },
      ok.actor,
    );
    if (result.id && result.number) {
      revalidatePath("/admin/ri/onr/imagens");
      return {
        status: "saved",
        id: result.id,
        number: result.number,
        issues: result.issues,
        changes: result.changes ?? [],
        read: result.changes !== undefined,
        ...(result.book ? { book: result.book } : {}),
      };
    }
    return { status: "check", number: result.number, issues: result.issues };
  } catch (error) {
    const state = failure(error, "ri.onr-image.prepare");
    return {
      status: "error",
      message: state.status === "error" ? state.message : "Erro.",
    };
  }
}

export async function setOnrCopiedAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const ok = await access("ri.export");
  if (!ok) return denied("ri.export");
  const ids = [
    ...formData.getAll("id").map(String),
    ...text(formData, "ids").split(","),
  ].filter(Boolean);
  const copied = text(formData, "op") !== "undo";
  try {
    const n = await setCopiedWith(db, ok.tenant.slug, ids, copied, ok.actor);
    revalidatePath("/admin/ri/onr/imagens");
    return {
      status: "success",
      message: copied
        ? `${n} ${n === 1 ? "imagem marcada" : "imagens marcadas"} como copiada para a pasta do CSL2.`
        : "Marca desfeita.",
    };
  } catch (error) {
    return failure(error, "ri.onr-image.copied");
  }
}

export async function setOnrImageDeletedAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access("ri.export");
  if (!ok) return denied("ri.export");
  const op = text(formData, "op");
  const deleted = op !== "restore";
  const reason = String(formData.get("justificativa") ?? "").trim();
  if (op !== "hide" && deleted) {
    const asked = await askTabeliao(
      ok,
      "ri-onr-image",
      text(formData, "id"),
      `Imagem da matrícula ${text(formData, "label") || ""}`.trim(),
      formData,
    );
    if (asked) return asked;
  }
  try {
    if (op === "hide") {
      await hideOnrImageFromListWith(
        db,
        ok.tenant.slug,
        text(formData, "id"),
        reason,
        ok.actor,
      );
    } else {
      await setOnrImageDeletedWith(
        db,
        ok.tenant.slug,
        text(formData, "id"),
        deleted,
        ok.actor,
        reason,
      );
    }
  } catch (error) {
    return failure(error, "ri.onr-image.delete");
  }
  revalidatePath("/admin/ri/onr/imagens");
  return {
    status: "success",
    message:
      op === "hide"
        ? "Tirada da lista. Continua guardada e na auditoria, com o motivo."
        : deleted
          ? "Imagem apagada (fica guardada, com o motivo)."
          : "Imagem restaurada.",
  };
}

/** What the signed ficha brought goes into the acervo (and the indicadores). */
export async function applyOnrReadingAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const ok = await access("ri.edit");
  if (!ok) return denied("ri.edit");
  try {
    const { added, retified } = await applyOnrReadingWith(
      db,
      ok.tenant.slug,
      text(formData, "id"),
      ok.actor,
    );
    revalidatePath("/admin/ri", "layout");
    return {
      status: "success",
      message: `Acervo atualizado: ${added} ${added === 1 ? "ato novo" : "atos novos"}${retified ? ` e ${retified} ${retified === 1 ? "retificação" : "retificações"}` : ""}. Os indicadores real e pessoal já contam com eles.`,
    };
  } catch (error) {
    return failure(error, "ri.onr-image.apply");
  }
}

/**
 * Opens the Livro 2 from the first signed ficha: the termo de abertura on
 * the date the office confirmed (the averbação de transporte), from that
 * matrícula on, in fichas (Lei nº 6.015/1973, arts. 4º, 6º and 173,
 * parágrafo único; CNN, art. 336). No redirect: the queue stays on screen.
 */
export async function openLivro2Action(formData: FormData): Promise<RiState> {
  const ok = await access("ri.books");
  if (!ok) return denied("ri.books");
  if (text(formData, "transporte") !== "1") {
    return {
      status: "error",
      message:
        "Confirme que esta é a data do 1º ato de transporte, ou abra o livro com outra data em Livros e assinatura.",
    };
  }
  try {
    const input = readBookInput({
      book: "2",
      volume: text(formData, "volume") || "2",
      form: "fichas",
      firstItem: text(formData, "firstItem"),
      openedOn: text(formData, "data"),
      openingNotes:
        "Livro aberto com a averbação de transporte das matrículas para o sistema de fichas, com a mesma numeração e remissão na matrícula de origem (Código Nacional de Normas, art. 336).",
    });
    await openBookWith(db, ok.tenant.slug, input, ok.actor);
  } catch (error) {
    return failure(error, "ri.book.open-from-ficha");
  }
  revalidatePath("/admin/ri", "layout");
  return {
    status: "success",
    message:
      "Livro 2 aberto. Assine o termo de abertura em Livros e assinatura.",
  };
}

/* ------------------------------------------- the daily closing (art. 184) */

/** Closes the open days of a span, each with its own date. */
export async function closeProtocolDaysAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const ok = await access("ri.books");
  if (!ok) return denied("ri.books");
  const from = isoDate(text(formData, "de")) ?? "";
  const to = isoDate(text(formData, "ate")) ?? from;
  if (!from) return { status: "error", message: "Informe o dia." };
  try {
    const n = await closeDaysWith(
      db,
      ok.tenant.slug,
      { from, to },
      officeHolidays(ok.tenant),
      ok.actor,
    );
    revalidatePath("/admin/ri", "layout");
    return {
      status: "success",
      message:
        n === 0
          ? "Esses dias já estavam encerrados."
          : `${n} ${n === 1 ? "dia encerrado" : "dias encerrados"}, cada um com a sua data.`,
    };
  } catch (error) {
    return failure(error, "ri.protocol-day.close");
  }
}

/**
 * Marks the days up to a date as kept in the physical book: the Protocolo
 * brought in by the import was closed on paper (decision of 27/11/2026).
 */
export async function closePhysicalDaysAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const ok = await access("ri.books");
  if (!ok) return denied("ri.books");
  const to = isoDate(text(formData, "ate"));
  if (!to) return { status: "error", message: "Informe a data (dd/mm/aaaa)." };
  try {
    const n = await closePhysicalDaysWith(db, ok.tenant.slug, to, ok.actor);
    revalidatePath("/admin/ri", "layout");
    return {
      status: "success",
      message:
        n === 0
          ? "Não havia dias abertos até essa data."
          : `${n.toLocaleString("pt-BR")} dias marcados como encerrados no livro físico. Eles não geram termo novo.`,
    };
  } catch (error) {
    return failure(error, "ri.protocol-day.physical");
  }
}

/** Reopens a closed day, with the reason. */
export async function reopenProtocolDayAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access("ri.books");
  if (!ok) return denied("ri.books");
  try {
    await reopenDayWith(
      db,
      ok.tenant.slug,
      text(formData, "dia"),
      text(formData, "justificativa"),
      ok.actor,
    );
  } catch (error) {
    return failure(error, "ri.protocol-day.reopen");
  }
  revalidatePath("/admin/ri", "layout");
  return {
    status: "success",
    message: "Dia reaberto: já aceita prenotação com a data dele.",
  };
}

// ── Livro de Cadastro de Aquisição de Imóvel Rural por Estrangeiro ─────

function foreignFailure(error: unknown, where: string): RiState {
  if (error instanceof ForeignError) {
    return { status: "error", message: error.message };
  }
  return failure(error, where);
}

/** Lança an assento, or changes it (the reason goes to the history). */
export async function saveForeignAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const ok = await access("ri.edit");
  if (!ok) return denied("ri.edit");
  const id = text(formData, "id");
  if (id) {
    const why = justify(formData);
    if (why) return { status: "error", message: why };
  }
  try {
    const input = readForeignInput(rawOf(formData), officeToday());
    if (id) {
      await updateForeignWith(
        db,
        ok.tenant.slug,
        id,
        input,
        text(formData, "justificativa"),
        ok.actor,
      );
    } else {
      await createForeignWith(db, ok.tenant.slug, input, ok.actor);
    }
    revalidatePath("/admin/ri/estrangeiros");
    const warnings = foreignWarnings(input);
    return {
      status: "success",
      message: `${id ? "Assento alterado; o anterior ficou no histórico." : "Assento lançado no livro."}${warnings.length ? ` Atenção: ${warnings.join(" ")}` : ""}`,
    };
  } catch (error) {
    return foreignFailure(error, "ri.foreign.save");
  }
}

export async function addForeignAverbacaoAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const ok = await access("ri.edit");
  if (!ok) return denied("ri.edit");
  try {
    await addForeignAverbacaoWith(
      db,
      ok.tenant.slug,
      text(formData, "id"),
      text(formData, "texto"),
      ok.actor,
    );
  } catch (error) {
    return foreignFailure(error, "ri.foreign.averbacao");
  }
  revalidatePath("/admin/ri/estrangeiros");
  return { status: "success", message: "Averbação lançada no assento." };
}

export async function setForeignDeletedAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access("ri.edit");
  if (!ok) return denied("ri.edit");
  const asked = await askApproval(
    "ri.foreign",
    formData,
    "Assento do livro de aquisição por estrangeiro",
  );
  if (asked) return asked;
  const deleted = text(formData, "op") !== "restore";
  try {
    await setForeignDeletedWith(
      db,
      ok.tenant.slug,
      text(formData, "id"),
      deleted,
      text(formData, "justificativa"),
      ok.actor,
    );
  } catch (error) {
    return foreignFailure(error, "ri.foreign.delete");
  }
  revalidatePath("/admin/ri/estrangeiros");
  return {
    status: "success",
    message: deleted
      ? "Assento apagado da lista. Ele continua guardado e pode ser restaurado."
      : "Assento restaurado.",
  };
}

/** Records the relação (or certidão negativa) of a trimestre as sent. */
export async function recordForeignReportAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const ok = await access("ri.edit");
  if (!ok) return denied("ri.edit");
  const sentOn = isoDate(text(formData, "sentOn")) ?? officeToday();
  try {
    await recordForeignReportWith(
      db,
      ok.tenant.slug,
      {
        year: Number(text(formData, "ano")),
        quarter: Number(text(formData, "trimestre")),
        kind: text(formData, "kind") === "negativa" ? "negativa" : "positiva",
        recipients: formData.getAll("recipients").map(String).slice(0, 5),
        sentOn,
        notes: text(formData, "notes").slice(0, 2000),
      },
      ok.actor,
    );
  } catch (error) {
    return foreignFailure(error, "ri.foreign.report");
  }
  revalidatePath("/admin/ri/estrangeiros");
  return { status: "success", message: "Envio do trimestre registrado." };
}

export async function deleteForeignReportAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access("ri.edit");
  if (!ok) return denied("ri.edit");
  const asked = await askApproval(
    "ri.foreign-report",
    formData,
    "Registro de envio da comunicação trimestral de estrangeiros",
  );
  if (asked) return asked;
  try {
    await setForeignReportDeletedWith(
      db,
      ok.tenant.slug,
      text(formData, "id"),
      text(formData, "justificativa"),
      ok.actor,
    );
  } catch (error) {
    return foreignFailure(error, "ri.foreign.report");
  }
  revalidatePath("/admin/ri/estrangeiros");
  return { status: "success", message: "Registro de envio desfeito." };
}

/** What an import says when done: what came in, what was left, the errors. */
function importSummary(
  created: number,
  skipped: number,
  errors: string[],
  what: string,
): RiState {
  const parts = [`${created} ${what} importados.`];
  if (skipped) parts.push(`${skipped} já existiam e ficaram como estavam.`);
  if (errors.length) {
    parts.push(
      `${errors.length} linhas com problema: ${errors.slice(0, 5).join(" ")}${errors.length > 5 ? " ..." : ""}`,
    );
  }
  return {
    status: created || !errors.length ? "success" : "error",
    message: parts.join(" "),
  };
}

/** Imports the Livro 1 (Protocolo) from a spreadsheet (.xlsx, .csv, .ods). */
export async function importProtocolBookAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const ok = await access("ri.import");
  if (!ok) return denied("ri.import");
  try {
    const rows = await sheetRows(formData.get("arquivo") as File);
    const reading = readProtocolImport(rows, officeToday());
    const { created, skipped } = await importProtocolsWith(
      db,
      ok.tenant.slug,
      reading.items,
      ok.actor,
    );
    // The imported days were closed in the physical book: they ask for no
    // termo (decision of 27/11/2026).
    const lastDay = reading.items
      .map((i) => i.presentedOn)
      .sort()
      .at(-1);
    if (lastDay && lastDay < officeToday()) {
      await closePhysicalDaysWith(db, ok.tenant.slug, lastDay, ok.actor);
    }
    revalidatePath("/admin/ri", "layout");
    const summary = importSummary(created, skipped, reading.errors, "títulos");
    if (summary.status === "idle") return summary;
    const extra = [
      reading.merged
        ? `${reading.merged} lançamentos repetidos no livro original (mesmo número ou com letra) foram guardados nas anotações do primeiro.`
        : "",
      reading.gaps
        ? `${reading.gaps} números sem lançamento no livro original entraram como protocolo não utilizado (cancelado).`
        : "",
      reading.blank
        ? `${reading.blank} linhas em branco do livro foram ignoradas.`
        : "",
    ]
      .filter(Boolean)
      .join(" ");
    return extra
      ? { status: summary.status, message: `${summary.message} ${extra}` }
      : summary;
  } catch (error) {
    if (error instanceof SheetFileError) {
      return { status: "error", message: error.message };
    }
    return failure(error, "ri.protocol.import");
  }
}

/** Imports assentos of the livro de estrangeiro from the model spreadsheet. */
export async function importForeignAction(
  _previous: RiState,
  formData: FormData,
): Promise<RiState> {
  const ok = await access("ri.import");
  if (!ok) return denied("ri.import");
  try {
    const rows = await sheetRows(formData.get("arquivo") as File);
    const reading = readForeignImport(rows, officeToday());
    const { created, skipped } = await importForeignWith(
      db,
      ok.tenant.slug,
      reading.items,
      ok.actor,
    );
    revalidatePath("/admin/ri/estrangeiros");
    return importSummary(created, skipped, reading.errors, "assentos");
  } catch (error) {
    if (error instanceof SheetFileError) {
      return { status: "error", message: error.message };
    }
    return foreignFailure(error, "ri.foreign.import");
  }
}
