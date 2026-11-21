import "server-only";
import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import {
  type CedulaData,
  type CedulaGuarantee,
  CHANGE_KINDS,
  CHARGE_BASES,
  type ChargeBasis,
  coerceCedulaData,
  cueOf,
  type Detection,
  detectChanges,
  detectGuarantees,
  detectKind,
  emptyCedula,
  fold,
  type LearnedCue,
} from "@/core/cedulas/analise.ts";
import {
  type CedulaKind,
  isCedulaKind,
  KIND_INFO,
} from "@/core/cedulas/especies.ts";
import type { Database } from "@/db/index.ts";
import {
  cedulaAnalyses,
  cedulaLearnedCues,
  serviceRequestAttachments,
  serviceRequests,
  tenantContent,
} from "@/db/schema.ts";
import {
  AI_IMAGE_TYPES,
  AiError,
  type AiImageType,
  aiBlockedWith,
  readCedula,
  type TitleFile,
} from "./ai.ts";
import { recordAuditWith } from "./audit.ts";
import { feeTableReferenceWith } from "./fee-tables.ts";
import { pdfText } from "./guide-reading.ts";
import { searchKnowledgeWith } from "./knowledge.ts";
import { docxText } from "./titularidade-reading.ts";
import { readStoredFile } from "./uploads.ts";

/**
 * The análise de cédulas (decision of 21/11/2026, change
 * analise-de-cedulas). The documents are read in memory and dropped
 * ("descartar os arquivos para não acumular"); the analysis keeps the
 * data, the edited models and the files' names. Every edit keeps the
 * previous value in `history`, and "apagar" is a mark, never a deleted
 * row (CLAUDE.md: "Tudo o que se cria tem editar, alterar e apagar").
 */

export class CedulaError extends Error {}

export const CEDULA_MAX_FILES = 10;
export const CEDULA_FILE_MAX_BYTES = 20 * 1024 * 1024;
const HISTORY_MAX = 50;

export interface IncomingFile {
  name: string;
  bytes: Uint8Array;
  mediaType: string;
}

export interface HistoryEntry {
  at: string;
  by: string;
  /** "dados", "modelo:<id>", "vinculo". */
  what: string;
  previous: unknown;
}

export interface AnalysisView {
  id: string;
  kind: CedulaKind;
  title: string;
  data: CedulaData;
  models: Record<string, string>;
  history: HistoryEntry[];
  files: string[];
  source: "assistente" | "leitura" | "manual";
  aiNote: string | null;
  detectedKind: CedulaKind | null;
  requestId: string | null;
  protocolNumber: string | null;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date | null;
  removedAt: Date | null;
  removedReason: string | null;
}

type Row = typeof cedulaAnalyses.$inferSelect;

function viewOf(row: Row, protocolNumber: string | null = null): AnalysisView {
  const kind = isCedulaKind(row.kind) ? row.kind : "credito-bancario";
  const models =
    row.models && typeof row.models === "object" && !Array.isArray(row.models)
      ? Object.fromEntries(
          Object.entries(row.models as Record<string, unknown>).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        )
      : {};
  return {
    id: row.id,
    kind,
    title: row.title,
    data: coerceCedulaData(row.data, kind),
    models,
    history: Array.isArray(row.history) ? (row.history as HistoryEntry[]) : [],
    files: Array.isArray(row.files)
      ? (row.files as unknown[]).filter(
          (f): f is string => typeof f === "string",
        )
      : [],
    source:
      row.source === "assistente" || row.source === "leitura"
        ? row.source
        : "manual",
    aiNote: row.aiNote,
    detectedKind:
      row.detectedKind && isCedulaKind(row.detectedKind)
        ? row.detectedKind
        : null,
    requestId: row.requestId,
    protocolNumber,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    updatedAt: row.updatedAt,
    removedAt: row.removedAt,
    removedReason: row.removedReason,
  };
}

const pushHistory = (current: unknown, entry: HistoryEntry): HistoryEntry[] => {
  const list = Array.isArray(current) ? (current as HistoryEntry[]) : [];
  return [...list, entry].slice(-HISTORY_MAX);
};

