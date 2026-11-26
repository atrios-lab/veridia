import { EMPTY_AUX } from "@/core/ri/auxiliary.ts";
import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { mergeAux } from "@/core/ri/auxiliary.ts";
import { readAuxText, toMarkdown } from "@/core/ri/auxiliary-text.ts";
import {
  coerceReading,
  type MatriculaReading,
  readMatriculaText,
} from "@/core/ri/matricula-text.ts";
import {
  EMPTY_CONDO,
  EMPTY_RURAL,
  type PropertyInput,
} from "@/core/ri/property.ts";
import type { Database } from "@/db/index.ts";
import {
  riActParties,
  riActs,
  riFiles,
  riProperties,
  riSettings,
} from "@/db/schema.ts";
import {
  AI_IMAGE_TYPES,
  AiError,
  type AiImageType,
  aiBlockedWith,
  readRegistryDocuments,
  type TitleFile,
} from "./ai.ts";
import { recordAuditWith } from "./audit.ts";
import { pdfText } from "./guide-reading.ts";
import {
  type Actor,
  createPropertyWith,
  findOrCreatePersonWith,
  RiError,
  toProperty,
} from "./ri.ts";
import { cleanSignature } from "./ri-tiff.ts";
import { docxText } from "./titularidade-reading.ts";

/**
 * The files of the Registro de Imóveis and what the assistente virtual
 * reads from them (decision of 25/11/2026: "em todos ter a opção de anexar
 * documentos para, com a ajuda da IA, extrair os dados"). A reading is a
 * proposal: the clerk confers and chooses what goes in.
 */

export const RI_FILE_MAX_BYTES = 40 * 1024 * 1024;
export const riFolder = (tenantSlug: string) => `ri/${tenantSlug}/`;

const UUID = /^[0-9a-f-]{36}$/i;

export type RiFile = typeof riFiles.$inferSelect;

export async function addFileWith(
  database: Database,
  tenantSlug: string,
  file: {
    propertyId: string | null;
    actId?: string | null;
    kind: "ficha" | "titulo" | "documento";
    name: string;
    mime: string;
    size: number;
    path: string;
  },
  actor: Actor,
): Promise<string> {
  const [row] = await database
    .insert(riFiles)
    .values({
      tenantSlug,
      propertyId: file.propertyId,
      actId: file.actId ?? null,
      kind: file.kind,
      name: file.name.slice(0, 200),
      mime: file.mime.slice(0, 100),
      size: file.size,
      path: file.path,
      createdBy: actor.id,
    })
    .returning({ id: riFiles.id });
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "ri.file-add",
    targetType: "ri-property",
    targetId: file.propertyId,
  });
  return row?.id as string;
}

export async function listFilesWith(
  database: Database,
  tenantSlug: string,
  propertyId: string,
): Promise<RiFile[]> {
  if (!UUID.test(propertyId)) return [];
  return database
    .select()
    .from(riFiles)
    .where(
      and(
        eq(riFiles.tenantSlug, tenantSlug),
        eq(riFiles.propertyId, propertyId),
      ),
    )
    .orderBy(desc(riFiles.createdAt));
}

