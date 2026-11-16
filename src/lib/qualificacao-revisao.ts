import "server-only";
import { createHash } from "node:crypto";
import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import {
  isRevokedPassage,
  type NormRef,
  normOf,
  normsIn,
  sameNorm,
} from "@/core/conhecimento/base.ts";
import {
  ATTRIBUTIONS,
  type Attribution,
  isAttribution,
} from "@/core/qualificacao/qualificacao.ts";
import {
  cleanLearned,
  cleanStyle,
  type LearnedRequirement,
  mergeReview,
  newLearned,
  type ReviewFinding,
  type ReviewResult,
  type RevokedNorm,
  reviewHeadline,
  revokedCitations,
  revokerIn,
} from "@/core/qualificacao/revisao.ts";
import {
  type ArticleCitation,
  articleCitations,
  baseSummary,
  learnWithoutAi,
  noteItems,
  unfoundedItems,
} from "@/core/qualificacao/revisao-base.ts";
import type { Database } from "@/db/index.ts";
import {
  knowledgePassages,
  qualificationDocumentReviews,
  qualificationLibrary,
  serviceRequestAttachments,
  serviceRequests,
} from "@/db/schema.ts";
import {
  AI_IMAGE_MAX_BYTES,
  AI_IMAGE_TYPES,
  AI_PDF_MAX_BYTES,
  AiError,
  type AiImageType,
  type NoteReviewInput,
  reviewRequirementDocument,
  type TitleFile,
} from "./ai.ts";
import { recordAuditWith } from "./audit.ts";
import { listSourcesWith, searchKnowledgeWith } from "./knowledge.ts";
import { readKnowledgeFiles } from "./knowledge-reading.ts";
import { readStoredFile } from "./uploads.ts";

/**
 * The review of the notes the team attaches to an exigência, and what the
 * office learns from them (decision of 16/11/2026: "aprenda com as notas
 * devolutivas que forem anexas externas… alerte o funcionário… a decisão
 * seja sempre do funcionário").
 */

export interface ReviewView {
  id: string;
  fileName: string;
  headline: string;
  result: ReviewResult;
  /** Why the AI did not read it; the base's check still ran. */
  aiError?: string;
  decision?: "manteve" | "alterou";
  learnedCount: number;
  learned: boolean;
}

type ReviewRow = typeof qualificationDocumentReviews.$inferSelect;

function resultOf(raw: unknown): ReviewResult {
  const r = (raw ?? {}) as Partial<ReviewResult>;
  return {
    recommendation: r.recommendation === "alterar" ? "alterar" : "manter",
    summary: typeof r.summary === "string" ? r.summary : "",
    findings: Array.isArray(r.findings) ? (r.findings as ReviewFinding[]) : [],
    learned: Array.isArray(r.learned)
      ? (r.learned as LearnedRequirement[])
      : [],
    style: Array.isArray(r.style)
      ? r.style.filter((s): s is string => typeof s === "string")
      : [],
    ...(r.via === "ia" || r.via === "base" ? { via: r.via } : {}),
  };
}

const toView = (row: ReviewRow): ReviewView => {
  const result = resultOf(row.result);
  return {
    id: row.id,
    fileName: row.fileName,
    headline: reviewHeadline(result),
    result,
    ...(row.aiError ? { aiError: row.aiError } : {}),
    ...(row.decision === "manteve" || row.decision === "alterou"
      ? { decision: row.decision }
      : {}),
    learnedCount: row.learnedCount,
    learned: Boolean(row.learnedAt),
  };
};

/** The tenant's attribution ("RI") as the qualificação's ("ri"). */
export function qualificationAttribution(
  value: string | null | undefined,
): Attribution | undefined {
  const key = (value ?? "").toLowerCase();
  return isAttribution(key) ? key : undefined;
}

/** The office's legal base, by norm: what is in force and what is revoked. */
interface BaseNorms {
  revoked: RevokedNorm[];
  inForce: { id: string; norm: NormRef; label: string }[];
}