// --------------------------------------------------------------- reading

export interface CedulaReading {
  data: CedulaData;
  source: "assistente" | "leitura" | "manual";
  /** What the clerk should know about the reading, one line each. */
  notes: string[];
  aiNote: string | null;
  detection: Detection | null;
  files: string[];
}

/** The text of a file, or "" when it has none (a photo, a scan). */
async function textOf(file: IncomingFile): Promise<string> {
  const head = String.fromCharCode(...file.bytes.subarray(0, 4));
  try {
    if (head === "%PDF") return await pdfText(file.bytes);
    if (head.startsWith("PK")) return await docxText(file.bytes);
    if (file.mediaType.startsWith("text/")) {
      return new TextDecoder().decode(file.bytes);
    }
  } catch {
    return "";
  }
  return "";
}

const isAddendumName = (value: string) =>
  /aditiv|aditament|mencao adicional|rerratifica/.test(fold(value));

/** The cédula's title line: the first line naming a cédula or nota. */
function titleIn(text: string): string {
  const line = text
    .split(/\n/)
    .map((l) => l.trim())
    .find((l) => /c[ée]dula|nota de cr[ée]dito/i.test(l) && l.length < 200);
  return line ?? "";
}

const DATE = String.raw`\d{1,2}/\d{1,2}/\d{2,4}`;
const MONEY = String.raw`R\$\s?[\d.]+,\d{2}`;

