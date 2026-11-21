import assert from "node:assert/strict";
import { test } from "node:test";
import PDFDocument from "pdfkit";
import { pdfText } from "./guide-reading.ts";

/** A small PDF with fictitious text, made in memory. */
function samplePdf(text: string): Promise<Uint8Array> {
  return new Promise((resolve) => {
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
    doc.text(text);
    doc.end();
  });
}

test("ler o texto do PDF não estraga o arquivo: o Assistente Virtual lê o mesmo depois", async () => {
  const bytes = await samplePdf("CÉDULA RURAL HIPOTECÁRIA Nº 1 (fictícia)");
  const size = bytes.byteLength;
  const text = await pdfText(bytes);
  assert.match(text, /HIPOTEC/);
  // The bytes were not detached: the same file can be sent on.
  assert.equal(bytes.byteLength, size);
  assert.equal(Buffer.from(bytes).subarray(0, 4).toString(), "%PDF");
  assert.match(await pdfText(bytes), /HIPOTEC/);
});