export async function fileWith(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<RiFile | null> {
  if (!UUID.test(id)) return null;
  const [row] = await database
    .select()
    .from(riFiles)
    .where(and(eq(riFiles.tenantSlug, tenantSlug), eq(riFiles.id, id)))
    .limit(1);
  return row ?? null;
}

export async function setFileDeletedWith(
  database: Database,
  tenantSlug: string,
  id: string,
  deleted: boolean,
  actor: Actor,
): Promise<RiFile> {
  const row = await fileWith(database, tenantSlug, id);
  if (!row) throw new RiError("Arquivo não encontrado.");
  if (Boolean(row.deletedAt) !== deleted) {
    await database
      .update(riFiles)
      .set(
        deleted
          ? { deletedAt: new Date(), deletedBy: actor.id }
          : { deletedAt: null, deletedBy: null },
      )
      .where(eq(riFiles.id, id));
    await recordAuditWith(database, {
      tenantSlug,
      actorId: actor.id,
      action: deleted ? "ri.file-delete" : "ri.file-restore",
      targetType: "ri-property",
      targetId: row.propertyId,
    });
  }
  return row;
}

// ------------------------------------------------------------- reading

export interface IncomingFile {
  name: string;
  mime: string;
  bytes: Uint8Array;
}

export interface ReadingResult {
  reading: MatriculaReading;
  source: "assistente" | "texto";
  notes: string[];
  /**
   * The document as Markdown: kept in place of the file when the office
   * chooses "só o texto" (decision of 26/11/2026).
   */
  markdown?: string;
}

async function textOf(file: IncomingFile): Promise<string> {
  const head = String.fromCharCode(...file.bytes.subarray(0, 4));
  try {
    if (head === "%PDF") return await pdfText(file.bytes);
    if (head.startsWith("PK")) return await docxText(file.bytes);
    if (file.mime.startsWith("text/") || /\.(txt|rtf)$/i.test(file.name)) {
      return new TextDecoder().decode(file.bytes);
    }
  } catch {
    return "";
  }
  return "";
}

const MATRICULA_TASK = [
  "Tarefa fixa: ler a matrícula (ou ficha, transcrição ou registro auxiliar) do Registro de Imóveis anexada e devolver os dados para a conferência da serventia. Só o que está escrito; nada inventado. Campo que não aparece fica vazio.",
  "- book: 2 para matrícula do Livro 2; 3 para registro do Livro 3 (Registro Auxiliar).",
  "- number: o número da matrícula, só os dígitos. cnm: o Código Nacional de Matrícula, se houver.",
  '- openedOn: a data de abertura, "dd/mm/aaaa". location: 1 rural, 0 urbano.',
  "- denomination, street, district, area, ccir, nirf, car, incra, sigef, origin (registro anterior): como estão no texto.",
  "- description: o texto da abertura (descrição do imóvel, confrontações, medidas), sem os lançamentos.",
  '- owners: os proprietários da abertura: [{"name", "document" (CPF/CNPJ só dígitos), "share"}].',
  '- acts: cada lançamento R ou AV, na ordem: {"kind": "R" ou "AV", "seq": o número de ordem, "nature": "Compra e venda", "Hipoteca", "Cancelamento"…, "effect": "transmissao" (troca de dono), "onus" (hipoteca, alienação fiduciária, penhora, usufruto, cédula), "cancelamento", "descricao" (construção, retificação, georreferenciamento, desmembramento), "encerramento" ou "outro", "registeredOn": "dd/mm/aaaa", "summary": o texto do lançamento como está, "cancelsSeq": o número do ato que um cancelamento cancela, "parties": [{"name", "document", "role": "adquirente", "transmitente", "credor", "devedor" ou "outro", "share"}]}.',
  "- notes: até 5 frases curtas do que a serventia deve conferir (rasuras, números que não batem, partes sem CPF, lançamento ilegível).",
  "Livro 3 (Registro Auxiliar: cédula de crédito industrial, penhor rural ou industrial, pacto antenupcial, convenção de condomínio, debêntures, bem de família, título no inteiro teor). Ele NÃO tem imóvel: deixe vazios os campos de imóvel e preencha:",
  '- auxKind: a natureza, uma destas: "Emissão de debêntures", "Cédula de crédito industrial", "Convenção de condomínio (edilício, geral voluntário ou multipropriedade)", "Penhor de máquinas e aparelhos da indústria", "Convenção antenupcial (pacto antenupcial)", "Contrato de penhor rural", "Título registrado no inteiro teor, a pedido do interessado", "Instituição de bem de família (escritura)".',
  '- number: o número do registro no Livro 3. linkedNumbers: as matrículas citadas (remissões), separadas por "; ".',
  '- aux: {"title": "Cédula rural pignoratícia nº ...", "issuedOn": "dd/mm/aaaa", "value": "R$ 0,00", "dueOn": "dd/mm/aaaa", "paymentPlace", "terms" (forma de pagamento e encargos), "guarantees" (bens em garantia, como estão), "goodsPlace" (onde estão os bens), "regime" (regime de bens, no pacto), "weddingOn", "domicile", "deed" (tabelionato, livro e folhas da escritura), "protocolNumber", "protocolOn", "parties": [{"name", "document", "role": "emitente", "devedor", "credor", "avalista", "interveniente", "depositario", "conjuge", "emissora", "agente", "condominio", "requerente" ou "outro"}], "annotations": [{"on": "dd/mm/aaaa", "text": a anotação ou remissão como está}]}. As averbações à margem (aditivo, endosso, cessão, prorrogação, quitação, cancelamento) vão em acts, como AV, com o número de ordem.',
  "- markdown: o documento inteiro transcrito em Markdown, fiel ao original (títulos com #, rótulos em negrito, parágrafos), sem resumir.",
  "Responda só com um JSON, sem texto antes ou depois.",
].join("\n");

/** Reads one or more files of a matrícula: assistente first, text after. */
export async function readMatriculaFilesWith(
  database: Database,
  tenantSlug: string,
  files: IncomingFile[],
  options: { book?: 2 | 3 } = {},
): Promise<ReadingResult> {
  const title = files.map((f) => f.name.replace(/\.[^.]+$/, "")).join(", ");
  const notes: string[] = [];
  const texts = await Promise.all(files.map(textOf));
  const allText = texts.join("\n\n");
  const blocked = await aiBlockedWith(database, tenantSlug);
  if (!blocked) {
    try {
      const titleFiles: TitleFile[] = files.map((file, i) => {
        const head = String.fromCharCode(...file.bytes.subarray(0, 4));
        if (head === "%PDF")
          return { kind: "pdf", name: file.name, bytes: file.bytes };
        if ((Object.values(AI_IMAGE_TYPES) as string[]).includes(file.mime)) {
          return {
            kind: "image",
            name: file.name,
            bytes: file.bytes,
            mediaType: file.mime as AiImageType,
          };
        }
        return { kind: "text", name: file.name, text: texts[i] ?? "" };
      });
      const raw = await readRegistryDocuments({
        files: titleFiles,
        task:
          options.book === 3
            ? `${MATRICULA_TASK}\nEste documento é do Livro 3 (Registro Auxiliar): book = 3.`
            : MATRICULA_TASK,
      });
      const hinted =
        options.book === 3 && raw && typeof raw === "object"
          ? { ...(raw as object), book: 3 }
          : raw;
      const reading = coerceReading(hinted);
      const md =
        raw && typeof raw === "object"
          ? String((raw as Record<string, unknown>).markdown ?? "")
          : "";
      return {
        reading,
        source: "assistente",
        notes: [...notes, ...reading.notes],
        markdown: md.trim() ? md.slice(0, 400_000) : toMarkdown(allText, title),
      };
    } catch (error) {
      const said =
        error instanceof AiError
          ? error.message
          : "O Assistente Virtual não conseguiu ler agora.";
      if (!(error instanceof AiError)) console.error("ri.read", error);
      notes.push(`${said} Os dados vieram só da leitura do texto: confira.`);
    }
  } else {
    notes.push(blocked);
  }
  if (!allText.trim()) {
    throw new RiError(
      "O arquivo não tem texto para ler (foto ou PDF digitalizado) e o Assistente Virtual não está disponível para ler a imagem.",
    );
  }
  const base = readMatriculaText(allText);
  const reading =
    options.book === 3 || base.book === 3 ? auxReadingOf(base, allText) : base;
  return {
    reading,
    source: "texto",
    notes: [...notes, ...reading.notes],
    markdown: toMarkdown(allText, title),
  };
}

/** A Livro 3 registro read from its text: no imóvel, the model's labels. */
function auxReadingOf(base: MatriculaReading, text: string): MatriculaReading {
  const a = readAuxText(text);
  return {
    ...base,
    book: 3,
    // "matrícula nº" in a Livro 3 text is a remissão, not its number.
    number: a.number,
    openedOn: a.openedOn ?? base.openedOn,
    location: null,
    denomination: "",
    area: "",
    ccir: "",
    nirf: "",
    car: "",
    incra: "",
    sigef: "",
    origin: "",
    description: "",
    owners: [],
    acts: base.acts.filter((act) => act.kind === "AV"),
    notes: [
      ...a.notes,
      ...(a.number ? [] : ["Não achei o número do registro no Livro 3."]),
    ],
    auxKind: a.auxKind,
    linkedNumbers: a.linkedNumbers,
    aux: a.aux,
  };
}

/** The reading as the matrícula's form would be filled. */
export function inputFromReading(
  reading: MatriculaReading,
  base?: PropertyInput,
): PropertyInput {
  const keep = (current: string | undefined, read: string) =>
    current?.trim() ? current : read;
  const b = base;
  return {
    book: b?.book ?? reading.book,
    number: b?.number ?? reading.number ?? 0,
    recordKind: b?.recordKind ?? 1,
    status: b?.status ?? 0,
    cnm: keep(b?.cnm, reading.cnm),
    cnmInPgv: b?.cnmInPgv ?? false,
    openedOn: b?.openedOn ?? reading.openedOn,
    origin: keep(b?.origin, reading.origin),
    ficha: b?.ficha ?? "",
    // The Livro 3 has no imóvel: nothing of the Indicador Real.
    location: b?.location ?? (reading.book === 3 ? 0 : (reading.location ?? 1)),
    propertyKind:
      b?.propertyKind ??
      (reading.book !== 3 && reading.location === 1 ? 9 : null),
    streetKind:
      b?.streetKind ??
      (reading.book !== 3 && reading.location === 1 ? 177 : null),
    street: keep(b?.street, reading.street || reading.denomination),
    streetNumber: b?.streetNumber ?? "",
    district: keep(b?.district, reading.district),
    cep: b?.cep ?? "",
    complement: b?.complement ?? "",
    quadra: b?.quadra ?? "",
    setor: b?.setor ?? "",
    conjunto: b?.conjunto ?? "",
    lote: b?.lote ?? "",
    loteamento: b?.loteamento ?? "",
    contributors: b?.contributors ?? [],
    rural: {
      ...EMPTY_RURAL,
      ...(b?.rural ?? {}),
      denominacao: keep(b?.rural.denominacao, reading.denomination),
      ccir: keep(b?.rural.ccir, reading.ccir),
      nirf: keep(b?.rural.nirf, reading.nirf),
      car: keep(b?.rural.car, reading.car),
      incra: keep(b?.rural.incra, reading.incra),
      sigef: keep(b?.rural.sigef, reading.sigef),
    },
    condo: b?.condo ?? { ...EMPTY_CONDO },
    area: keep(b?.area, reading.area),
    auxKind: keep(b?.auxKind, reading.auxKind ?? ""),
    linkedNumbers: keep(b?.linkedNumbers, reading.linkedNumbers ?? ""),
    priorActs: b?.priorActs ?? 0,
    aux: mergeAux(
      b?.aux ?? { ...EMPTY_AUX, parties: [] },
      reading.aux ?? { ...EMPTY_AUX, parties: [] },
    ),
    description: keep(b?.description, reading.description),
    notes: b?.notes ?? "",
  };
}

/**
 * Saves what the clerk confirmed from a reading: a new matrícula (with the
 * owners of the opening and the chosen lançamentos, each with the number
 * it has on the ficha) or, on an existing one, the empty fields and the
 * lançamentos it does not have yet. Nothing already saved is overwritten.
 */
export async function applyReadingWith(
  database: Database,
  tenantSlug: string,
  reading: MatriculaReading,
  target: { propertyId: string | null; seqs: number[] },
  actor: Actor,
): Promise<{ propertyId: string; acts: number }> {
  let propertyId = target.propertyId;
  if (!propertyId) {
    if (!reading.number) {
      throw new RiError(
        "A leitura não trouxe o número: informe antes de salvar.",
      );
    }
    propertyId = await createPropertyWith(
      database,
      tenantSlug,
      inputFromReading(reading),
      actor,
      { source: "leitura", owners: reading.owners },
    );
  } else {
    const [row] = await database
      .select()
      .from(riProperties)
      .where(
        and(
          eq(riProperties.tenantSlug, tenantSlug),
          eq(riProperties.id, propertyId),
        ),
      )
      .limit(1);
    if (!row || row.deletedAt) throw new RiError("Matrícula não encontrada.");
    const current = toProperty(row);
    const filled = inputFromReading(reading, current);
    await database
      .update(riProperties)
      .set({
        cnm: filled.cnm,
        origin: filled.origin,
        street: filled.street,
        district: filled.district,
        rural: filled.rural,
        area: filled.area,
        description: filled.description,
        openedOn: filled.openedOn,
        auxKind: filled.auxKind,
        linkedNumbers: filled.linkedNumbers,
        aux: filled.aux,
        updatedAt: new Date(),
        history: [
          ...((row.history as unknown[]) ?? []),
          {
            at: new Date().toISOString(),
            by: actor.id,
            changes: [
              {
                field: "leitura",
                before: null,
                after: "campos vazios completados pela leitura",
              },
            ],
          },
        ],
      })
      .where(eq(riProperties.id, propertyId));
  }
  const existing = await database
    .select({ seq: riActs.seq })
    .from(riActs)
    .where(eq(riActs.propertyId, propertyId));
  const taken = new Set(existing.map((a) => a.seq));
  const chosen = reading.acts
    .filter((a) => target.seqs.includes(a.seq) && !taken.has(a.seq))
    .sort((a, b) => a.seq - b.seq);
  // The same name with a CPF somewhere in the reading and without it
  // elsewhere (a transmitente named only by name): one person.
  const fold = (name: string) =>
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  const known = new Map<string, string>();
  for (const party of [
    ...reading.owners,
    ...reading.acts.flatMap((a) => a.parties),
  ]) {
    if (party.document) known.set(fold(party.name), party.document);
  }
  const withDocument = <T extends { name: string; document: string }>(
    party: T,
  ): T =>
    party.document
      ? party
      : { ...party, document: known.get(fold(party.name)) ?? "" };
  const idBySeq = new Map<number, string>();
  for (const act of chosen) {
    const cancels =
      act.cancelsSeq !== null ? (idBySeq.get(act.cancelsSeq) ?? null) : null;
    const [row] = await database
      .insert(riActs)
      .values({
        tenantSlug,
        propertyId,
        kind: act.kind,
        seq: act.seq,
        effect:
          act.effect === "cancelamento" && !cancels ? "outro" : act.effect,
        nature: act.nature || (act.kind === "R" ? "Registro" : "Averbação"),
        registeredOn: act.registeredOn,
        summary: act.summary,
        cancelsActId: cancels,
        createdBy: actor.id,
      })
      .returning({ id: riActs.id });
    const id = row?.id as string;
    idBySeq.set(act.seq, id);
    for (const party of act.parties) {
      const personId = await findOrCreatePersonWith(
        database,
        tenantSlug,
        withDocument(party),
        actor,
      );
      await database.insert(riActParties).values({
        tenantSlug,
        actId: id,
        personId,
        role: party.role,
        share: party.share,
      });
    }
  }
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "ri.reading-apply",
    targetType: "ri-property",
    targetId: propertyId,
  });
  return { propertyId, acts: chosen.length };
}