/** "Emitente: NAME, CPF 000..." as written; only what the text says. */
function personIn(
  body: string,
  label: RegExp,
  role: CedulaData["people"][number]["role"],
): CedulaData["people"] {
  const match = label.exec(body);
  if (!match?.[1]) return [];
  const line = match[1].split(/\n/)[0]?.trim() ?? "";
  const name = line.split(/,|\(/)[0]?.trim() ?? "";
  if (!name) return [];
  const taxId =
    /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/.exec(
      line,
    )?.[0] ?? "";
  const qualification = line
    .slice(name.length)
    .replace(/^[,\s]+/, "")
    .replace(/(CPF|CNPJ)\s*(n[º°o.]?\s*)?[\d./-]+,?\s*/i, "")
    .replace(/\.$/, "")
    .slice(0, 1000);
  return [{ role, name, taxId, qualification }];
}

/** "de X para Y", for a due date or a sum of money. */
function beforeAfter(text: string, unit: string): [string, string] {
  const match = new RegExp(
    `(?:de\\s+)(${unit})\\s+para\\s+(${unit})`,
    "i",
  ).exec(text);
  return [match?.[1] ?? "", match?.[2] ?? ""];
}

/** A first draft from the text alone, when the assistente is off. */
function draftFromText(
  kind: CedulaKind,
  texts: { name: string; text: string }[],
): CedulaData {
  const main =
    texts.find((t) => !isAddendumName(`${t.name} ${t.text.slice(0, 300)}`)) ??
    texts[0];
  const body = main?.text ?? "";
  const title = titleIn(body);
  const number = /n[º°o.]\s*([\w./-]{1,30})/i.exec(title)?.[1] ?? "";
  const amount = new RegExp(MONEY).exec(body)?.[0] ?? "";
  const dueOn =
    new RegExp(`vencimento[^\\d\\n]{0,30}(${DATE})`, "i").exec(body)?.[1] ?? "";
  const paymentPlace =
    /pra[çc]a de pagamento:?\s*([^.\n]{2,80})/i.exec(body)?.[1]?.trim() ?? "";
  const people = [
    ...personIn(body, /emitentes?:?\s*([^\n]+)/i, "emitente"),
    ...personIn(body, /credora?:?\s*([^\n]+)/i, "credor"),
    ...personIn(body, /avalistas?:?\s*([^\n]+)/i, "avalista"),
  ];
  const guarantees: CedulaGuarantee[] = detectGuarantees(body)
    .filter((g) => g !== "pessoal")
    .map((g) => ({
      kind: g,
      grade: /primeiro|1º/i.test(body) ? "1º" : "",
      description: "",
      registration:
        /matr[íi]cula\s+(?:n[º°o.]?\s*)?([\d.]+)/i.exec(body)?.[0] ?? "",
      location: "",
      municipality: "",
      here: "nao-sei" as const,
      owner: "",
    }));
  const addenda = texts
    .filter(
      (t) => t !== main && isAddendumName(`${t.name} ${t.text.slice(0, 300)}`),
    )
    .map((t) => {
      const [previousDue, newDue] = beforeAfter(t.text, DATE);
      const [previousAmount, newAmount] = beforeAfter(t.text, MONEY);
      return {
        title: titleIn(t.text) || t.name,
        date: "",
        changes: detectChanges(t.text),
        previousDue,
        newDue,
        previousAmount,
        newAmount,
        guaranteeChange: "",
        description: "",
      };
    });
  return coerceCedulaData(
    {
      ...emptyCedula(kind),
      title,
      number,
      amount,
      dueOn,
      paymentPlace,
      people,
      guarantees,
      addenda,
    },
    kind,
  );
}

/**
 * Reads the cédula and its aditivos (decision of 21/11/2026). The office's
 * teaching comes first for the kind; the assistente virtual, when on,
 * fills the data; without it, the text gives a first draft. The files are
 * dropped here: nothing of them leaves this function but their names.
 */
export async function readCedulaDocumentsWith(
  database: Database,
  tenantSlug: string,
  files: IncomingFile[],
  chosenKind: CedulaKind | null,
): Promise<CedulaReading> {
  const notes: string[] = [];
  const usable = files.slice(0, CEDULA_MAX_FILES).filter((file) => {
    if (file.bytes.byteLength > CEDULA_FILE_MAX_BYTES) {
      notes.push(`${file.name}: maior que 20 MB, não foi lido.`);
      return false;
    }
    return true;
  });
  const texts = await Promise.all(
    usable.map(async (file) => ({ name: file.name, text: await textOf(file) })),
  );
  for (const t of texts) {
    if (t.text.replace(/\s+/g, "").length < 40) {
      notes.push(
        `${t.name}: sem texto para ler (foto ou PDF digitalizado)${"; o Assistente Virtual lê, se estiver ligado"}.`,
      );
    }
  }
  const allText = texts.map((t) => t.text).join("\n");
  const learned = await listLearnedWith(database, tenantSlug);
  const detection = detectKind(allText, learned);
  const kind = chosenKind ?? detection?.kind ?? "credito-bancario";
  const names = usable.map((f) => f.name);

  if (usable.length === 0) {
    return {
      data: emptyCedula(kind),
      source: "manual",
      notes,
      aiNote: null,
      detection,
      files: names,
    };
  }

  const blocked = await aiBlockedWith(database, tenantSlug);
  if (!blocked) {
    try {
      const passages = (
        await searchKnowledgeWith(
          database,
          tenantSlug,
          `cédula de crédito ${KIND_INFO[kind].label} registro garantia hipoteca penhor aditivo`,
          { limit: 12 },
        )
      ).map((h) => ({
        reference: h.reference,
        heading: h.heading,
        text: h.text,
      }));
      const titleFiles: TitleFile[] = usable.map((file, index) => {
        const head = String.fromCharCode(...file.bytes.subarray(0, 4));
        const text = texts[index]?.text ?? "";
        if (head === "%PDF")
          return { kind: "pdf", name: file.name, bytes: file.bytes };
        if (
          (Object.values(AI_IMAGE_TYPES) as string[]).includes(file.mediaType)
        ) {
          return {
            kind: "image",
            name: file.name,
            bytes: file.bytes,
            mediaType: file.mediaType as AiImageType,
          };
        }
        return { kind: "text", name: file.name, text };
      });
      const result = await readCedula({
        files: titleFiles,
        hint: kind,
        passages,
      });
      // What the office chose or taught wins over the reading.
      const finalKind =
        chosenKind ??
        (detection?.by === "aprendido" ? detection.kind : result.data.kind);
      if (result.notes) notes.push(result.notes);
      return {
        data: { ...result.data, kind: finalKind },
        source: "assistente",
        notes,
        aiNote: null,
        detection,
        files: names,
      };
    } catch (error) {
      // Only the assistente's own messages are in the office's words; any
      // other failure goes to the log, never to the screen in English.
      const said =
        error instanceof AiError
          ? error.message
          : "O Assistente Virtual não conseguiu ler os documentos agora.";
      if (!(error instanceof AiError)) console.error("cedulas.read", error);
      notes.push(`${said} Os dados vieram só da leitura do texto: confira.`);
      return {
        data: draftFromText(kind, texts),
        source: "leitura",
        notes,
        aiNote: said,
        detection,
        files: names,
      };
    }
  }
  return {
    data: draftFromText(kind, texts),
    source: allText.trim() ? "leitura" : "manual",
    notes,
    aiNote: blocked,
    detection,
    files: names,
  };
}

/** The files of a pedido, read for the analysis (they stay in the pedido). */
export async function requestFilesWith(
  database: Database,
  tenantSlug: string,
  requestId: string,
  attachmentIds: string[],
): Promise<IncomingFile[]> {
  if (attachmentIds.length === 0) return [];
  const rows = await database
    .select()
    .from(serviceRequestAttachments)
    .where(
      and(
        eq(serviceRequestAttachments.tenantSlug, tenantSlug),
        eq(serviceRequestAttachments.requestId, requestId),
        isNotNull(serviceRequestAttachments.path),
      ),
    );
  const files: IncomingFile[] = [];
  for (const row of rows) {
    if (!attachmentIds.includes(row.id) || !row.path) continue;
    try {
      const bytes = new Uint8Array(await readStoredFile(row.path));
      files.push({ name: row.displayName, bytes, mediaType: row.mimeType });
    } catch {
      // A file purged or out of reach is just not read.
    }
  }
  return files;
}

// --------------------------------------------------------------- records

async function protocolOf(
  database: Database,
  tenantSlug: string,
  requestId: string | null,
): Promise<string | null> {
  if (!requestId) return null;
  const [row] = await database
    .select({ protocol: serviceRequests.protocolNumber })
    .from(serviceRequests)
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.id, requestId),
      ),
    )
    .limit(1);
  return row?.protocol ?? null;
}

