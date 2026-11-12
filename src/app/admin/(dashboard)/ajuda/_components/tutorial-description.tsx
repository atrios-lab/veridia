import { Fragment } from "react";

/** Render plain text and WhatsApp/Markdown bold without accepting HTML. */
export function TutorialDescription({ text }: { text: string }) {
  const paragraphs = text.trim().split(/\r?\n\s*\r?\n/);

  return (
    <div className="max-w-prose space-y-4 text-sm leading-relaxed text-muted-foreground">
      {paragraphs.map((paragraph, index) => (
        // Descriptions are static text; positions remain stable until replaced.
        // biome-ignore lint/suspicious/noArrayIndexKey: paragraphs have no independent state.
        <p key={index} className="whitespace-pre-line break-words">
          {paragraph
            .split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g)
            .map((part, partIndex) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: inline text has no independent state.
              <Fragment key={partIndex}>
                {/^\*\*[^*\n]+\*\*$/.test(part) ? (
                  <strong className="font-semibold text-foreground">
                    {part.slice(2, -2)}
                  </strong>
                ) : /^\*[^*\n]+\*$/.test(part) ? (
                  <strong className="font-semibold text-foreground">
                    {part.slice(1, -1)}
                  </strong>
                ) : (
                  part
                )}
              </Fragment>
            ))}
        </p>
      ))}
    </div>
  );
}