async function baseNormsWith(
  database: Database,
  tenantSlug: string,
): Promise<BaseNorms> {
  const sources = await listSourcesWith(database, tenantSlug);
  const out: BaseNorms = { revoked: [], inForce: [] };
  for (const source of sources) {
    const norm = normOf(source.meta);
    if (!norm) continue;
    const label = source.meta.reference || source.meta.title;
    if (source.meta.status === "revogada") {
      const by = revokerIn(source.meta.notes ?? "");
      out.revoked.push({ norm, label, ...(by ? { by } : {}) });
    } else {
      out.inForce.push({ id: source.id, norm, label });
    }
  }
  return out;
}

/** What the office's legal base holds as revoked, by norm. */
export async function revokedNormsWith(
  database: Database,
  tenantSlug: string,
): Promise<RevokedNorm[]> {
  return (await baseNormsWith(database, tenantSlug)).revoked;
}

/**
 * Articles the note cites that the base holds as revoked inside a norm in
 * force ("Art. 9º (Revogado)"): certain, and with no credit spent.
 */
async function revokedArticlesWith(
  database: Database,
  tenantSlug: string,
  base: BaseNorms,
  citations: readonly ArticleCitation[],
): Promise<ReviewFinding[]> {
  const out: ReviewFinding[] = [];
  for (const citation of citations) {
    const source = base.inForce.find((s) => sameNorm(s.norm, citation.norm));
    if (!source) continue;
    const rows = await database
      .select({
        heading: knowledgePassages.heading,
        text: knowledgePassages.text,
      })
      .from(knowledgePassages)
      .where(
        and(
          eq(knowledgePassages.tenantSlug, tenantSlug),
          eq(knowledgePassages.sourceId, source.id),
          ilike(knowledgePassages.heading, `Art. ${citation.article}%`),
        ),
      )
      .limit(5);
    const exact = new RegExp(`^Art\\.?\\s*${citation.article}(?![\\d-])`, "i");
    const hit = rows.find(
      (r) => exact.test(r.heading) && isRevokedPassage(r.text),
    );
    if (!hit) continue;
    out.push({
      kind: "revogada",
      excerpt: citation.excerpt,
      problem: `A nota cita o art. ${citation.article} da ${source.label}, que a base jurídica da serventia traz como revogado.`,
      basis: `${source.label}, art. ${citation.article} (revogado, base jurídica da serventia).`,
      suggestion:
        "Confira o dispositivo que hoje trata do assunto e troque a citação, ou retire a exigência se ela não tiver mais fundamento.",
      source: "base",
    });
  }
  return out;
}