export async function createAnalysisWith(
  database: Database,
  tenantSlug: string,
  input: {
    reading: CedulaReading;
    requestId: string | null;
  },
  actorId: string,
): Promise<string> {
  const { reading } = input;
  const [row] = await database
    .insert(cedulaAnalyses)
    .values({
      tenantSlug,
      requestId: input.requestId,
      kind: reading.data.kind,
      title: reading.data.title || KIND_INFO[reading.data.kind].label,
      data: reading.data,
      files: reading.files,
      source: reading.source,
      aiNote: reading.notes.join(" ").slice(0, 3000) || reading.aiNote,
      detectedKind: reading.detection?.kind ?? null,
      createdBy: actorId,
    })
    .returning({ id: cedulaAnalyses.id });
  if (!row) throw new CedulaError("Não foi possível criar a análise.");
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "cedula.create",
    targetType: "cedula-analysis",
    targetId: row.id,
  });
  return row.id;
}

export async function getAnalysisWith(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<AnalysisView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await database
    .select()
    .from(cedulaAnalyses)
    .where(
      and(eq(cedulaAnalyses.tenantSlug, tenantSlug), eq(cedulaAnalyses.id, id)),
    )
    .limit(1);
  if (!row) return null;
  return viewOf(row, await protocolOf(database, tenantSlug, row.requestId));
}

export async function listAnalysesWith(
  database: Database,
  tenantSlug: string,
  options: { removed?: boolean; requestId?: string } = {},
): Promise<AnalysisView[]> {
  const rows = await database
    .select({ row: cedulaAnalyses, protocol: serviceRequests.protocolNumber })
    .from(cedulaAnalyses)
    .leftJoin(serviceRequests, eq(serviceRequests.id, cedulaAnalyses.requestId))
    .where(
      and(
        eq(cedulaAnalyses.tenantSlug, tenantSlug),
        options.removed
          ? isNotNull(cedulaAnalyses.removedAt)
          : isNull(cedulaAnalyses.removedAt),
        options.requestId
          ? eq(cedulaAnalyses.requestId, options.requestId)
          : undefined,
      ),
    )
    .orderBy(desc(cedulaAnalyses.createdAt))
    .limit(300);
  return rows.map((r) => viewOf(r.row, r.protocol));
}

