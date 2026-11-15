import { and, eq, inArray } from "drizzle-orm";
import { metaFrom } from "@/core/conhecimento/base.ts";
import type { Database } from "@/db/index.ts";
import { knowledgePassages, knowledgeSources } from "@/db/schema.ts";
import { searchKnowledgeWith } from "../knowledge.ts";
import { type SourceView, sourceView } from "./assistant.ts";

/**
 * What the office itself taught the Assistente do DPO (decision of
 * 15/11/2026: "campo de ensinar e anexar documentos no DPO"): the passages
 * of its Base jurídica on data protection (area "Proteção de dados", or
 * meant for every area), next to the platform's fixed base of norms. The
 * model cites them as `[[fonte:kb-<passage id>]]`.
 */

export interface OfficeExcerpt {
  id: string;
  citation: string;
  sourceName: string;
  text: string;
}

const PREFIX = "kb-";
const EXCERPTS = 5;

export async function officeExcerptsWith(
  database: Database,
  tenantSlug: string,
  query: string,
  limit = EXCERPTS,
): Promise<OfficeExcerpt[]> {
  const hits = await searchKnowledgeWith(database, tenantSlug, query, {
    area: "lgpd",
    limit,
  }).catch(() => []);
  return hits
    .filter((h) => h.passageId)
    .map((h) => ({
      id: `${PREFIX}${h.passageId}`,
      citation: [h.reference || h.title, h.heading].filter(Boolean).join(", "),
      sourceName: h.title || h.reference || "Base jurídica da serventia",
      text: h.text.slice(0, 2500),
    }));
}

/** The office's excerpts for the model, after the platform's base. */
export function formatOfficeExcerpts(excerpts: readonly OfficeExcerpt[]) {
  if (excerpts.length === 0) return "";
  return `\n\nBASE DA SERVENTIA (documentos que a própria serventia enviou à Base jurídica; use e cite do mesmo jeito)\n${excerpts
    .map(
      (e) =>
        `<trecho id="${e.id}" citacao="${e.citation}" fonte="${e.sourceName}">\n${e.text}\n</trecho>`,
    )
    .join("\n\n")}`;
}

export const officeView = (e: OfficeExcerpt): SourceView => ({
  id: e.id,
  citation: e.citation,
  sourceName: e.sourceName,
  guidance: false,
  text: e.text,
});

/**
 * Every cited source, the platform's and the office's, for a stored
 * answer: the office's are read back from its Base jurídica.
 */
export async function sourceViewsWith(
  database: Database,
  tenantSlug: string,
  ids: readonly string[],
): Promise<SourceView[]> {
  const passageIds = ids
    .filter((id) => id.startsWith(PREFIX))
    .map((id) => id.slice(PREFIX.length))
    .filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  const office = new Map<string, SourceView>();
  if (passageIds.length) {
    const rows = await database
      .select({
        id: knowledgePassages.id,
        heading: knowledgePassages.heading,
        text: knowledgePassages.text,
        meta: knowledgeSources.meta,
      })
      .from(knowledgePassages)
      .innerJoin(
        knowledgeSources,
        eq(knowledgeSources.id, knowledgePassages.sourceId),
      )
      .where(
        and(
          eq(knowledgePassages.tenantSlug, tenantSlug),
          inArray(knowledgePassages.id, passageIds),
        ),
      );
    for (const row of rows) {
      const meta = metaFrom(row.meta);
      office.set(
        `${PREFIX}${row.id}`,
        officeView({
          id: `${PREFIX}${row.id}`,
          citation: [meta.reference || meta.title, row.heading]
            .filter(Boolean)
            .join(", "),
          sourceName:
            meta.title || meta.reference || "Base jurídica da serventia",
          text: row.text.slice(0, 2500),
        }),
      );
    }
  }
  return ids
    .map((id) => office.get(id) ?? sourceView(id))
    .filter((s): s is SourceView => s !== null);
}
