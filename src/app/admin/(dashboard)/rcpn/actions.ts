"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import {
  RcpnImportError,
  rcpn,
  rcpnFolder,
  storeImportFile,
} from "@/lib/rcpn.ts";
import {
  editImportWith,
  hideImportWith,
  ImportMetaError,
  purgeImportFileWith,
  restoreImportWith,
} from "@/lib/rcpn-import-meta.ts";
import { setPublicLookupWith } from "@/lib/rcpn-lookup.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { readStoredFile } from "@/lib/uploads.ts";

export type UploadState =
  | { status: "idle" }
  | { status: "error"; message: string };

async function importer() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "rcpn.import", session.user.permissions)
  ) {
    return undefined;
  }
  return { session, tenant: await getTenant() };
}

/** A file the browser sent straight to the store: only from this office's folder. */
function ownUpload(url: string, tenantSlug: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname.endsWith(".blob.vercel-storage.com") &&
      parsed.pathname.startsWith(`/${rcpnFolder(tenantSlug)}`)
    );
  } catch {
    return false;
  }
}

/**
 * Receives one file (any extension), reads it and opens the import. In the
 * deploy the bytes arrive in the store first (`url`); in development, in
 * the form itself.
 */
export async function uploadImportAction(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const gate = await importer();
  if (!gate)
    return {
      status: "error",
      message: "Sem permissão para enviar arquivos ao índice.",
    };
  const { session, tenant } = gate;
  let id: string;
  // Each step's time and size in the server's log, with no personal data:
  // what the support needs when an upload fails (decision of 14/11/2026).
  const started = Date.now();
  const step = (name: string, extra: Record<string, unknown> = {}) =>
    console.info("rcpn.upload.etapa", {
      etapa: name,
      ms: Date.now() - started,
      ...extra,
    });
  try {
    const url = String(formData.get("url") ?? "");
    let bytes: Uint8Array;
    let fileName: string;
    let storedPath: string;
    if (url) {
      if (!ownUpload(url, tenant.slug))
        return {
          status: "error",
          message: "Arquivo não reconhecido. Envie de novo.",
        };
      bytes = await readStoredFile(url);
      fileName = String(formData.get("fileName") ?? "arquivo").slice(0, 300);
      storedPath = url;
    } else {
      const file = formData.get("arquivo");
      if (!(file instanceof File) || file.size === 0) {
        return {
          status: "error",
          message: "Escolha o arquivo exportado do sistema do registro civil.",
        };
      }
      bytes = new Uint8Array(await file.arrayBuffer());
      fileName = file.name;
      storedPath = await storeImportFile(tenant.slug, bytes, fileName);
    }
    step("arquivo recebido", { bytes: bytes.byteLength, direto: Boolean(url) });
    ({ id } = await rcpn.createImport(tenant.slug, {
      fileName,
      bytes,
      storedPath,
      uploadedBy: session.user.id,
    }));
    step("lido e guardado");
  } catch (error) {
    if (error instanceof RcpnImportError)
      return { status: "error", message: error.message };
    console.error("rcpn.upload", { ms: Date.now() - started }, error);
    return {
      status: "error",
      message: "Não foi possível ler o arquivo. Tente de novo.",
    };
  }
  revalidatePath("/admin/rcpn/importar");
  redirect(`/admin/rcpn/importar/${id}`);
}

export type CloseState =
  | { status: "idle" }
  | { status: "error"; message: string };

/** Publishes the new registros and the changed ones the person marked. */
export async function publishImportAction(
  _prev: CloseState,
  formData: FormData,
): Promise<CloseState> {
  const gate = await importer();
  if (!gate)
    return {
      status: "error",
      message: "Sem permissão para publicar no índice.",
    };
  const id = String(formData.get("id") ?? "");
  const marked = new Set(formData.getAll("substituir").map(String));
  const replace: ReadonlySet<string> | "all" =
    formData.get("substituirTodos") === "1" ? "all" : marked;
  let count: number;
  try {
    count = await rcpn.publish(
      gate.tenant.slug,
      id,
      gate.session.user.id,
      replace,
      marked,
    );
  } catch (error) {
    if (error instanceof RcpnImportError)
      return { status: "error", message: error.message };
    console.error("rcpn.publish", error);
    return {
      status: "error",
      message: "Não foi possível publicar agora. Nada foi alterado no índice.",
    };
  }
  revalidatePath("/admin/rcpn");
  redirect(`/admin/rcpn/importar/${id}?publicados=${count}`);
}

