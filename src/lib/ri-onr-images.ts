import "server-only";
import { and, desc, eq } from "drizzle-orm";
import JSZip from "jszip";
import sharp from "sharp";
import { nextVolume } from "@/core/ri/books.ts";
import {
  compareFicha,
  type FichaChange,
  transportDate,
} from "@/core/ri/ficha-changes.ts";
import type { MatriculaReading } from "@/core/ri/matricula-text.ts";
import {
  confer,
  numberInText,
  onrPath,
  patternOf,
} from "@/core/ri/onr-images.ts";
import { officialName } from "@/core/tenant/identification.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import type { Database } from "@/db/index.ts";
import { riActs, riOnrImages, riProperties } from "@/db/schema.ts";
import { aiBlockedWith, readRegistryDocuments } from "./ai.ts";
import { recordAuditWith } from "./audit.ts";
import { type Actor, RiError } from "./ri.ts";
import { listBooksWith } from "./ri-books.ts";
import { riSignerFor } from "./ri-docs.ts";
import { applyReadingWith, readMatriculaFilesWith } from "./ri-files.ts";
import { fichaTiff, pdfToOnrTiff } from "./ri-tiff.ts";
import { docxText } from "./titularidade-reading.ts";

/**
 * The images of the Livro 2 for the ONR (change
 * registro-de-imoveis-imagens-onr): the office attaches the matrícula as
 * PDF (the page as it is) or Word (the ficha built from its text), the
 * system confers the number, signs with the image of who signs, turns it
 * into the TIFF of the manual and keeps it in a queue to download, one by
 * one or all in a zip with the folders. Nothing is deleted: "apagar"
 * hides the image, the history stays.
 */

export type OnrImageRow = typeof riOnrImages.$inferSelect;

const UUID = /^[0-9a-f-]{36}$/i;
export const MAX_SOURCE_BYTES = 4 * 1024 * 1024;

export interface OnrHistoryEntry {
  at: string;
  by: string;
  what: string;
}

export interface BookSuggestion {
  /** The date the termo de abertura takes (the averbação de transporte). */
  date: string | null;
  fromTransport: boolean;
  volume: string;
  firstItem: number;
}

export interface PrepareResult {
  /** Saved: the id in the queue. */
  id?: string;
  number: number | null;
  issues: string[];
  /** What the ficha changes in the acervo, read by the assistente. */
  changes?: FichaChange[];
  /** No Livro 2 open: the opening the system proposes. */
  book?: BookSuggestion;
}

async function acervoOf(database: Database, tenantSlug: string, n: number) {
  const [row] = await database
    .select({
      id: riProperties.id,
      number: riProperties.number,
      cnm: riProperties.cnm,
      deletedAt: riProperties.deletedAt,
    })
    .from(riProperties)
    .where(
      and(
        eq(riProperties.tenantSlug, tenantSlug),
        eq(riProperties.book, 2),
        eq(riProperties.number, n),
      ),
    )
    .limit(1);
  return row && !row.deletedAt ? row : null;
}

/**
 * The assistente virtual only when there is doubt: the text gives no
 * number. It reads the document and says which matrícula it is; it never
 * changes the text.
 */
async function askNumber(
  database: Database,
  tenantSlug: string,
  file: { name: string; bytes: Uint8Array; isPdf: boolean; text: string },
): Promise<number | null> {
  if (await aiBlockedWith(database, tenantSlug)) return null;
  try {
    const out = await readRegistryDocuments({
      files: [
        file.isPdf
          ? { kind: "pdf", name: file.name, bytes: file.bytes }
          : { kind: "text", name: file.name, text: file.text },
      ],
      task: 'Este documento é a ficha de uma matrícula do Livro 2 do Registro de Imóveis. Diga só o número da matrícula, como está escrito no documento. Responda só com um JSON: {"number": 1234}. Se não houver, {"number": null}.',
    });
    const n = Number(String(out.number ?? "").replace(/\D/g, ""));
    return n >= 1 ? n : null;
  } catch {
    return null;
  }
}

/**
 * Prepares one matrícula: reads it, confers it, and when nothing is
 * pointed out (or the office confirmed it conferred) saves the TIFF.
 */