async function rowOf(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<Row> {
  if (!/^[0-9a-f-]{36}$/i.test(id))
    throw new CedulaError("Análise não encontrada.");
  const [row] = await database
    .select()
    .from(cedulaAnalyses)
    .where(
      and(eq(cedulaAnalyses.tenantSlug, tenantSlug), eq(cedulaAnalyses.id, id)),
    )
    .limit(1);
  if (!row) throw new CedulaError("Análise não encontrada.");
  return row;
}

/**
 * Saves the data the clerk checked. The previous data goes to the
 * history; a corrected kind teaches the office's cue (no personal data).
 */
export async function updateDataWith(
  database: Database,
  tenantSlug: string,
  id: string,
  data: CedulaData,
  actorId: string,
): Promise<{ learned: string | null }> {
  const row = await rowOf(database, tenantSlug, id);
  if (row.removedAt)
    throw new CedulaError("Restaure a análise antes de alterar.");
  const now = new Date();
  await database
    .update(cedulaAnalyses)
    .set({
      kind: data.kind,
      title: data.title || KIND_INFO[data.kind].label,
      // The notes opened from here are kept whatever the form sent.
      data: {
        ...data,
        noteIds: coerceCedulaData(
          row.data,
          isCedulaKind(row.kind) ? row.kind : data.kind,
        ).noteIds,
      },
      history: pushHistory(row.history, {
        at: now.toISOString(),
        by: actorId,
        what: "dados",
        previous: row.data,
      }),
      updatedBy: actorId,
      updatedAt: now,
    })
    .where(eq(cedulaAnalyses.id, row.id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "cedula.update",
    targetType: "cedula-analysis",
    targetId: row.id,
  });
  // The kind corrected by the clerk is learned from the title's words.
  let learned: string | null = null;
  const previousKind = isCedulaKind(row.kind) ? row.kind : null;
  if (previousKind !== data.kind) {
    const cue = cueOf(data.title);
    if (cue) {
      await learnCueWith(database, tenantSlug, cue, data.kind, actorId);
      learned = cue;
    }
  }
  return { learned };
}

/** Saves a model as the office edited it; null goes back to the generated one. */
export async function saveModelWith(
  database: Database,
  tenantSlug: string,
  id: string,
  modelId: string,
  text: string | null,
  actorId: string,
): Promise<void> {
  const row = await rowOf(database, tenantSlug, id);
  if (row.removedAt)
    throw new CedulaError("Restaure a análise antes de alterar.");
  if (!/^[\w-]{1,60}$/.test(modelId))
    throw new CedulaError("Modelo não encontrado.");
  const models = { ...((row.models as Record<string, string>) ?? {}) };
  const previous = models[modelId] ?? null;
  if (text === null) delete models[modelId];
  else models[modelId] = text.slice(0, 20_000);
  const now = new Date();
  await database
    .update(cedulaAnalyses)
    .set({
      models,
      history: pushHistory(row.history, {
        at: now.toISOString(),
        by: actorId,
        what: `modelo:${modelId}`,
        previous: previous ?? "(texto gerado)",
      }),
      updatedBy: actorId,
      updatedAt: now,
    })
    .where(eq(cedulaAnalyses.id, row.id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: text === null ? "cedula.model-reset" : "cedula.model",
    targetType: "cedula-analysis",
    targetId: row.id,
  });
}

/** "Apagar": hidden with the reason, never deleted. */
export async function removeAnalysisWith(
  database: Database,
  tenantSlug: string,
  id: string,
  reason: string,
  actorId: string,
): Promise<void> {
  const row = await rowOf(database, tenantSlug, id);
  if (row.removedAt) return;
  await database
    .update(cedulaAnalyses)
    .set({
      removedAt: new Date(),
      removedBy: actorId,
      removedReason: reason.slice(0, 1000),
    })
    .where(eq(cedulaAnalyses.id, row.id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "cedula.remove",
    targetType: "cedula-analysis",
    targetId: row.id,
    reason,
  });
}

export async function restoreAnalysisWith(
  database: Database,
  tenantSlug: string,
  id: string,
  actorId: string,
): Promise<void> {
  const row = await rowOf(database, tenantSlug, id);
  if (!row.removedAt) return;
  await database
    .update(cedulaAnalyses)
    .set({ removedAt: null, removedBy: null, removedReason: null })
    .where(eq(cedulaAnalyses.id, row.id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "cedula.restore",
    targetType: "cedula-analysis",
    targetId: row.id,
  });
}

/** Links the analysis to a pedido by its protocol, or unlinks it (null). */
export async function linkRequestWith(
  database: Database,
  tenantSlug: string,
  id: string,
  protocol: string | null,
  actorId: string,
): Promise<void> {
  const row = await rowOf(database, tenantSlug, id);
  let requestId: string | null = null;
  if (protocol) {
    const [request] = await database
      .select({ id: serviceRequests.id })
      .from(serviceRequests)
      .where(
        and(
          eq(serviceRequests.tenantSlug, tenantSlug),
          sql`upper(${serviceRequests.protocolNumber}) = ${protocol.trim().toUpperCase()}`,
        ),
      )
      .limit(1);
    if (!request) {
      throw new CedulaError(
        `Nenhum pedido com o protocolo ${protocol.trim()}.`,
      );
    }
    requestId = request.id;
  }
  const now = new Date();
  await database
    .update(cedulaAnalyses)
    .set({
      requestId,
      history: pushHistory(row.history, {
        at: now.toISOString(),
        by: actorId,
        what: "vinculo",
        previous: row.requestId,
      }),
      updatedBy: actorId,
      updatedAt: now,
    })
    .where(eq(cedulaAnalyses.id, row.id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: requestId ? "cedula.link" : "cedula.unlink",
    targetType: "cedula-analysis",
    targetId: row.id,
  });
}

// -------------------------------------------------------------- learning

export interface LearnedView extends LearnedCue {
  id: string;
  uses: number;
  removedAt: Date | null;
}

export async function listLearnedWith(
  database: Database,
  tenantSlug: string,
  options: { all?: boolean } = {},
): Promise<LearnedView[]> {
  const rows = await database
    .select()
    .from(cedulaLearnedCues)
    .where(
      and(
        eq(cedulaLearnedCues.tenantSlug, tenantSlug),
        options.all ? undefined : isNull(cedulaLearnedCues.removedAt),
      ),
    )
    .orderBy(asc(cedulaLearnedCues.cue));
  return rows.flatMap((r) =>
    isCedulaKind(r.kind)
      ? [
          {
            id: r.id,
            cue: r.cue,
            kind: r.kind,
            uses: r.uses,
            removedAt: r.removedAt,
          },
        ]
      : [],
  );
}

export async function learnCueWith(
  database: Database,
  tenantSlug: string,
  cue: string,
  kind: CedulaKind,
  actorId: string,
): Promise<void> {
  const clean = cueOf(cue);
  if (!clean) return;
  const now = new Date();
  await database
    .insert(cedulaLearnedCues)
    .values({ tenantSlug, cue: clean, kind, createdBy: actorId })
    .onConflictDoUpdate({
      target: [cedulaLearnedCues.tenantSlug, cedulaLearnedCues.cue],
      set: {
        kind,
        uses: sql`${cedulaLearnedCues.uses} + 1`,
        updatedAt: now,
        removedAt: null,
        removedBy: null,
      },
    });
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "cedula.learn",
    targetType: "cedula-learned",
    targetId: clean,
  });
}

