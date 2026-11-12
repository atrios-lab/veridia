import assert from "node:assert/strict";
import { test } from "node:test";
import type { RequerimentoDocument } from "@/core/request/requerimento.ts";
import { TENANTS } from "@/core/tenant/resolve.ts";
import { brandFor } from "./document-brand.ts";
import { pdfTableText } from "./fee-tables.ts";
import { forDigitalSignature, renderDocument } from "./pdf.ts";

const doc: RequerimentoDocument = {
  eyebrow: "Teste",
  title: "Documento fictício",
  subtitle: "Para conferir a assinatura",
  office: ["Cartório Fictício"],
  sections: [{ heading: "Texto", paragraphs: ["Conteúdo fictício."] }],
  dateLine: "Cidade Exemplo/RN, 12 de novembro de 2026.",
  signee: "Fulana Fictícia de Tal",
  signature: ["Tabeliã fictícia"],
  footer: "Rodapé fictício",
};

const flat = (t: string) => t.replace(/\s+/g, " ");

test("impresso: linha e nome de quem assina à mão", async () => {
  const brand = await brandFor(TENANTS["cartorio-marinho"]);
  const text = flat(
    await pdfTableText(new Uint8Array(await renderDocument(doc, brand))),
  );
  assert.match(text, /Fulana Fictícia de Tal/);
  assert.doesNotMatch(text, /assinado digitalmente/);
});

test("assinatura digital: a nota formal no lugar da assinatura à mão", async () => {
  const brand = await brandFor(TENANTS["cartorio-marinho"]);
  const text = flat(
    await pdfTableText(
      new Uint8Array(
        await forDigitalSignature(() => renderDocument(doc, brand)),
      ),
    ),
  );
  assert.doesNotMatch(text, /Fulana Fictícia de Tal/);
  assert.doesNotMatch(text, /Tabeliã fictícia/);
  assert.match(
    text,
    /Documento assinado digitalmente com certificado ICP-Brasil/,
  );
  assert.match(text, /margem lateral/);
  assert.match(text, /12 de novembro de 2026/);
});
