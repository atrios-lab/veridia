"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import {
  checkLevels,
  checkTeamFile,
  DEFAULT_FRAME,
  MAX_LEVELS,
  type StaffInput,
  TEAM_MIME,
  type TeamFileKind,
  type TeamLevel,
  uniqueLevelId,
} from "@/core/team/team.ts";
import { db } from "@/db/index.ts";
import { getSession } from "@/lib/session.ts";
import { getLegacySigners } from "@/lib/tax-guides.ts";
import {
  archiveStaffWith,
  clearFileWith,
  createStaffWith,
  importSignersWith,
  moveStaffWith,
  restoreStaffWith,
  saveLevelsWith,
  setFileWith,
  TeamError,
  updateStaffWith,
} from "@/lib/team.ts";
import { removeTeamFile, storeTeamFile } from "@/lib/team-files.ts";
import { getTenant } from "@/lib/tenant.ts";

export type TeamState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

const NO_PERMISSION = "Só o Tabelião cuida da equipe do cartório.";
const GENERIC = "Não foi possível salvar agora. Tente de novo.";
const PATH = "/admin/configuracoes/equipe";

async function editor() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "team.edit", session.user.permissions)
  ) {
    return null;
  }
  return session;
}

function failure(error: unknown, where: string): TeamState {
  if (error instanceof TeamError) {
    return { status: "error", message: error.message };
  }
  console.error(where, error);
  return { status: "error", message: GENERIC };
}

function refresh() {
  revalidatePath(PATH);
  revalidatePath("/equipe");
  revalidatePath("/admin", "layout");
}

/** A whole number from the form, or the fallback when it is not one. */
const whole = (value: string, fallback: number) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

const KINDS: TeamFileKind[] = ["photo", "portaria", "word"];

/** One file the form sent, read and checked before anything is written. */
async function readFiles(formData: FormData): Promise<
  | {
      ok: true;
      files: {
        kind: TeamFileKind;
        bytes: Uint8Array;
        name: string;
        mime: string;
      }[];
    }
  | { ok: false; message: string }
> {
  const files: {
    kind: TeamFileKind;
    bytes: Uint8Array;
    name: string;
    mime: string;
  }[] = [];
  for (const kind of KINDS) {
    const file = formData.get(kind);
    if (!(file instanceof File) || file.size === 0) continue;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const checked = checkTeamFile(kind, bytes, file.name);
    if (!checked.ok) return { ok: false, message: checked.message };
    if (kind === "portaria" && formData.get("portariaPublic") !== "1") {
      return {
        ok: false,
        message:
          "Confirme que a portaria pode ser pública antes de anexar: ela fica aberta a quem entra no site.",
      };
    }
    files.push({
      kind,
      bytes,
      name: file.name.slice(0, 160),
      mime: TEAM_MIME[checked.type],
    });
  }
  return { ok: true, files };
}

/** Registers or changes a person, with the files the form carries. */
export async function savePersonAction(
  _previous: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const session = await editor();
  if (!session) return { status: "error", message: NO_PERMISSION };
  const text = (name: string) => String(formData.get(name) ?? "");
  const input: StaffInput = {
    name: text("name"),
    levelId: text("levelId"),
    profession: text("profession"),
    registration: text("registration"),
    portariaDate: text("portariaDate"),
    showOnSite: formData.get("showOnSite") === "1",
    imageConsent: formData.get("imageConsent") === "1",
    canSign: formData.get("canSign") === "1",
    frame: {
      shape: text("frameShape") === "square" ? "square" : "circle",
      fit: text("frameFit") === "contain" ? "contain" : "cover",
      x: whole(text("frameX"), DEFAULT_FRAME.x),
      y: whole(text("frameY"), DEFAULT_FRAME.y),
      zoom: whole(text("frameZoom"), DEFAULT_FRAME.zoom),
    },
  };
  const read = await readFiles(formData);
  if (!read.ok) return { status: "error", message: read.message };
  try {
    const tenant = await getTenant();
    const id = text("id");
    let personId = id;
    if (id) {
      await updateStaffWith(db, tenant.slug, id, input, session.user.id);
    } else {
      personId = await createStaffWith(db, tenant.slug, input, session.user.id);
    }
    for (const file of read.files) {
      const path = await storeTeamFile(
        tenant.slug,
        file.kind,
        file.bytes,
        file.name,
        file.mime,
      );
      const previous = await setFileWith(
        db,
        tenant.slug,
        personId,
        file.kind,
        { path, name: file.name, mime: file.mime },
        session.user.id,
      );
      await removeTeamFile(previous);
    }
    refresh();
    return {
      status: "saved",
      message: id ? "Dados salvos." : "Pessoa cadastrada.",
    };
  } catch (error) {
    return failure(error, "equipe.save");
  }
}

