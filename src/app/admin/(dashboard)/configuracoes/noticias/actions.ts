"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import {
  checkNewsFile,
  NEWS_MIME,
  type NewsFileKind,
  type NewsInput,
} from "@/core/news/news.ts";
import { db } from "@/db/index.ts";
import {
  addFileWith,
  archiveNewsWith,
  createNewsWith,
  NewsError,
  removeFileWith,
  restoreNewsWith,
  updateNewsWith,
} from "@/lib/news.ts";
import { removeNewsFile, storeNewsFile } from "@/lib/news-files.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export type NewsState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

const NO_PERMISSION = "Você não tem permissão para cuidar das notícias.";
const GENERIC = "Não foi possível salvar agora. Tente de novo.";
const PATH = "/admin/configuracoes/noticias";

async function editor() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "news.edit", session.user.permissions)
  ) {
    return null;
  }
  return session;
}

function failure(error: unknown, where: string): NewsState {
  if (error instanceof NewsError) {
    return { status: "error", message: error.message };
  }
  console.error(where, error);
  return { status: "error", message: GENERIC };
}

function refresh() {
  revalidatePath(PATH);
  revalidatePath("/noticias");
  revalidatePath("/admin", "layout");
}

interface Upload {
  kind: NewsFileKind;
  bytes: Uint8Array;
  name: string;
  mime: string;
}

/** The files the form sent, read and checked before anything is written. */
async function readFiles(
  formData: FormData,
): Promise<{ ok: true; files: Upload[] } | { ok: false; message: string }> {
  const files: Upload[] = [];
  const slots: [NewsFileKind, string][] = [
    ["photo", "photos"],
    ["pdf", "pdf"],
  ];
  for (const [kind, field] of slots) {
    for (const entry of formData.getAll(field)) {
      if (!(entry instanceof File) || entry.size === 0) continue;
      const bytes = new Uint8Array(await entry.arrayBuffer());
      const checked = checkNewsFile(kind, bytes, entry.name);
      if (!checked.ok) return { ok: false, message: checked.message };
      files.push({
        kind,
        bytes,
        name: entry.name.slice(0, 160),
        mime: NEWS_MIME[checked.type],
      });
    }
  }
  if (
    files.some((f) => f.kind === "pdf") &&
    formData.get("pdfPublic") !== "1"
  ) {
    return {
      ok: false,
      message:
        "Confirme que o PDF pode ser público antes de anexar: ele fica aberto a quem entra no site.",
    };
  }
  return { ok: true, files };
}

/** Creates or changes a post, with the files the form carries. */
export async function saveNewsAction(
  _previous: NewsState,
  formData: FormData,
): Promise<NewsState> {
  const session = await editor();
  if (!session) return { status: "error", message: NO_PERMISSION };
  const text = (name: string) => String(formData.get(name) ?? "");
  const input = {
    title: text("title"),
    category: text("category"),
    eventDate: text("eventDate"),
    summary: text("summary"),
    body: text("body"),
    imageConsent: formData.get("imageConsent") === "1",
    published: formData.get("published") === "1",
  } as NewsInput;
  const read = await readFiles(formData);
  if (!read.ok) return { status: "error", message: read.message };
  try {
    const tenant = await getTenant();
    const id = text("id");
    let postId = id;
    if (id) {
      await updateNewsWith(db, tenant.slug, id, input, session.user.id);
    } else {
      postId = await createNewsWith(db, tenant.slug, input, session.user.id);
    }
    for (const file of read.files) {
      const path = await storeNewsFile(
        tenant.slug,
        file.kind,
        file.bytes,
        file.name,
        file.mime,
      );
      try {
        const previous = await addFileWith(
          db,
          tenant.slug,
          postId,
          file.kind,
          { path, name: file.name, mime: file.mime },
          session.user.id,
        );
        await removeNewsFile(previous);
      } catch (error) {
        // The row refused (the photos' limit): the stored copy goes too.
        await removeNewsFile(path);
        throw error;
      }
    }
    refresh();
    return {
      status: "saved",
      message: id ? "Notícia salva." : "Notícia criada.",
    };
  } catch (error) {
    return failure(error, "noticias.save");
  }
}

/** Takes a photo or the PDF off a post. */
export async function removeNewsFileAction(formData: FormData): Promise<void> {
  const session = await editor();
  if (!session) return;
  try {
    const tenant = await getTenant();
    const previous = await removeFileWith(
      db,
      tenant.slug,
      String(formData.get("id") ?? ""),
      String(formData.get("fileId") ?? ""),
      session.user.id,
    );
    await removeNewsFile(previous);
    refresh();
  } catch (error) {
    console.error("noticias.remove-file", error);
  }
}

export async function archiveNewsAction(formData: FormData): Promise<void> {
  const session = await editor();
  if (!session) return;
  try {
    const tenant = await getTenant();
    await archiveNewsWith(
      db,
      tenant.slug,
      String(formData.get("id") ?? ""),
      session.user.id,
    );
    refresh();
  } catch (error) {
    console.error("noticias.archive", error);
  }
}

export async function restoreNewsAction(formData: FormData): Promise<void> {
  const session = await editor();
  if (!session) return;
  try {
    const tenant = await getTenant();
    await restoreNewsWith(
      db,
      tenant.slug,
      String(formData.get("id") ?? ""),
      session.user.id,
    );
    refresh();
  } catch (error) {
    console.error("noticias.restore", error);
  }
}
