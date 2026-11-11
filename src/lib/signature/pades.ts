import "server-only";
import { createHash } from "node:crypto";
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  type PDFObject,
  PDFRef,
  PDFStream,
  PDFString,
} from "pdf-lib";
import type { OpenedCertificate } from "./certificate.ts";
import { buildSignedData } from "./cms.ts";
import { bandAppearancePage, bandRect } from "./stamp.ts";

/**
 * A PAdES signature added to a PDF as an incremental update (ISO 32000-1,
 * 7.5.6): the bytes already there are never touched, so a PDF signed before
 * (here or anywhere) keeps every earlier signature valid, and a second
 * signer is one more update on top. pdf-lib only reads the document (it
 * handles both classic and stream cross-references); the new objects are
 * written by hand after the end of the file.
 */

/** Room for the CMS: an ICP-Brasil chain is long; 32 KB of DER is ample. */
const CONTENTS_BYTES = 32_768;
const BYTE_RANGE_PLACEHOLDER =
  "/ByteRange [0 /********** /********** /**********]";

export class PdfNotSignableError extends Error {}

function lastStartXref(pdf: Buffer): number {
  const tail = pdf.subarray(Math.max(0, pdf.length - 2048)).toString("latin1");
  const match = /startxref\s+(\d+)\s*%%EOF\s*$/.exec(tail);
  if (!match) throw new PdfNotSignableError("PDF sem fim de arquivo válido.");
  return Number(match[1]);
}