export async function prepareOnrImageWith(
  database: Database,
  tenant: Tenant,
  input: {
    name: string;
    bytes: Uint8Array;
    typed: number | null;
    pattern: string;
    sign: boolean;
    /** The rubrica at the top of every folha (the office chooses). */
    rubric?: boolean;
    confirmed: boolean;
  },
  actor: Actor,
): Promise<PrepareResult> {
  if (input.bytes.byteLength === 0) throw new RiError("Arquivo vazio.");
  if (input.bytes.byteLength > MAX_SOURCE_BYTES) {
    throw new RiError("O arquivo passa de 4 MB.");
  }
  const head = String.fromCharCode(...input.bytes.subarray(0, 4));
  const isPdf = head === "%PDF";
  const isDocx = head.startsWith("PK") && /\.docx$/i.test(input.name);
  if (!isPdf && !isDocx) {
    throw new RiError("Anexe a matrícula em PDF ou em Word (.docx).");
  }
  const { signer, settings } = await riSignerFor(tenant);
  const signature = input.sign ? settings.signatureImage : null;
  if (input.rubric && !settings.rubricImage) {
    throw new RiError(
      "Cadastre a imagem da rubrica em RI › Configurações antes, ou desmarque a rubrica.",
    );
  }
  if (input.sign && !signature) {
    throw new RiError(
      "Cadastre a imagem da assinatura em RI › Configurações antes, ou desmarque a assinatura.",
    );
  }

  let text = "";
  let pdf: Awaited<ReturnType<typeof pdfToOnrTiff>> | null = null;
  if (isPdf) {
    try {
      pdf = await pdfToOnrTiff(
        input.bytes,
        signature,
        input.rubric ? settings.rubricImage : null,
      );
    } catch {
      throw new RiError(
        "Não consegui abrir este PDF. Salve de novo pelo Word.",
      );
    }
    text = pdf.text;
  } else {
    text = await docxText(input.bytes).catch(() => "");
    if (!text.trim()) throw new RiError("Não consegui ler o texto do Word.");
  }

  let typed = input.typed;
  const textOk = text.replace(/\s/g, "").length > 30;
  if (!typed && !(textOk && numberInText(text))) {
    typed = await askNumber(database, tenant.slug, {
      name: input.name,
      bytes: input.bytes,
      isPdf,
      text,
    });
  }
  const pre = confer({
    typed,
    name: input.name,
    text,
    acervo: null,
    textOk,
  });
  if (!pre.number) return pre;
  const own = await acervoOf(database, tenant.slug, pre.number);
  const { number, issues } = confer({
    typed: pre.number,
    name: input.name,
    text,
    acervo: own ? { number: own.number, cnm: own.cnm } : null,
    textOk,
  });
  if (pdf?.noRoom) {
    issues.push(
      "Não há espaço para a assinatura depois do último ato: deixe umas linhas em branco no fim do Word e salve o PDF de novo.",
    );
  }
  if (issues.length && !input.confirmed) return { number, issues };
  if (!number) return { number, issues };

  let tiff: Buffer;
  let pages: number;
  let signed: boolean;
  if (pdf) {
    tiff = pdf.tiff;
    pages = pdf.pages;
    signed = pdf.signed;
  } else {
    tiff = await fichaTiff(
      {
        office: officialName(tenant),
        book: "Livro nº 2 · Registro Geral",
        title: `Matrícula nº ${number.toLocaleString("pt-BR")}`,
        cnm: own?.cnm ?? "",
        blocks: [{ label: "", meta: "", text }],
        signer: input.sign ? signer : null,
        place: `${tenant.location.city}/${tenant.location.state}`,
      },
      signature,
    );
    pages = (await sharp(tiff).metadata()).pages ?? 1;
    signed = Boolean(signature);
  }
  const [row] = await database
    .insert(riOnrImages)
    .values({
      tenantSlug: tenant.slug,
      number,
      propertyId: own?.id ?? null,
      sourceName: input.name.slice(0, 200),
      source: isPdf ? "pdf" : "word",
      pattern: patternOf(input.pattern).id,
      pages,
      tiff: tiff.toString("base64"),
      signed,
      issues,
      createdBy: actor.id,
      history: [
        {
          at: new Date().toISOString(),
          by: actor.id,
          what: `gerou a imagem a partir de ${input.name}${issues.length ? " (conferido com apontamentos)" : ""}`,
        },
      ],
    })
    .returning({ id: riOnrImages.id });
  await recordAuditWith(database, {
    tenantSlug: tenant.slug,
    actorId: actor.id,
    action: "ri.onr-image-add",
    targetType: "ri-onr-image",
    targetId: row?.id,
  });
  const read = row?.id
    ? await readIntoQueue(
        database,
        tenant.slug,
        row.id,
        number,
        own?.id ?? null,
        {
          name: input.name,
          mime: isPdf
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          bytes: input.bytes,
        },
      )
    : null;
  const book = await bookSuggestion(
    database,
    tenant.slug,
    number,
    read?.reading ?? null,
  );
  return {
    id: row?.id,
    number,
    issues,
    changes: read?.changes,
    ...(book ? { book } : {}),
  };
}