export async function discardImportAction(
  _prev: CloseState,
  formData: FormData,
): Promise<CloseState> {
  const gate = await importer();
  if (!gate)
    return { status: "error", message: "Sem permissão para descartar." };
  const id = String(formData.get("id") ?? "");
  try {
    await rcpn.discard(gate.tenant.slug, id, gate.session.user.id);
  } catch (error) {
    if (error instanceof RcpnImportError)
      return { status: "error", message: error.message };
    console.error("rcpn.discard", error);
    return { status: "error", message: "Não foi possível descartar agora." };
  }
  revalidatePath("/admin/rcpn/importar");
  redirect("/admin/rcpn/importar");
}

export type ImportMetaState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

async function withImporter(
  formData: FormData,
  run: (gate: {
    tenantSlug: string;
    actorId: string;
    id: string;
  }) => Promise<string>,
): Promise<ImportMetaState> {
  const gate = await importer();
  if (!gate) {
    return { status: "error", message: "Sem permissão para importar." };
  }
  const id = String(formData.get("id") ?? "");
  try {
    const message = await run({
      tenantSlug: gate.tenant.slug,
      actorId: gate.session.user.id,
      id,
    });
    revalidatePath("/admin/rcpn/importar", "layout");
    return { status: "saved", message };
  } catch (error) {
    if (error instanceof ImportMetaError) {
      return { status: "error", message: error.message };
    }
    console.error("rcpn.import-meta", error);
    return { status: "error", message: "Não foi possível salvar agora." };
  }
}

/** A name and a note for a file sent; the earlier ones stay. */
export async function editImportAction(
  _prev: ImportMetaState,
  formData: FormData,
): Promise<ImportMetaState> {
  return withImporter(formData, async ({ tenantSlug, actorId, id }) => {
    await editImportWith(
      db,
      tenantSlug,
      id,
      {
        label: String(formData.get("label") ?? ""),
        note: String(formData.get("note") ?? ""),
      },
      actorId,
    );
    return "Alteração salva.";
  });
}

/** Takes the line off the list; the registros stay in the index. */
export async function hideImportAction(
  _prev: ImportMetaState,
  formData: FormData,
): Promise<ImportMetaState> {
  return withImporter(formData, async ({ tenantSlug, actorId, id }) => {
    await hideImportWith(db, tenantSlug, id, actorId);
    return "Arquivo tirado da lista. Os registros continuam no índice.";
  });
}

export async function restoreImportAction(
  _prev: ImportMetaState,
  formData: FormData,
): Promise<ImportMetaState> {
  return withImporter(formData, async ({ tenantSlug, actorId, id }) => {
    await restoreImportWith(db, tenantSlug, id, actorId);
    return "Arquivo de volta à lista.";
  });
}

/** Deletes the file sent and keeps only the data read from it. */
export async function purgeImportFileAction(
  _prev: ImportMetaState,
  formData: FormData,
): Promise<ImportMetaState> {
  return withImporter(formData, async ({ tenantSlug, actorId, id }) => {
    await purgeImportFileWith(db, tenantSlug, id, actorId);
    return "Arquivo apagado. Ficaram só os dados lidos.";
  });
}

/** The office's switch for the public lookup "Seu registro é daqui?". */
export async function setPublicLookupAction(
  _prev: ImportMetaState,
  formData: FormData,
): Promise<ImportMetaState> {
  const gate = await importer();
  if (!gate) {
    return { status: "error", message: "Sem permissão para alterar." };
  }
  const enabled = formData.get("enabled") === "on";
  try {
    await setPublicLookupWith(
      db,
      gate.tenant.slug,
      enabled,
      gate.session.user.id,
    );
  } catch (error) {
    console.error("rcpn.public-lookup", error);
    return { status: "error", message: "Não foi possível salvar agora." };
  }
  revalidatePath("/admin/rcpn");
  revalidatePath("/consulta-registro");
  return {
    status: "saved",
    message: enabled
      ? "Consulta pelo site ligada."
      : "Consulta pelo site desligada.",
  };
}
