"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import {
  RcpnImportError,
  rcpn,
  rcpnFolder,
  storeImportFile,
} from "@/lib/rcpn.ts";
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