/** Edit the kind of a learned cue, or remove it (a mark) or restore it. */
export async function changeLearnedWith(
  database: Database,
  tenantSlug: string,
  id: string,
  change: { kind?: CedulaKind; removed?: boolean },
  actorId: string,
): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(id))
    throw new CedulaError("Item não encontrado.");
  const now = new Date();
  await database
    .update(cedulaLearnedCues)
    .set({
      ...(change.kind ? { kind: change.kind } : {}),
      ...(change.removed === true
        ? { removedAt: now, removedBy: actorId }
        : {}),
      ...(change.removed === false ? { removedAt: null, removedBy: null } : {}),
      updatedAt: now,
    })
    .where(
      and(
        eq(cedulaLearnedCues.tenantSlug, tenantSlug),
        eq(cedulaLearnedCues.id, id),
      ),
    );
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action:
      change.removed === true
        ? "cedula.learned-remove"
        : change.removed === false
          ? "cedula.learned-restore"
          : "cedula.learned-edit",
    targetType: "cedula-learned",
    targetId: id,
  });
}

// ---------------------------------------------------- the charging notes

/**
 * How this office charges each kind of act (decision of 21/11/2026:
 * "existem maneiras diferentes de cobrar"): a note per basis pointing to
 * the item of the State's table, written by the office.
 */