// ------------------------------------------------- signer and signature

export async function signatureSettingsWith(
  database: Database,
  tenantSlug: string,
) {
  const [row] = await database
    .select({
      signerIndex: riSettings.signerIndex,
      signatureImage: riSettings.signatureImage,
      signatureUpdatedAt: riSettings.signatureUpdatedAt,
      rubricImage: riSettings.rubricImage,
    })
    .from(riSettings)
    .where(eq(riSettings.tenantSlug, tenantSlug))
    .limit(1);
  return {
    signerIndex: row?.signerIndex ?? 0,
    signatureImage: row?.signatureImage
      ? new Uint8Array(Buffer.from(row.signatureImage, "base64"))
      : null,
    signatureUpdatedAt: row?.signatureUpdatedAt ?? null,
    rubricImage: row?.rubricImage
      ? new Uint8Array(Buffer.from(row.rubricImage, "base64"))
      : null,
  };
}

export async function saveSignerWith(
  database: Database,
  tenantSlug: string,
  signerIndex: number,
  actor: Actor,
): Promise<void> {
  const index = Math.max(0, Math.min(20, Math.trunc(signerIndex) || 0));
  await database
    .insert(riSettings)
    .values({ tenantSlug, signerIndex: index, updatedBy: actor.id })
    .onConflictDoUpdate({
      target: riSettings.tenantSlug,
      set: { signerIndex: index, updatedBy: actor.id, updatedAt: new Date() },
    });
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "ri.settings",
    targetType: "ri-settings",
    targetId: null,
  });
}

