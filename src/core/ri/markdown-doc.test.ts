import assert from "node:assert/strict";
import { test } from "node:test";
import { markdownSections, originalKind } from "./markdown-doc.ts";

test("the Markdown comes back as headings and paragraphs", () => {
  const sections = markdownSections(
    "# CÉDULA RURAL\n\n**Emitente:** Pessoa Exemplo\n\n## Garantias\n- Penhor de 10 bovinos\n- Penhor de 1 trator\n",
  );
  assert.deepEqual(sections, [
    { heading: "CÉDULA RURAL", paragraphs: ["Emitente: Pessoa Exemplo"] },
    {
      heading: "Garantias",
      paragraphs: ["Penhor de 10 bovinos", "Penhor de 1 trator"],
    },
  ]);
  assert.equal(originalKind("application/pdf", "x"), "PDF");
  assert.equal(originalKind("", "ficha.docx"), "Word");
});