export const OFFICE_CEDULAS_KEY = "office-cedulas";

const ChargeNotesSchema = z.object({
  notes: z
    .partialRecord(z.enum(CHARGE_BASES), z.string().max(2000))
    .default({}),
});
export type ChargeNotes = Partial<Record<ChargeBasis, string>>;

export async function getChargeNotesWith(
  database: Database,
  tenantSlug: string,
): Promise<ChargeNotes> {
  const [row] = await database
    .select({ published: tenantContent.published })
    .from(tenantContent)
    .where(
      and(
        eq(tenantContent.tenantSlug, tenantSlug),
        eq(tenantContent.key, OFFICE_CEDULAS_KEY),
      ),
    )
    .limit(1);
  const parsed = ChargeNotesSchema.safeParse(row?.published ?? {});
  return parsed.success ? parsed.data.notes : {};
}

export async function saveChargeNotesWith(
  database: Database,
  tenantSlug: string,
  notes: ChargeNotes,
  actorId: string,
): Promise<void> {
  const clean = Object.fromEntries(
    Object.entries(notes)
      .filter(([key]) => (CHARGE_BASES as readonly string[]).includes(key))
      .map(([key, value]) => [
        key,
        String(value ?? "")
          .trim()
          .slice(0, 2000),
      ]),
  );
  const now = new Date();
  const value = { notes: clean };
  await database
    .insert(tenantContent)
    .values({
      tenantSlug,
      key: OFFICE_CEDULAS_KEY,
      published: value,
      publishedAt: now,
      updatedBy: actorId,
    })
    .onConflictDoUpdate({
      target: [tenantContent.tenantSlug, tenantContent.key],
      set: {
        published: value,
        publishedAt: now,
        updatedAt: now,
        updatedBy: actorId,
      },
    });
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "cedula.charge-notes",
    targetType: "tenant-content",
    targetId: OFFICE_CEDULAS_KEY,
  });
}

/** Change kinds re-exported for the forms. */
export { CHANGE_KINDS };

/**
 * Records the nota de exigência opened from the analysis (decision of
 * 21/11/2026): the qualificação's id goes into the analysis, which lists
 * it; the note itself lives, numbered, in the Qualificação de títulos.
 */
export async function linkNoteWith(
  database: Database,
  tenantSlug: string,
  id: string,
  qualificationId: string,
  actorId: string,
): Promise<void> {
  const row = await rowOf(database, tenantSlug, id);
  const kind = isCedulaKind(row.kind) ? row.kind : "credito-bancario";
  const data = coerceCedulaData(row.data, kind);
  const now = new Date();
  await database
    .update(cedulaAnalyses)
    .set({
      data: { ...data, noteIds: [...data.noteIds, qualificationId].slice(-30) },
      history: pushHistory(row.history, {
        at: now.toISOString(),
        by: actorId,
        what: "nota",
        previous: data.noteIds,
      }),
      updatedBy: actorId,
      updatedAt: now,
    })
    .where(eq(cedulaAnalyses.id, row.id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "cedula.note",
    targetType: "cedula-analysis",
    targetId: row.id,
  });
}

