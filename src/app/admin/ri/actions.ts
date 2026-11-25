"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can, type Permission } from "@/core/auth/roles.ts";
import type { PartyRole } from "@/core/ri/acts.ts";
import { PropertyError, readProperty } from "@/core/ri/property.ts";
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
import { SheetFileError, sheetRows } from "@/lib/ri-sheet.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

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
