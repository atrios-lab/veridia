"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import {
  AttributionFileError,
  addAttributionFileWith,
  attributionFolder,
  removeAttributionFileWith,
  storeAttributionFile,
} from "@/lib/attribution-files.ts";
import { currentJustification, justify } from "@/lib/audit-reason.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { readStoredFile } from "@/lib/uploads.ts";

export type FileState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

const NO_PERMISSION =
  "Você não tem permissão para enviar arquivos às atribuições.";

async function importer() {
  const session = await getSession();
  if (
    !session ||
    !can(
      session.user.role ?? "",
      "attributions.import",
      session.user.permissions,
    )
  ) {
    return undefined;
  }
  return { session, tenant: await getTenant() };
}

/** A file the browser sent straight to the store: only this office's folder. */
function ownUpload(url: string, tenantSlug: string, attribution: string) {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname.endsWith(".blob.vercel-storage.com") &&
      parsed.pathname.startsWith(
        `/${attributionFolder(tenantSlug)}${attribution}/`,
      )
    );
  } catch {
    return false;
  }
}

export async function uploadAttributionFileAction(
  _previous: FileState,
  formData: FormData,
): Promise<FileState> {
  const ok = await importer();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const attribution = String(formData.get("atribuicao") ?? "");
  const description = String(formData.get("descricao") ?? "");
  try {
    let bytes: Uint8Array;
    let storedPath: string;
    let fileName: string;
    const url = String(formData.get("url") ?? "");
    if (url) {
      if (!ownUpload(url, ok.tenant.slug, attribution)) {
        return { status: "error", message: "Endereço do arquivo recusado." };
      }
      bytes = new Uint8Array(await readStoredFile(url));
      storedPath = url;
      fileName = String(formData.get("nome") ?? "arquivo");
    } else {
      const file = formData.get("arquivo");
      if (!(file instanceof File) || file.size === 0) {
        return { status: "error", message: "Escolha o arquivo." };
      }
      bytes = new Uint8Array(await file.arrayBuffer());
      fileName = file.name || "arquivo";
      storedPath = await storeAttributionFile(
        ok.tenant.slug,
        attribution,
        bytes,
        fileName,
      );
    }
    await addAttributionFileWith(db, ok.tenant.slug, {
      attribution,
      fileName,
      description,
      bytes,
      storedPath,
      uploadedBy: ok.session.user.id,
    });
  } catch (error) {
    if (error instanceof AttributionFileError) {
      return { status: "error", message: error.message };
    }
    console.error("attributions.upload", error);
    return { status: "error", message: "Não foi possível enviar agora." };
  }
  revalidatePath(`/admin/atribuicoes/${attribution}`);
  return { status: "saved", message: "Arquivo guardado." };
}

export async function removeAttributionFileAction(
  _previous: FileState,
  formData: FormData,
): Promise<FileState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await importer();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  try {
    const row = await removeAttributionFileWith(
      db,
      ok.tenant.slug,
      String(formData.get("id") ?? ""),
      ok.session.user.id,
      currentJustification() ?? "",
    );
    revalidatePath(`/admin/atribuicoes/${row.attribution}`);
  } catch (error) {
    if (error instanceof AttributionFileError) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: "Não foi possível excluir agora." };
  }
  return { status: "saved", message: "Arquivo excluído da lista." };
}