/** Whether the PDF already carries a signature (here or elsewhere). */
export function hasSignature(pdf: Buffer): boolean {
  return /\/ByteRange\s*\[/.test(pdf.toString("latin1"));
}

export interface PlaceholderInput {
  signerName: string;
  reason: string;
  location: string;
  signingTime: Date;
  /**
   * Shows this signature on the first page (band and QR) as the widget's
   * appearance: for a PDF already signed elsewhere, whose pages cannot be
   * drawn on without breaking that signature. Absent, the widget is
   * invisible (the band was drawn on the pages before signing).
   */
  visible?: {
    code: string;
    verifyUrl: string;
    signer: { name: string; at: string };
    office: string;
  };
}

const text = (value: string) => PDFHexString.fromText(value);

/** The PDF with an empty signature field appended, ready for the CMS. */
export async function addSignaturePlaceholder(
  original: Buffer,
  input: PlaceholderInput,
): Promise<Buffer> {
  const doc = await PDFDocument.load(original, { updateMetadata: false });
  if (doc.isEncrypted) {
    throw new PdfNotSignableError(
      "PDF protegido por senha não pode ser assinado.",
    );
  }
  const context = doc.context;
  const rootRef = context.trailerInfo.Root as PDFRef | undefined;
  if (!(rootRef instanceof PDFRef)) {
    throw new PdfNotSignableError("PDF sem catálogo de objetos.");
  }
  const page = doc.getPage(0);
  // Everything created from here on is new and goes into the update.
  const firstNew = context.largestObjectNumber + 1;
  const changed = new Map<number, { ref: PDFRef; body: string }>();
  const put = (ref: PDFRef, body: string) =>
    changed.set(ref.objectNumber, { ref, body });

  // 1. The signature value, written by hand: ByteRange and Contents must
  //    be found and filled in later at fixed widths.
  const sigRef = context.nextRef();
  put(
    sigRef,
    [
      "<<",
      "/Type /Sig",
      "/Filter /Adobe.PPKLite",
      "/SubFilter /ETSI.CAdES.detached",
      BYTE_RANGE_PLACEHOLDER,
      `/Contents <${"0".repeat(CONTENTS_BYTES * 2)}>`,
      `/M ${PDFString.fromDate(input.signingTime).toString()}`,
      `/Name ${text(input.signerName).toString()}`,
      `/Reason ${text(input.reason).toString()}`,
      `/Location ${text(input.location).toString()}`,
      ">>",
    ].join("\n"),
  );

  // 2. The field and its (invisible) widget on the first page.
  const acroForm = doc.catalog.lookup(PDFName.of("AcroForm"));
  const existingFields =
    acroForm instanceof PDFDict
      ? (acroForm.lookup(PDFName.of("Fields")) as PDFArray | undefined)
      : undefined;
  const count = (existingFields?.size() ?? 0) + 1;
  const widgetRef = context.nextRef();
  let rect = [0, 0, 0, 0];
  let appearanceRef: PDFRef | undefined;
  if (input.visible) {
    const {
      doc: drawn,
      page: blank,
      view,
    } = await bandAppearancePage(page, input.visible);
    await drawn.flush();
    const embedded = await doc.embedPage(blank);
    await embedded.embed();
    rect = bandRect(view);
    appearanceRef = context.register(
      context.stream("q /Band Do Q", {
        Type: "XObject",
        Subtype: "Form",
        BBox: rect,
        Resources: { XObject: { Band: embedded.ref } },
      }),
    );
  }
  const widget = context.obj({
    Type: "Annot",
    Subtype: "Widget",
    FT: "Sig",
    T: PDFString.of(`Assinatura ${count}`),
    V: sigRef,
    F: 132,
    Rect: rect,
    P: page.ref,
    ...(appearanceRef ? { AP: { N: appearanceRef } } : {}),
  });
  put(widgetRef, widget.toString());
  // The appearance's own objects: the band as a form, its fonts and QR.
  for (const [ref, object] of context.enumerateIndirectObjects()) {
    if (ref.objectNumber < firstNew || changed.has(ref.objectNumber)) continue;
    if (object instanceof PDFStream) object.updateDict();
    put(ref, object.toString());
  }

  // 3. The page lists the widget among its annotations.
  const annotsRaw = page.node.get(PDFName.of("Annots"));
  if (annotsRaw instanceof PDFRef) {
    const annots = context.lookup(annotsRaw, PDFArray);
    const copy = PDFArray.withContext(context);
    for (let i = 0; i < annots.size(); i++) copy.push(annots.get(i));
    copy.push(widgetRef);
    put(annotsRaw, copy.toString());
  } else {
    const copy = PDFArray.withContext(context);
    if (annotsRaw instanceof PDFArray) {
      for (let i = 0; i < annotsRaw.size(); i++) copy.push(annotsRaw.get(i));
    }
    copy.push(widgetRef);
    const pageDict = page.node.clone(context);
    pageDict.set(PDFName.of("Annots"), copy);
    put(page.ref, pageDict.toString());
  }

  // 4. The form: the earlier fields kept, this one added, signatures on.
  const fields = PDFArray.withContext(context);
  if (existingFields) {
    for (let i = 0; i < existingFields.size(); i++) {
      fields.push(existingFields.get(i));
    }
  }
  fields.push(widgetRef);
  const formRaw = doc.catalog.get(PDFName.of("AcroForm"));
  const form =
    acroForm instanceof PDFDict ? acroForm.clone(context) : context.obj({});
  form.set(PDFName.of("Fields"), fields);
  form.set(PDFName.of("SigFlags"), PDFNumber.of(3));
  if (formRaw instanceof PDFRef) {
    put(formRaw, form.toString());
  } else {
    const formRef = context.nextRef();
    put(formRef, form.toString());
    const catalog = doc.catalog.clone(context);
    catalog.set(PDFName.of("AcroForm"), formRef);
    put(rootRef, catalog.toString());
  }

  // 5. The update: objects, cross-reference table, trailer.
  const prev = lastStartXref(original);
  const head = original[original.length - 1] === 0x0a ? "" : "\n";
  let offset = original.length + head.length;
  const parts: string[] = [head];
  const entries: { num: number; gen: number; offset: number }[] = [];
  for (const { ref, body } of [...changed.values()].sort(
    (a, b) => a.ref.objectNumber - b.ref.objectNumber,
  )) {
    const chunk = `${ref.objectNumber} ${ref.generationNumber} obj\n${body}\nendobj\n`;
    entries.push({
      num: ref.objectNumber,
      gen: ref.generationNumber,
      offset,
    });
    parts.push(chunk);
    offset += Buffer.byteLength(chunk, "latin1");
  }
  const xrefOffset = offset;
  const xref = ["xref"];
  for (const entry of entries) {
    xref.push(
      `${entry.num} 1`,
      `${String(entry.offset).padStart(10, "0")} ${String(entry.gen).padStart(5, "0")} n\r`,
    );
  }
  const trailer = context.obj({
    Size: context.largestObjectNumber + 1,
    Root: rootRef,
    Prev: prev,
  }) as PDFDict;
  const info = context.trailerInfo.Info as PDFObject | undefined;
  if (info) trailer.set(PDFName.of("Info"), info);
  const id = context.trailerInfo.ID as PDFObject | undefined;
  if (id) trailer.set(PDFName.of("ID"), id);
  parts.push(
    `${xref.join("\n")}\ntrailer\n${trailer.toString()}\nstartxref\n${xrefOffset}\n%%EOF\n`,
  );
  return Buffer.concat([original, Buffer.from(parts.join(""), "latin1")]);
}

/** The bytes the signature covers: everything but the /Contents value. */
export function signedRanges(pdf: Buffer): {
  byteRange: [number, number, number, number];
  covered: Buffer;
} {
  const latin = pdf.toString("latin1");
  const at = latin.lastIndexOf(BYTE_RANGE_PLACEHOLDER);
  if (at < 0)
    throw new PdfNotSignableError("Campo de assinatura não encontrado.");
  const contentsStart = latin.indexOf("/Contents <", at) + "/Contents ".length;
  const contentsEnd = latin.indexOf(">", contentsStart) + 1;
  const byteRange: [number, number, number, number] = [
    0,
    contentsStart,
    contentsEnd,
    pdf.length - contentsEnd,
  ];
  return {
    byteRange,
    covered: Buffer.concat([
      pdf.subarray(0, contentsStart),
      pdf.subarray(contentsEnd),
    ]),
  };
}

/**
 * Writes the ByteRange over the placeholder (same width) and answers the
 * SHA-256 of what it covers: the digest a signature commits to. The PDF
 * waits like this, /Contents still zeros, until a CMS comes back.
 */
export function prepareSignature(withPlaceholder: Buffer): {
  pdf: Buffer;
  digest: Buffer;
} {
  const pdf = Buffer.from(withPlaceholder);
  const latin = pdf.toString("latin1");
  const at = latin.lastIndexOf(BYTE_RANGE_PLACEHOLDER);
  if (at < 0)
    throw new PdfNotSignableError("Campo de assinatura não encontrado.");
  const { byteRange } = signedRanges(pdf);
  const written = `/ByteRange [${byteRange.join(" ")}]`;
  if (written.length > BYTE_RANGE_PLACEHOLDER.length) {
    throw new PdfNotSignableError("PDF grande demais para assinar.");
  }
  pdf.write(written.padEnd(BYTE_RANGE_PLACEHOLDER.length, " "), at, "latin1");
  return { pdf, digest: preparedDigest(pdf) };
}

/** The ByteRange a prepared PDF carries, read back from the file. */
function writtenByteRange(prepared: Buffer): [number, number, number, number] {
  const latin = prepared.toString("latin1");
  const match = latin
    .slice(latin.lastIndexOf("/ByteRange ["))
    .match(/^\/ByteRange \[(\d+) (\d+) (\d+) (\d+)\]/);
  if (!match) {
    throw new PdfNotSignableError("Campo de assinatura não encontrado.");
  }
  const [a, b, c, d] = match.slice(1).map(Number);
  // The ranges must cover the whole file but the /Contents value.
  if (a !== 0 || c + d !== prepared.length || b >= c) {
    throw new PdfNotSignableError("Campo de assinatura não encontrado.");
  }
  return [a, b, c, d];
}

/** The digest of a prepared PDF, read again from its ByteRange. */
export function preparedDigest(prepared: Buffer): Buffer {
  const [, end, start] = writtenByteRange(prepared);
  return createHash("sha256")
    .update(prepared.subarray(0, end))
    .update(prepared.subarray(start))
    .digest();
}

/** Puts the CMS in the prepared PDF's /Contents. */
export function embedSignature(prepared: Buffer, cms: Buffer): Buffer {
  const pdf = Buffer.from(prepared);
  const [, contentsStart] = writtenByteRange(pdf);
  const hex = cms.toString("hex");
  if (hex.length > CONTENTS_BYTES * 2) {
    throw new PdfNotSignableError("Cadeia do certificado longa demais.");
  }
  pdf.write(hex.padEnd(CONTENTS_BYTES * 2, "0"), contentsStart + 1, "latin1");
  return pdf;
}

/**
 * Signs the placeholder: writes the ByteRange (same width as the
 * placeholder), hashes what it covers, and puts the CMS in /Contents.
 */
export function signPlaceholder(
  withPlaceholder: Buffer,
  certificate: OpenedCertificate,
): Buffer {
  const { pdf, digest } = prepareSignature(withPlaceholder);
  return embedSignature(pdf, buildSignedData(digest, certificate));
}

/** Placeholder and signature in one step. */
export async function signPdf(
  pdf: Buffer,
  certificate: OpenedCertificate,
  input: PlaceholderInput,
): Promise<Buffer> {
  return signPlaceholder(
    await addSignaturePlaceholder(pdf, input),
    certificate,
  );
}