/**
 * The assistente virtual reads the signed ficha (only the conferência of
 * the matrícula: what it is and what changed), and the queue keeps the
 * reading and the changes until the office applies them.
 */
async function readIntoQueue(
  database: Database,
  tenantSlug: string,
  id: string,
  number: number,
  propertyId: string | null,
  file: { name: string; mime: string; bytes: Uint8Array },
): Promise<{ reading: MatriculaReading; changes: FichaChange[] } | null> {
  let reading: MatriculaReading;
  try {
    const result = await readMatriculaFilesWith(database, tenantSlug, [file], {
      book: 2,
    });
    reading = { ...result.reading, number };
  } catch {
    return null;
  }
  const known = propertyId
    ? await database
        .select({
          seq: riActs.seq,
          kind: riActs.kind,
          nature: riActs.nature,
          summary: riActs.summary,
          registeredOn: riActs.registeredOn,
          deletedAt: riActs.deletedAt,
        })
        .from(riActs)
        .where(eq(riActs.propertyId, propertyId))
    : [];
  const changes = compareFicha({
    exists: Boolean(propertyId),
    number,
    known: known.filter((a) => !a.deletedAt && a.kind !== "M"),
    read: reading.acts,
  });
  await database
    .update(riOnrImages)
    .set({ reading, changes })
    .where(eq(riOnrImages.id, id));
  return { reading, changes };
}

/**
 * The ficha of the matrícula nº 1 and no Livro 2 open: the system
 * proposes opening it, the termo de abertura on the date of the averbação
 * de transporte of that ficha (CNN, art. 336), from the matrícula 1 on.
 * The office confirms the date and that it is the 1º ato de transporte.
 */
export async function bookSuggestion(
  database: Database,
  tenantSlug: string,
  number: number,
  reading: MatriculaReading | null,
): Promise<BookSuggestion | null> {
  // The Livro 2 in fichas starts at the matrícula nº 1 and goes on.
  if (number !== 1) return null;
  const books = await listBooksWith(database, tenantSlug);
  const live = books.filter((b) => b.book === 2 && !b.deletedAt);
  if (live.some((b) => !b.closedOn)) return null;
  const when = reading
    ? transportDate(reading)
    : { date: null, fromTransport: false };
  return {
    ...when,
    volume: nextVolume(
      2,
      live.map((b) => b.volume),
    ),
    firstItem: number,
  };
}

/**
 * Puts what the ficha brought into the acervo: the matrícula when it is
 * new, the new registros and averbações, and the text of the atos the
 * ficha retificou (the old text stays in the history of the ato). The
 * indicadores real and pessoal come from the acervo, so they follow.
 */