// ------------------------------------------------- cédula in a pedido

export interface RequestFileRef {
  id: string;
  displayName: string;
  path: string | null;
  mimeType: string;
  sizeBytes: number;
  purgedAt: Date | null;
}

export interface CedulaInRequest {
  kind: CedulaKind;
  /** How it was seen: the act asked, a file's name, a file's text. */
  from: "ato" | "nome" | "texto";
  file: string;
}

const NAMES_CEDULA =
  /c[ée]dula|nota de cr[ée]dito (rural|industrial|comercial|[àa] exporta)|\bcpr\b|\bccb\b|\bcci\b|\bcir\b/i;
const SCAN_MAX_FILES = 5;
const SCAN_MAX_BYTES = 10 * 1024 * 1024;

const ScanSchema = z.object({
  key: z.string(),
  kind: z.string().nullable(),
  file: z.string().default(""),
});

/**
 * Whether a pedido brought a cédula (decision of 21/11/2026: "o campo de
 * cédula no pedido só se o documento for cédula, que o sistema já veja
 * caso a pessoa não saiba escolher na hora do protocolo"): by the act
 * asked, by a file's name, or by the text of the files themselves. The
 * reading of the text is kept in the pedido by the files it read, so the
 * same files are never read twice.
 */
export async function cedulaInRequestWith(
  database: Database,
  tenantSlug: string,
  input: {
    requestId: string;
    details: unknown;
    actName: string;
    files: RequestFileRef[];
  },
): Promise<CedulaInRequest | null> {
  const learned = await listLearnedWith(database, tenantSlug).catch(() => []);
  const byAct = detectKind(input.actName, learned);
  if (byAct || NAMES_CEDULA.test(input.actName)) {
    return {
      kind: byAct?.kind ?? "credito-bancario",
      from: "ato",
      file: input.actName,
    };
  }
  const live = input.files.filter((f) => f.path && !f.purgedAt);
  for (const f of live) {
    const byName = detectKind(f.displayName, learned);
    if (byName || NAMES_CEDULA.test(f.displayName)) {
      return {
        kind: byName?.kind ?? "credito-bancario",
        from: "nome",
        file: f.displayName,
      };
    }
  }
  const readable = live
    .filter(
      (f) =>
        f.sizeBytes <= SCAN_MAX_BYTES &&
        (f.mimeType === "application/pdf" ||
          /wordprocessingml|msword/.test(f.mimeType)),
    )
    .slice(0, SCAN_MAX_FILES);
  if (readable.length === 0) return null;
  const key = readable
    .map((f) => f.id)
    .sort()
    .join(",");
  const cached = ScanSchema.safeParse(
    (input.details as { cedulaScan?: unknown } | null)?.cedulaScan,
  );
  if (cached.success && cached.data.key === key) {
    return cached.data.kind && isCedulaKind(cached.data.kind)
      ? { kind: cached.data.kind, from: "texto", file: cached.data.file }
      : null;
  }
  let found: CedulaInRequest | null = null;
  for (const f of readable) {
    if (!f.path) continue;
    try {
      const bytes = new Uint8Array(await readStoredFile(f.path));
      const text = await textOf({
        name: f.displayName,
        bytes,
        mediaType: f.mimeType,
      });
      const hit = detectKind(text.slice(0, 20_000), learned);
      if (hit) {
        found = { kind: hit.kind, from: "texto", file: f.displayName };
        break;
      }
    } catch {
      // A file out of reach is just not read.
    }
  }
  await database
    .update(serviceRequests)
    .set({
      details: sql`coalesce(${serviceRequests.details}, '{}'::jsonb) || ${JSON.stringify(
        {
          cedulaScan: {
            key,
            kind: found?.kind ?? null,
            file: found?.file ?? "",
          },
        },
      )}::jsonb`,
    })
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.id, input.requestId),
      ),
    )
    .catch(() => undefined);
  return found;
}

/** The fee table in force, re-exported for the cédulas' screens. */
export { feeTableReferenceWith };