/**
 * The signer's handwritten signature, photographed or scanned: cleaned
 * (paper and shadow out, ink black on transparent) and kept; null clears
 * it. The image alone never signs anything: see the screen's note.
 */
export async function saveSignatureImageWith(
  database: Database,
  tenantSlug: string,
  bytes: Uint8Array | null,
  actor: Actor,
  kind: "assinatura" | "rubrica" = "assinatura",
): Promise<void> {
  let value = "";
  if (bytes) {
    if (bytes.byteLength > 8 * 1024 * 1024) {
      throw new RiError("A imagem passa de 8 MB.");
    }
    try {
      value = (await cleanSignature(bytes)).toString("base64");
    } catch {
      throw new RiError(
        "Não deu para ler a imagem. Envie uma foto em JPG ou PNG.",
      );
    }
  }
  const set =
    kind === "rubrica"
      ? {
          rubricImage: value,
          rubricUpdatedBy: actor.id,
          rubricUpdatedAt: new Date(),
        }
      : {
          signatureImage: value,
          signatureUpdatedBy: actor.id,
          signatureUpdatedAt: new Date(),
        };
  await database
    .insert(riSettings)
    .values({ tenantSlug, ...set })
    .onConflictDoUpdate({ target: riSettings.tenantSlug, set });
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action:
      kind === "rubrica"
        ? value
          ? "ri.rubric-image"
          : "ri.rubric-image-remove"
        : value
          ? "ri.signature-image"
          : "ri.signature-image-remove",
    targetType: "ri-settings",
    targetId: null,
  });
}

