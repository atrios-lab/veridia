import type { RequerimentoDocument } from "../request/requerimento.ts";
import { writtenDate } from "../scheduling/attendance.ts";
import { officialName } from "../tenant/identification.ts";
import type { Tenant } from "../tenant/schema.ts";

/**
 * A document the Assistente do DPO drafted in the conversation, ready to
 * download (decision of 15/11/2026: "o texto deve sair pronto e botão de
 * baixar"): under the office's letterhead, dated, for the encarregado to
 * sign digitally or print and sign.
 */

/** The part after a line with only "---": the drafted document. */
export function documentPart(text: string): string {
  const match = text.match(/\n-{3,}\s*\n/);
  if (!match || match.index === undefined) return "";
  return text.slice(match.index + match[0].length).trim();
}

const DEFAULT_TITLE = "Documento do encarregado de dados";

/** Light markdown out: the PDF prints plain paragraphs. */
const plain = (line: string) =>
  line
    .replace(/^#{1,6}\s+/, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .trim();

export function buildDpoDocument(
  tenant: Tenant,
  input: { text: string; issuedOn: string },
): RequerimentoDocument {
  const lines = input.text.replace(/\r\n?/g, "\n").split("\n");
  // A short first line without a full stop is the document's own title.
  const first = plain(lines[0] ?? "");
  const hasTitle =
    first.length > 0 && first.length <= 120 && !/[.:;,]$/.test(first);
  const body = (hasTitle ? lines.slice(1) : lines).join("\n");
  const paragraphs = body
    .split(/\n\s*\n/)
    .flatMap((block) => {
      const blockLines = block.split("\n").map(plain).filter(Boolean);
      // A list keeps one item per paragraph; prose joins its lines.
      return blockLines.some((l) => /^[-•]\s/.test(l))
        ? blockLines.map((l) => l.replace(/^[-•]\s+/, "• "))
        : [blockLines.join(" ")];
    })
    .filter(Boolean);
  return {
    eyebrow: "Lei Geral de Proteção de Dados Pessoais",
    title: hasTitle ? first : DEFAULT_TITLE,
    subtitle: `Encarregado(a) pelo tratamento de dados pessoais · ${writtenDate(input.issuedOn as Parameters<typeof writtenDate>[0])}`,
    office: [officialName(tenant), tenant.subtitle],
    sections: [
      {
        heading: "Texto",
        paragraphs: paragraphs.length ? paragraphs : ["(Sem texto.)"],
      },
    ],
    dateLine: `${tenant.location.city}/${tenant.location.state}, ${writtenDate(input.issuedOn as Parameters<typeof writtenDate>[0])}.`,
    signee: tenant.dpo.name || tenant.holderName || officialName(tenant),
    signature: ["Encarregado(a) pelo tratamento de dados pessoais"],
    footer: `${officialName(tenant)} · ${tenant.legalFooter}`,
  };
}