export async function applyOnrReadingWith(
  database: Database,
  tenantSlug: string,
  id: string,
  actor: Actor,
): Promise<{ added: number; retified: number }> {
  const row = await own(database, tenantSlug, id);
  if (row.appliedAt) return { added: 0, retified: 0 };
  const reading = row.reading as MatriculaReading | null;
  if (!reading) {
    throw new RiError(
      "Esta ficha não foi lida pelo assistente virtual: lance os atos na matrícula.",
    );
  }
  const changes = (row.changes as FichaChange[] | null) ?? [];
  const current = await acervoOf(database, tenantSlug, row.number);
  const newSeqs = current
    ? changes
        .filter(
          (c) => c.kind === "novo-registro" || c.kind === "nova-averbacao",
        )
        .map((c) => c.seq as number)
    : reading.acts.map((a) => a.seq);
  const applied = await applyReadingWith(
    database,
    tenantSlug,
    { ...reading, number: row.number },
    { propertyId: current?.id ?? null, seqs: newSeqs },
    actor,
  );
  let retified = 0;
  if (current) {
    for (const change of changes) {
      if (change.kind !== "retificacao" || change.seq === null) continue;
      const read = reading.acts.find((a) => a.seq === change.seq);
      const [act] = await database
        .select()
        .from(riActs)
        .where(
          and(eq(riActs.propertyId, current.id), eq(riActs.seq, change.seq)),
        )
        .limit(1);
      if (!read || !act) continue;
      await database
        .update(riActs)
        .set({
          summary: read.summary,
          updatedAt: new Date(),
          history: [
            ...((act.history as unknown[]) ?? []),
            {
              at: new Date().toISOString(),
              by: actor.id,
              changes: [
                {
                  field: "summary",
                  before: act.summary,
                  after: read.summary,
                },
              ],
              reason: "retificação lida da ficha assinada",
            },
          ],
        })
        .where(eq(riActs.id, act.id));
      retified++;
    }
  }
  await database
    .update(riOnrImages)
    .set({
      appliedAt: new Date(),
      appliedBy: actor.id,
      propertyId: applied.propertyId,
      history: [
        ...historyOf(row),
        {
          at: new Date().toISOString(),
          by: actor.id,
          what: `aplicou ao acervo: ${applied.acts} ${applied.acts === 1 ? "ato novo" : "atos novos"}${retified ? `, ${retified} ${retified === 1 ? "retificação" : "retificações"}` : ""}`,
        },
      ],
    })
    .where(eq(riOnrImages.id, id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "ri.onr-image-apply",
    targetType: "ri-property",
    targetId: applied.propertyId,
  });
  return { added: applied.acts, retified };
}

export async function listOnrImagesWith(
  database: Database,
  tenantSlug: string,
): Promise<Omit<OnrImageRow, "tiff">[]> {
  const rows = await database
    .select({
      id: riOnrImages.id,
      tenantSlug: riOnrImages.tenantSlug,
      number: riOnrImages.number,
      propertyId: riOnrImages.propertyId,
      sourceName: riOnrImages.sourceName,
      source: riOnrImages.source,
      pattern: riOnrImages.pattern,
      pages: riOnrImages.pages,
      signed: riOnrImages.signed,
      issues: riOnrImages.issues,
      reading: riOnrImages.reading,
      changes: riOnrImages.changes,
      appliedAt: riOnrImages.appliedAt,
      appliedBy: riOnrImages.appliedBy,
      copiedAt: riOnrImages.copiedAt,
      copiedBy: riOnrImages.copiedBy,
      history: riOnrImages.history,
      createdBy: riOnrImages.createdBy,
      createdAt: riOnrImages.createdAt,
      deletedAt: riOnrImages.deletedAt,
      deletedBy: riOnrImages.deletedBy,
    })
    .from(riOnrImages)
    .where(eq(riOnrImages.tenantSlug, tenantSlug))
    .orderBy(desc(riOnrImages.createdAt));
  return rows;
}

/** The image in force of each number: the newest not hidden. */
export function currentOf<
  T extends Pick<OnrImageRow, "number" | "deletedAt" | "createdAt">,
>(rows: readonly T[]): T[] {
  const seen = new Map<number, T>();
  for (const r of rows) {
    if (r.deletedAt) continue;
    const prev = seen.get(r.number);
    if (!prev || prev.createdAt < r.createdAt) seen.set(r.number, r);
  }
  return [...seen.values()].sort((a, b) => a.number - b.number);
}