/**
 * The rubrica is the same image as the signature (decision of 26/11/2026:
 * for many Tabeliães the signature is the rubrica).
 */
export async function copySignatureToRubricWith(
  database: Database,
  tenantSlug: string,
  actor: Actor,
): Promise<void> {
  const [row] = await database
    .select({ signatureImage: riSettings.signatureImage })
    .from(riSettings)
    .where(eq(riSettings.tenantSlug, tenantSlug))
    .limit(1);
  if (!row?.signatureImage) {
    throw new RiError("Cadastre a imagem da assinatura antes.");
  }
  await database
    .update(riSettings)
    .set({
      rubricImage: row.signatureImage,
      rubricUpdatedBy: actor.id,
      rubricUpdatedAt: new Date(),
    })
    .where(eq(riSettings.tenantSlug, tenantSlug));
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "ri.rubric-image",
    targetType: "ri-settings",
    targetId: null,
    reason: "A rubrica passou a ser a mesma imagem da assinatura.",
  });
}

/** The files of a matrícula still in use (for the ficha's images). */
export async function liveFilesWith(
  database: Database,
  tenantSlug: string,
  propertyId: string,
): Promise<RiFile[]> {
  if (!UUID.test(propertyId)) return [];
  return database
    .select()
    .from(riFiles)
    .where(
      and(
        eq(riFiles.tenantSlug, tenantSlug),
        eq(riFiles.propertyId, propertyId),
        isNull(riFiles.deletedAt),
      ),
    )
    .orderBy(desc(riFiles.createdAt));
}

/** Keeps what was read from a file, for the conferência screen. */
export async function saveReadingWith(
  database: Database,
  tenantSlug: string,
  fileId: string,
  result: ReadingResult,
): Promise<void> {
  await database
    .update(riFiles)
    .set({ reading: result })
    .where(and(eq(riFiles.tenantSlug, tenantSlug), eq(riFiles.id, fileId)));
}

/** A file read before its matrícula existed, now linked to it. */
export async function linkFileWith(
  database: Database,
  tenantSlug: string,
  fileId: string,
  propertyId: string,
): Promise<void> {
  await database
    .update(riFiles)
    .set({ propertyId })
    .where(and(eq(riFiles.tenantSlug, tenantSlug), eq(riFiles.id, fileId)));
}
