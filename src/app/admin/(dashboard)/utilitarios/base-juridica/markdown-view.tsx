import type { ReactNode } from "react";

/** "**§ 1º** texto" → the bold parts as <strong>, the rest as text. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: fixed split of one line
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      part
    ),
  );
}

/**
 * The Markdown kept in the base, shown as it reads: headings, lists and
 * bold. Plain elements only; nothing from the text is read as HTML.
 */
export function MarkdownView({ text }: { text: string }) {
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  return (
    <div className="flex flex-col gap-2 text-sm leading-relaxed text-foreground text-justify hyphens-auto">
      {lines.map((line, i) => {
        const key = `${i}-${line.slice(0, 12)}`;
        if (line.startsWith("<!--")) return null;
        const heading = /^(#{1,4})\s+(.*)$/.exec(line);
        if (heading) {
          const size = ["text-lg", "text-base", "text-sm", "text-sm"][
            (heading[1]?.length ?? 1) - 1
          ];
          return (
            <p key={key} className={`mt-2 font-semibold ${size}`}>
              {inline(heading[2] ?? "")}
            </p>
          );
        }
        const item = /^(\s*)- (.*)$/.exec(line);
        if (item) {
          return (
            <p
              key={key}
              className={(item[1]?.length ?? 0) > 0 ? "pl-10" : "pl-5"}
            >
              {inline(item[2] ?? "")}
            </p>
          );
        }
        return <p key={key}>{inline(line)}</p>;
      })}
    </div>
  );
}