export async function onrImageWith(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<OnrImageRow | null> {
  if (!UUID.test(id)) return null;
  const [row] = await database
    .select()
    .from(riOnrImages)
    .where(and(eq(riOnrImages.tenantSlug, tenantSlug), eq(riOnrImages.id, id)))
    .limit(1);
  return row ?? null;
}

async function own(database: Database, tenantSlug: string, id: string) {
  const row = await onrImageWith(database, tenantSlug, id);
  if (!row) throw new RiError("Imagem não encontrada.");
  return row;
}

const historyOf = (row: Pick<OnrImageRow, "history">) =>
  (row.history as OnrHistoryEntry[] | null) ?? [];

/** Marks as copied to the folder of the CSL2, or undoes it. */
export async function setCopiedWith(
  database: Database,
  tenantSlug: string,
  ids: readonly string[],
  copied: boolean,
  actor: Actor,
): Promise<number> {
  let changed = 0;
  for (const id of ids) {
    const row = await own(database, tenantSlug, id);
    if (Boolean(row.copiedAt) === copied) continue;
    await database
      .update(riOnrImages)
      .set({
        copiedAt: copied ? new Date() : null,
        copiedBy: copied ? actor.id : null,
        history: [
          ...historyOf(row),
          {
            at: new Date().toISOString(),
            by: actor.id,
            what: copied
              ? "marcou como copiada para a pasta do CSL2"
              : "desfez a marca de copiada para a pasta do CSL2",
          },
        ],
      })
      .where(eq(riOnrImages.id, id));
    changed++;
  }
  if (changed) {
    await recordAuditWith(database, {
      tenantSlug,
      actorId: actor.id,
      action: copied ? "ri.onr-image-copied" : "ri.onr-image-not-copied",
      targetType: "ri-onr-image",
      targetId: ids.length === 1 ? ids[0] : undefined,
    });
  }
  return changed;
}

/** "Apagar" hides the image; it can come back. */
export async function setOnrImageDeletedWith(
  database: Database,
  tenantSlug: string,
  id: string,
  deleted: boolean,
  actor: Actor,
): Promise<void> {
  const row = await own(database, tenantSlug, id);
  if (Boolean(row.deletedAt) === deleted) return;
  await database
    .update(riOnrImages)
    .set({
      ...(deleted
        ? { deletedAt: new Date(), deletedBy: actor.id }
        : { deletedAt: null, deletedBy: null }),
      history: [
        ...historyOf(row),
        {
          at: new Date().toISOString(),
          by: actor.id,
          what: deleted ? "apagou a imagem" : "restaurou a imagem",
        },
      ],
    })
    .where(eq(riOnrImages.id, id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: deleted ? "ri.onr-image-delete" : "ri.onr-image-restore",
    targetType: "ri-onr-image",
    targetId: id,
  });
}

/** One image, with its path in the folder of the CSL2. */
export async function onrImageFileWith(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<{ bytes: Buffer; path: string } | null> {
  const row = await onrImageWith(database, tenantSlug, id);
  if (!row) return null;
  return {
    bytes: Buffer.from(row.tiff, "base64"),
    path: onrPath(row.number, row.pattern),
  };
}

/**
 * The images in force (or the ones asked for) in a zip with the folders of
 * the manual, to unzip straight into the folder of the matrículas.
 */
export async function onrZipWith(
  database: Database,
  tenantSlug: string,
  options: { ids?: readonly string[]; onlyNotCopied?: boolean } = {},
): Promise<{ bytes: Uint8Array; count: number }> {
  const rows = await database
    .select()
    .from(riOnrImages)
    .where(eq(riOnrImages.tenantSlug, tenantSlug));
  let chosen = currentOf(rows);
  if (options.ids?.length) {
    const ids = new Set(options.ids);
    chosen = chosen.filter((r) => ids.has(r.id));
  }
  if (options.onlyNotCopied) chosen = chosen.filter((r) => !r.copiedAt);
  const zip = new JSZip();
  for (const r of chosen) {
    zip.file(onrPath(r.number, r.pattern), Buffer.from(r.tiff, "base64"));
  }
  const bytes = await zip.generateAsync({
    type: "uint8array",
    compression: "STORE",
  });
  return { bytes, count: chosen.length };
}