/** Takes the photo, the portaria or the Word off a person. */
export async function removeFileAction(formData: FormData): Promise<void> {
  const session = await editor();
  if (!session) return;
  const kind = String(formData.get("kind") ?? "") as TeamFileKind;
  if (!KINDS.includes(kind)) return;
  try {
    const tenant = await getTenant();
    const previous = await clearFileWith(
      db,
      tenant.slug,
      String(formData.get("id") ?? ""),
      kind,
      session.user.id,
    );
    await removeTeamFile(previous);
    refresh();
  } catch (error) {
    console.error("equipe.remove-file", error);
  }
}

export async function archivePersonAction(formData: FormData): Promise<void> {
  const session = await editor();
  if (!session) return;
  try {
    const tenant = await getTenant();
    await archiveStaffWith(
      db,
      tenant.slug,
      String(formData.get("id") ?? ""),
      session.user.id,
    );
    refresh();
  } catch (error) {
    console.error("equipe.archive", error);
  }
}

export async function restorePersonAction(formData: FormData): Promise<void> {
  const session = await editor();
  if (!session) return;
  try {
    const tenant = await getTenant();
    await restoreStaffWith(
      db,
      tenant.slug,
      String(formData.get("id") ?? ""),
      session.user.id,
    );
    refresh();
  } catch (error) {
    console.error("equipe.restore", error);
  }
}

export async function movePersonAction(formData: FormData): Promise<void> {
  const session = await editor();
  if (!session) return;
  const direction = formData.get("direction") === "up" ? "up" : "down";
  try {
    const tenant = await getTenant();
    await moveStaffWith(
      db,
      tenant.slug,
      String(formData.get("id") ?? ""),
      direction,
      session.user.id,
    );
    refresh();
  } catch (error) {
    console.error("equipe.move", error);
  }
}

/** The levels (names and order); new ones come with an empty id. */
export async function saveLevelsAction(
  _previous: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const session = await editor();
  if (!session) return { status: "error", message: NO_PERMISSION };
  let submitted: unknown;
  try {
    submitted = JSON.parse(String(formData.get("levels") ?? "null"));
  } catch {
    submitted = null;
  }
  if (!Array.isArray(submitted) || submitted.length > MAX_LEVELS) {
    return { status: "error", message: "Níveis inválidos." };
  }
  const levels: TeamLevel[] = [];
  for (const item of submitted) {
    const entry = (item ?? {}) as { id?: unknown; label?: unknown };
    const label = String(entry.label ?? "").trim();
    const id =
      typeof entry.id === "string" && entry.id
        ? entry.id
        : uniqueLevelId(levels, label);
    levels.push({ id, label });
  }
  const problem = checkLevels(levels);
  if (problem) return { status: "error", message: problem };
  try {
    const tenant = await getTenant();
    await saveLevelsWith(db, tenant.slug, levels, session.user.id);
    refresh();
    return { status: "saved", message: "Níveis salvos." };
  } catch (error) {
    return failure(error, "equipe.levels");
  }
}

/** Brings the people of the old "Quem assina" list into the team. */
export async function importSignersAction(
  _previous: TeamState,
  _formData: FormData,
): Promise<TeamState> {
  const session = await editor();
  if (!session) return { status: "error", message: NO_PERMISSION };
  try {
    const tenant = await getTenant();
    const count = await importSignersWith(
      db,
      tenant.slug,
      await getLegacySigners(tenant),
      session.user.id,
    );
    refresh();
    revalidatePath("/admin/configuracoes/quem-assina");
    return {
      status: "saved",
      message:
        count === 1
          ? "Uma pessoa de Quem assina entrou na equipe."
          : `${count} pessoas de Quem assina entraram na equipe.`,
    };
  } catch (error) {
    return failure(error, "equipe.import-signers");
  }
}
