import assert from "node:assert/strict";
import { test } from "node:test";
import {
  articleIn,
  type Candidate,
  emptyMeta,
  isOfficialUrl,
  metaProblems,
  rankPassages,
  searchTerms,
  splitPassages,
  textFromHtml,
  toMarkdown,
} from "./base.ts";

// A short page in the shape of the Planalto's compiled laws (fictitious
// wording; the struck-through passage is the revoked one).
const HTML = `<html><head><style>p{}</style></head><body>
<p>LEI FICTÍCIA Nº 1, DE 2026</p>
<p>Art. 1&ordm; Esta lei trata dos registros fict&iacute;cios.</p>
<p><strike>Art. 2&ordm; Prazo de trinta dias.</strike></p>
<p>Art. 2&ordm; O prazo &eacute; de vinte dias. (Reda&ccedil;&atilde;o dada pela Lei fict&iacute;cia n&ordm; 2)</p>
<p>Art. 3&ordm; As exig&ecirc;ncias ser&atilde;o formuladas de uma s&oacute; vez, por escrito.</p>
<p>(Revogado)</p>
</body></html>`;

test("o texto da página oficial sai sem os trechos riscados como revogados", () => {
  const text = textFromHtml(HTML);
  assert.match(text, /Art\. 1º Esta lei trata dos registros fictícios\./);
  assert.match(text, /O prazo é de vinte dias/);
  assert.doesNotMatch(text, /trinta dias/);
  assert.doesNotMatch(text, /^\(Revogado\)$/m);
  assert.doesNotMatch(text, /p\{\}/);
});

test("a norma é dividida por artigo, e um texto corrido por trechos", () => {
  const passages = splitPassages(textFromHtml(HTML));
  assert.deepEqual(
    passages.map((p) => p.heading),
    ["Preâmbulo", "Art. 1º", "Art. 2º", "Art. 3º"],
  );
  const prose = splitPassages(
    `${"Parágrafo de modelo. ".repeat(60)}\n\n${"Outro trecho. ".repeat(80)}`,
  );
  assert.ok(prose.length >= 2);
  assert.ok(prose.every((p) => p.text.length <= 4000));
});

test("a pesquisa acha o artigo e põe a lei antes do modelo; fonte revogada fica de fora", () => {
  const base = (over: Partial<Candidate>): Candidate => ({
    sourceId: "x",
    kind: "lei",
    status: "vigente",
    reference: "Lei fictícia nº 1/2026",
    title: "Lei fictícia",
    heading: "Art. 3º",
    text: "As exigências serão formuladas de uma só vez, por escrito.",
    ...over,
  });
  const hits = rankPassages("exigências de uma só vez", [
    base({
      sourceId: "modelo",
      kind: "modelo-externo",
      heading: "Modelo",
      text: "Formule as exigências de uma só vez.",
    }),
    base({ sourceId: "lei" }),
    base({ sourceId: "velha", status: "revogada" }),
  ]);
  assert.deepEqual(
    hits.map((h) => h.sourceId),
    ["lei", "modelo"],
  );
  assert.equal(articleIn("o que diz o art. 198?"), "198");
  assert.equal(articleIn("artigo 1.245 do Código Civil"), "1.245");
  const byArticle = rankPassages("art. 2", [
    base({ heading: "Art. 2º", text: "Prazo." }),
    base({ sourceId: "y" }),
  ]);
  assert.equal(byArticle[0]?.heading, "Art. 2º");
  assert.deepEqual(searchTerms("De uma só vez, nas exigências"), [
    "vez",
    "exigencias",
  ]);
});

test("fonte precisa de título; endereço oficial só dos sites oficiais", () => {
  assert.deepEqual(metaProblems({ ...emptyMeta(), title: "" }), [
    "Dê um título à fonte.",
  ]);
  assert.equal(
    isOfficialUrl(
      "https://www.planalto.gov.br/ccivil_03/leis/l6015compilada.htm",
    ),
    true,
  );
  assert.equal(
    isOfficialUrl("https://atos.cnj.jus.br/atos/detalhar/5243"),
    true,
  );
  assert.equal(isOfficialUrl("https://www.tjsp.jus.br/Corregedoria"), true);
  assert.equal(isOfficialUrl("https://jus.br.exemplo.com/x"), false);
  assert.equal(
    isOfficialUrl(
      "https://normas.leg.br/?urn=urn:lex:br:federal:lei:1973-12-31;6015",
    ),
    true,
  );
  assert.equal(isOfficialUrl("https://exemplo.leg.br.com/x"), false);
  assert.equal(isOfficialUrl("http://www.planalto.gov.br/x"), false);
  assert.equal(isOfficialUrl("https://exemplo.com/lei"), false);
});

test("o documento vira Markdown: artigos como títulos, parágrafos em negrito, incisos em lista", () => {
  const md = toMarkdown(
    [
      "CAPÍTULO I",
      "DAS DISPOSIÇÕES FICTÍCIAS",
      "Art. 10. O oficial qualificará o título.",
      "§ 1º A exigência será fundamentada.",
      "Parágrafo único. Vale para todos os atos.",
      "I \u2013 o prazo;",
      "a) a forma;",
      "Texto corrido de um modelo.",
    ].join("\n"),
    "Lei fictícia",
  );
  assert.equal(
    md,
    [
      "# Lei fictícia",
      "### CAPÍTULO I",
      "DAS DISPOSIÇÕES FICTÍCIAS",
      "## Art. 10",
      "O oficial qualificará o título.",
      "**§ 1º** A exigência será fundamentada.",
      "**Parágrafo único.** Vale para todos os atos.",
      "- I \u2013 o prazo;",
      "  - a) a forma;",
      "Texto corrido de um modelo.",
    ].join("\n\n"),
  );
  // The Markdown is split by article like the plain text.
  const passages = splitPassages(toMarkdown(textFromHtml(HTML)));
  assert.deepEqual(
    passages.map((p) => p.heading),
    ["Preâmbulo", "Art. 1º", "Art. 2º", "Art. 3º"],
  );
  assert.match(passages[1]?.text ?? "", /^## Art\. 1º/);
});
