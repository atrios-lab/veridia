import type { RequerimentoSection } from "../request/requerimento.ts";

/**
 * A document kept only as Markdown (the original PDF or Word discarded
 * after the reading, to save space) back as the sections of a PDF: the
 * headings ("#") open sections, the rest are paragraphs, the bold and the
 * list marks are taken off. The text is the same; only the look is
 * rebuilt.
 */
export function markdownSections(markdown: string): RequerimentoSection[] {
  const sections: RequerimentoSection[] = [];
  let current: RequerimentoSection = { heading: "", paragraphs: [] };
  let buffer: string[] = [];
  const clean = (line: string) =>
    line
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/__(.+?)__/g, "$1")
      .replace(/^\s*[-*+]\s+/, "")
      .replace(/^\s*>\s?/, "")
      .replace(/`/g, "")
      .trim();
  const flush = () => {
    const text = buffer.map(clean).filter(Boolean).join(" ");
    if (text) current.paragraphs = [...(current.paragraphs ?? []), text];
    buffer = [];
  };
  for (const line of markdown.replace(/\r/g, "").split("\n")) {
    const heading = /^\s*#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      if (current.heading || current.paragraphs?.length) sections.push(current);
      current = { heading: clean(heading[1] ?? ""), paragraphs: [] };
    } else if (!line.trim() || /^\s*[-*+]\s+/.test(line)) {
      flush();
      if (line.trim()) buffer.push(line);
    } else {
      buffer.push(line);
    }
  }
  flush();
  if (current.heading || current.paragraphs?.length) sections.push(current);
  return sections;
}

/** What the original was, in words: "PDF", "Word", "imagem". */
export function originalKind(mime: string, name: string): string {
  if (mime === "application/pdf" || /\.pdf$/i.test(name)) return "PDF";
  if (/word|officedocument/.test(mime) || /\.docx?$/i.test(name)) return "Word";
  if (mime.startsWith("image/")) return "imagem";
  return "arquivo";
}