/** "Lei nº 6.015/1973": a cited norm, written back for the clerk. */
function normLabel(norm: NormRef): string {
  const kind = norm.kind.replace(/-/g, " ");
  // "6015" back to "6.015", as the norms are written.
  const number = norm.number.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${kind.charAt(0).toUpperCase()}${kind.slice(1)} nº ${number}${norm.year ? `/${norm.year}` : ""}`;
}

export function fileHashOf(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** The file as the AI takes it; null when it cannot (type or size). */
function titleFile(
  bytes: Uint8Array,
  name: string,
  mimeType: string,
): TitleFile | null {
  if (mimeType === "application/pdf") {
    return bytes.byteLength <= AI_PDF_MAX_BYTES
      ? { kind: "pdf", name, bytes }
      : null;
  }
  if (Object.hasOwn(AI_IMAGE_TYPES, mimeType)) {
    return bytes.byteLength <= AI_IMAGE_MAX_BYTES
      ? { kind: "image", name, bytes, mediaType: mimeType as AiImageType }
      : null;
  }
  return null;
}

/** The text the base's check reads (a scanned file has none: the AI reads it). */
async function plainText(
  bytes: Uint8Array,
  name: string,
  mimeType: string,
): Promise<string> {
  try {
    const report = await readKnowledgeFiles([
      new File([new Uint8Array(bytes)], name || "documento", {
        type: mimeType,
      }),
    ]);
    return report.documents.map((d) => d.markdown).join("\n\n");
  } catch {
    return "";
  }
}

export type Reviewer = (input: NoteReviewInput) => Promise<ReviewResult>;

/**
 * Reviews a document once per file: the office's base at once, the AI when
 * it may run. A file already reviewed answers from what was stored.
 */
export async function reviewDocumentWith(
  database: Database,
  tenantSlug: string,
  input: {
    bytes: Uint8Array;
    name: string;
    mimeType: string;
    requestId?: string;
    attribution?: Attribution;
    act?: string;
    actorId?: string;
    /** Null when the AI may not run here, with why. */
    aiBlocked: string | null;
    /**
     * "ia": the AI reads it (credit); "base": the office's legal base alone,
     * at once and with no credit (decision of 16/11/2026).
     */
    mode?: "ia" | "base";
  },
  reviewer: Reviewer = reviewRequirementDocument,
): Promise<ReviewView> {
  const fileHash = fileHashOf(input.bytes);
  const wantsAi = (input.mode ?? "ia") === "ia";
  const known = await reviewByHashWith(database, tenantSlug, fileHash);
  // Reviewed already: answered from what was stored, unless the AI may run
  // now and did not then (failed, or the office was on the base alone).
  if (known) {
    const before = resultOf(known.result);
    const aiRanThen = !known.aiError && before.via !== "base";
    if (aiRanThen || !wantsAi || input.aiBlocked) return toView(known);
  }

  const [text, norms] = await Promise.all([
    plainText(input.bytes, input.name, input.mimeType),
    baseNormsWith(database, tenantSlug),
  ]);
  const items = noteItems(text);
  const base = [
    ...revokedCitations(text, norms.revoked),
    ...(await revokedArticlesWith(
      database,
      tenantSlug,
      norms,
      articleCitations(items),
    )),
  ];

  let ai: ReviewResult | null = null;
  let aiError: string | null = wantsAi ? input.aiBlocked : null;
  const file = titleFile(input.bytes, input.name, input.mimeType);
  if (wantsAi && !aiError && !file) {
    aiError =
      "O Assistente Virtual lê PDF de até 30 MB e imagem de até 5 MB; este arquivo foi conferido só pela base jurídica.";
  }
  if (wantsAi && !aiError && file) {
    try {
      const [passages, library] = await Promise.all([
        searchKnowledgeWith(
          database,
          tenantSlug,
          (text || `${input.act ?? ""} exigência nota devolutiva`).slice(
            0,
            300,
          ),
          {
            ...(input.attribution ? { area: input.attribution } : {}),
            limit: 10,
          },
        ),
        input.attribution
          ? libraryTitlesWith(database, tenantSlug, input.attribution)
          : Promise.resolve([]),
      ]);
      ai = await reviewer({
        file,
        ...(input.attribution
          ? { attribution: ATTRIBUTIONS[input.attribution] }
          : {}),
        ...(input.act ? { act: input.act } : {}),
        revoked: norms.revoked.map((r) =>
          r.by ? `${r.label}, revogada por ${r.by}` : `${r.label}, revogada`,
        ),
        passages: passages.map((p) => ({
          reference: p.reference,
          heading: p.heading,
          text: p.text,
        })),
        library,
      });
    } catch (error) {
      aiError =
        error instanceof AiError
          ? error.message
          : "Não foi possível falar com o Assistente Virtual.";
      if (!(error instanceof AiError)) console.error("revisao.ai", error);
    }
  }

  // Without the AI, the base goes further on its own (no credit): what
  // has no fundamento, and the norms it could not check; and what is
  // learned comes from the note's own text.
  const extra = ai ? [] : unfoundedItems(items);
  const merged = mergeReview([...base, ...extra], ai);
  const inBase = [...norms.inForce, ...norms.revoked];
  const missing = ai
    ? []
    : normsIn(text)
        .filter((cited) => !inBase.some((n) => sameNorm(n.norm, cited)))
        .map(normLabel)
        .filter((label, i, all) => all.indexOf(label) === i);
  const result: ReviewResult = {
    ...merged,
    ...(ai ? {} : { summary: baseSummary(merged.findings, missing) }),
    learned: ai ? cleanLearned(merged.learned) : learnWithoutAi(text),
    style: cleanStyle(merged.style),
  };
  if (known) {
    await database
      .update(qualificationDocumentReviews)
      .set({ result, aiError })
      .where(eq(qualificationDocumentReviews.id, known.id));
    return toView({ ...known, result, aiError });
  }
  await database
    .insert(qualificationDocumentReviews)
    .values({
      tenantSlug,
      fileHash,
      fileName: input.name.slice(0, 300) || "documento",
      requestId: input.requestId ?? null,
      attribution: input.attribution ?? null,
      result,
      aiError,
      reviewedBy: input.actorId ?? null,
    })
    .onConflictDoNothing({
      target: [
        qualificationDocumentReviews.tenantSlug,
        qualificationDocumentReviews.fileHash,
      ],
    });
  const stored = await reviewByHashWith(database, tenantSlug, fileHash);
  if (!stored) throw new Error("revisão não gravada");
  return toView(stored);
}

async function reviewByHashWith(
  database: Database,
  tenantSlug: string,
  fileHash: string,
): Promise<ReviewRow | undefined> {
  const [row] = await database
    .select()
    .from(qualificationDocumentReviews)
    .where(
      and(
        eq(qualificationDocumentReviews.tenantSlug, tenantSlug),
        eq(qualificationDocumentReviews.fileHash, fileHash),
      ),
    )
    .limit(1);
  return row;
}

export async function getReviewWith(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<ReviewView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await database
    .select()
    .from(qualificationDocumentReviews)
    .where(
      and(
        eq(qualificationDocumentReviews.tenantSlug, tenantSlug),
        eq(qualificationDocumentReviews.id, id),
      ),
    )
    .limit(1);
  return row ? toView(row) : null;
}

/** Every title the attribution's library has, excluded ones too. */
async function libraryTitlesWith(
  database: Database,
  tenantSlug: string,
  attribution: Attribution,
): Promise<string[]> {
  const rows = await database
    .select({ title: qualificationLibrary.title })
    .from(qualificationLibrary)
    .where(
      and(
        eq(qualificationLibrary.tenantSlug, tenantSlug),
        eq(qualificationLibrary.attribution, attribution),
      ),
    );
  return rows.map((r) => r.title);
}

/**
 * The file was attached: the review points at it, and the clerk's call
 * after a warning goes to the audit (decision of 16/11/2026: the decision
 * is the clerk's, and it is recorded).
 */
export async function linkReviewWith(
  database: Database,
  tenantSlug: string,
  input: {
    reviewId: string;
    attachmentId: string;
    requestId: string;
    decision?: "manteve" | "alterou";
    actorId: string;
    protocolNumber?: string;
  },
): Promise<void> {
  const review = await getReviewWith(database, tenantSlug, input.reviewId);
  if (!review) return;
  await database
    .update(qualificationDocumentReviews)
    .set({
      attachmentId: sql`coalesce(${qualificationDocumentReviews.attachmentId}, ${input.attachmentId}::uuid)`,
      requestId: sql`coalesce(${qualificationDocumentReviews.requestId}, ${input.requestId}::uuid)`,
      ...(input.decision
        ? {
            decision: input.decision,
            decidedBy: input.actorId,
            decidedAt: new Date(),
          }
        : {}),
    })
    .where(eq(qualificationDocumentReviews.id, review.id));
  const count = review.result.findings.length;
  if (count > 0) {
    await recordAuditWith(database, {
      tenantSlug,
      actorId: input.actorId,
      action: "qualificacao.note-review-kept",
      targetType: "service-request",
      targetId: `${input.protocolNumber ?? input.requestId} · ${review.fileName}`,
      reason: `Enviou a nota mantendo-a depois do aviso: ${review.headline.toLowerCase()} (${review.result.findings
        .map((f) => f.problem)
        .join(" | ")
        .slice(0, 900)}).`,
    });
  }
}

/**
 * What the office learns from a reviewed note: its generic exigências go to
 * the library, marked "aprendida", never twice. Once per review.
 */
export async function learnFromReviewWith(
  database: Database,
  tenantSlug: string,
  reviewId: string,
  attribution?: Attribution,
): Promise<number> {
  const [row] = await database
    .select()
    .from(qualificationDocumentReviews)
    .where(
      and(
        eq(qualificationDocumentReviews.tenantSlug, tenantSlug),
        eq(qualificationDocumentReviews.id, reviewId),
      ),
    )
    .limit(1);
  if (!row || row.learnedAt) return row?.learnedCount ?? 0;
  const area = attribution ?? qualificationAttribution(row.attribution);
  let count = 0;
  if (area) {
    const fresh = newLearned(
      await libraryTitlesWith(database, tenantSlug, area),
      cleanLearned(resultOf(row.result).learned),
    );
    if (fresh.length) {
      await database.insert(qualificationLibrary).values(
        fresh.map((item) => ({
          tenantSlug,
          attribution: area,
          acts: [],
          title: item.title,
          description: item.description,
          howToComply: item.howToComply,
          basis: item.basis,
          origin: "aprendida",
          createdBy: "aprendizado",
        })),
      );
      count = fresh.length;
      await recordAuditWith(database, {
        tenantSlug,
        actorId: null,
        action: "qualificacao.library-learn",
        targetType: "qualification-library",
        targetId: `${count} exigência(s) de ${row.fileName}`,
      });
    }
  }
  await database
    .update(qualificationDocumentReviews)
    .set({
      learnedAt: new Date(),
      learnedCount: count,
      ...(area && !row.attribution ? { attribution: area } : {}),
    })
    .where(eq(qualificationDocumentReviews.id, row.id));
  return count;
}

/** The reviews of these attachments, by attachment id. */
export async function reviewsOfAttachmentsWith(
  database: Database,
  tenantSlug: string,
  attachmentIds: readonly string[],
): Promise<Map<string, ReviewView>> {
  if (!attachmentIds.length) return new Map();
  const rows = await database
    .select()
    .from(qualificationDocumentReviews)
    .where(
      and(
        eq(qualificationDocumentReviews.tenantSlug, tenantSlug),
        inArray(qualificationDocumentReviews.attachmentId, [...attachmentIds]),
      ),
    );
  return new Map(
    rows.flatMap((row) =>
      row.attachmentId ? [[row.attachmentId, toView(row)] as const] : [],
    ),
  );
}

/** How the office writes its notes, learned, for the AI to follow. */
export async function learnedStyleWith(
  database: Database,
  tenantSlug: string,
  attribution?: Attribution,
): Promise<string[]> {
  const rows = await database
    .select({ result: qualificationDocumentReviews.result })
    .from(qualificationDocumentReviews)
    .where(
      and(
        eq(qualificationDocumentReviews.tenantSlug, tenantSlug),
        attribution
          ? eq(qualificationDocumentReviews.attribution, attribution)
          : sql`true`,
      ),
    )
    .orderBy(desc(qualificationDocumentReviews.createdAt))
    .limit(20);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    for (const line of resultOf(row.result).style) {
      const key = line.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(line);
      if (out.length >= 8) return out;
    }
  }
  return out;
}

/** The office's documents of exigências already attached and not reviewed. */
function pendingCondition(tenantSlug: string) {
  return and(
    eq(serviceRequestAttachments.tenantSlug, tenantSlug),
    eq(serviceRequestAttachments.kind, "office"),
    or(
      isNotNull(serviceRequestAttachments.requirementId),
      isNotNull(serviceRequestAttachments.requirementMessageId),
    ),
    isNotNull(serviceRequestAttachments.path),
    inArray(serviceRequestAttachments.mimeType, [
      "application/pdf",
      ...Object.keys(AI_IMAGE_TYPES),
    ]),
    // Never reviewed, or reviewed without the AI (off or failing then).
    or(
      isNull(qualificationDocumentReviews.id),
      and(
        isNotNull(qualificationDocumentReviews.aiError),
        isNull(qualificationDocumentReviews.learnedAt),
      ),
    ),
  );
}

export async function pendingLearningCountWith(
  database: Database,
  tenantSlug: string,
): Promise<number> {
  const [row] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(serviceRequestAttachments)
    .leftJoin(
      qualificationDocumentReviews,
      eq(
        qualificationDocumentReviews.attachmentId,
        serviceRequestAttachments.id,
      ),
    )
    .where(pendingCondition(tenantSlug));
  return Number(row?.count ?? 0);
}

export interface LearnedExisting {
  review: ReviewView;
  protocolNumber: string;
  learned: number;
}

/**
 * The next note already attached that was never reviewed: reviewed and
 * learned now (decision of 16/11/2026: "se tiver algo já anexado nas
 * plataformas já pode aprender a partir de agora"). Null when none is left.
 */
export async function learnNextExistingWith(
  database: Database,
  tenantSlug: string,
  aiBlocked: string | null,
  reviewer: Reviewer = reviewRequirementDocument,
  /** "base": no AI and no credit (the office's choice). */
  mode: "ia" | "base" = "ia",
): Promise<LearnedExisting | null> {
  const [next] = await database
    .select({
      id: serviceRequestAttachments.id,
      requestId: serviceRequestAttachments.requestId,
      path: serviceRequestAttachments.path,
      mimeType: serviceRequestAttachments.mimeType,
      displayName: serviceRequestAttachments.displayName,
      protocolNumber: serviceRequests.protocolNumber,
      attribution: serviceRequests.attribution,
    })
    .from(serviceRequestAttachments)
    .innerJoin(
      serviceRequests,
      eq(serviceRequests.id, serviceRequestAttachments.requestId),
    )
    .leftJoin(
      qualificationDocumentReviews,
      eq(
        qualificationDocumentReviews.attachmentId,
        serviceRequestAttachments.id,
      ),
    )
    .where(pendingCondition(tenantSlug))
    .orderBy(serviceRequestAttachments.createdAt)
    .limit(1);
  if (!next?.path) return null;
  const bytes = new Uint8Array(await readStoredFile(next.path));
  const attribution = qualificationAttribution(next.attribution);
  const review = await reviewDocumentWith(
    database,
    tenantSlug,
    {
      bytes,
      name: next.displayName,
      mimeType: next.mimeType,
      requestId: next.requestId,
      ...(attribution ? { attribution } : {}),
      aiBlocked,
      mode,
    },
    reviewer,
  );
  // The AI failed now (busy, out of reach): nothing is linked, so the
  // next run tries this note again.
  if (mode === "ia" && review.aiError && !review.learned && !aiBlocked) {
    throw new AiError(review.aiError);
  }
  // Already sent: there is no decision to record, only the link.
  await database
    .update(qualificationDocumentReviews)
    .set({
      attachmentId: sql`coalesce(${qualificationDocumentReviews.attachmentId}, ${next.id}::uuid)`,
    })
    .where(eq(qualificationDocumentReviews.id, review.id));
  // A file reviewed before under another attachment still counts as done
  // for this one: the review answers for the same bytes.
  const linked = await reviewsOfAttachmentsWith(database, tenantSlug, [
    next.id,
  ]);
  if (!linked.has(next.id)) {
    await database.insert(qualificationDocumentReviews).values({
      tenantSlug,
      fileHash: `${fileHashOf(bytes)}:${next.id}`,
      fileName: next.displayName,
      requestId: next.requestId,
      attachmentId: next.id,
      attribution: attribution ?? null,
      result: review.result,
      aiError: review.aiError ?? null,
      learnedAt: new Date(),
    });
  }
  const learned = await learnFromReviewWith(
    database,
    tenantSlug,
    review.id,
    attribution,
  );
  return {
    review: (await getReviewWith(database, tenantSlug, review.id)) ?? review,
    protocolNumber: next.protocolNumber,
    learned,
  };
}
