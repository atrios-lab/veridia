import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import JSZip from "jszip";
import { PDFDocument, StandardFonts } from "pdf-lib";
import sharp from "sharp";
import type { Database } from "@/db/index.ts";
import { riOnrImages } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  currentOf,
  listOnrImagesWith,
  onrZipWith,
  setCopiedWith,
  setOnrImageDeletedWith,
} from "./ri-onr-images.ts";
import { pdfToOnrTiff } from "./ri-tiff.ts";

let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

// Fictitious data only (LGPD).
const TENANT = "cartorio-teste-ri-imagens";
const ACTOR = { id: "u-oficial" };

/** The Compression tag (259) of the first IFD of a TIFF. */
function compressionOf(tiff: Buffer): number {
  const le = tiff.toString("latin1", 0, 2) === "II";
  const u16 = (o: number) => (le ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o));
  const u32 = (o: number) => (le ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o));
  const ifd = u32(4);
  for (let i = 0; i < u16(ifd); i++) {
    const at = ifd + 2 + i * 12;
    if (u16(at) === 259) return u16(at + 8);
  }
  return 0;
}

async function samplePdf(lines: string[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const page = pdf.addPage([595.28, 841.89]);
  lines.forEach((text, i) => {
    page.drawText(text, { x: 60, y: 780 - i * 16, size: 12, font });
  });
  return pdf.save();
}

test("the PDF becomes the TIFF of the manual, signed under the last line", async () => {
  const pdf = await samplePdf([
    "REGISTRO GERAL - MATRICULA N. 5",
    "Imovel urbano na Rua Exemplo, 10.",
    "R-1-5. Compra e venda a Pessoa Exemplo.",
  ]);
  const signature = await sharp({
    create: {
      width: 300,
      height: 80,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  const out = await pdfToOnrTiff(pdf, signature);
  assert.equal(out.pages, 1);
  assert.equal(out.signed, true);
  assert.equal(out.noRoom, false);
  assert.match(out.text, /MATRICULA N\. 5/);
  const meta = await sharp(out.tiff).metadata();
  assert.equal(meta.format, "tiff");
  assert.equal(meta.width, 1654);
  assert.equal(meta.height, 2339);
  assert.equal(Math.round(meta.density ?? 0), 200);
  // Tag 259 (Compression) = 4: CCITT T.6, Group 4.
  assert.equal(compressionOf(out.tiff), 4);
});

test("a full page leaves no room for the signature", async () => {
  const lines = Array.from({ length: 48 }, (_, i) => `Linha ${i + 1} do ato.`);
  const out = await pdfToOnrTiff(
    await samplePdf(lines),
    await sharp({
      create: {
        width: 300,
        height: 80,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer(),
  );
  assert.equal(out.signed, false);
  assert.equal(out.noRoom, true);
});

test("the queue: newest in force, copied, hidden, zip with the folders", async () => {
  const tiff = Buffer.from("tif").toString("base64");
  const [a, b, c] = await db
    .insert(riOnrImages)
    .values([
      {
        tenantSlug: TENANT,
        number: 1,
        tiff,
        createdAt: new Date("2026-11-01"),
      },
      {
        tenantSlug: TENANT,
        number: 1,
        tiff,
        createdAt: new Date("2026-11-02"),
      },
      { tenantSlug: TENANT, number: 1234, tiff },
    ])
    .returning({ id: riOnrImages.id });
  const current = currentOf(await listOnrImagesWith(db, TENANT));
  assert.deepEqual(
    current.map((r) => r.id),
    [b?.id, c?.id],
  );
  assert.equal(await setCopiedWith(db, TENANT, [b?.id ?? ""], true, ACTOR), 1);
  const pending = await onrZipWith(db, TENANT, { onlyNotCopied: true });
  assert.equal(pending.count, 1);
  const all = await onrZipWith(db, TENANT);
  const names = Object.keys((await JSZip.loadAsync(all.bytes)).files).filter(
    (n) => !n.endsWith("/"),
  );
  assert.deepEqual(names.sort(), [
    "00000000/00000001.TIF",
    "00000001/00001234.TIF",
  ]);
  await setOnrImageDeletedWith(db, TENANT, b?.id ?? "", true, ACTOR);
  const after = currentOf(await listOnrImagesWith(db, TENANT));
  // The older one of the same number comes back into force.
  assert.ok(after.some((r) => r.id === a?.id));
});

test("applying a ficha: new matrícula, then a new averbação and a retificação", async () => {
  const tenant = "cartorio-teste-ri-acervo";
  const tiff = Buffer.from("tif").toString("base64");
  const reading = {
    book: 2,
    number: 7,
    cnm: "",
    openedOn: "2024-03-10",
    location: 0,
    denomination: "",
    street: "Rua Exemplo",
    district: "Centro",
    area: "",
    ccir: "",
    nirf: "",
    car: "",
    incra: "",
    sigef: "",
    origin: "",
    description: "Imóvel urbano na Rua Exemplo.",
    owners: [],
    notes: [],
    acts: [
      {
        kind: "AV",
        seq: 1,
        nature: "Transporte",
        effect: "outro",
        registeredOn: "2024-03-10",
        summary: "Matrícula transportada do livro antigo.",
        parties: [],
        cancelsSeq: null,
      },
    ],
  };
  const { bookSuggestion, applyOnrReadingWith } = await import(
    "./ri-onr-images.ts"
  );
  const [first] = await db
    .insert(riOnrImages)
    .values({ tenantSlug: tenant, number: 7, tiff, reading, changes: [] })
    .returning({ id: riOnrImages.id });
  const one = await applyOnrReadingWith(db, tenant, first?.id ?? "", ACTOR);
  assert.equal(one.added, 1);
  // Only the matrícula nº 1 opens the Livro 2.
  assert.equal(await bookSuggestion(db, tenant, 7, reading as never), null);
  assert.deepEqual(await bookSuggestion(db, tenant, 1, reading as never), {
    date: "2024-03-10",
    fromTransport: true,
    volume: "2",
    firstItem: 1,
  });
  const second = {
    ...reading,
    acts: [
      { ...reading.acts[0], summary: "Matrícula transportada do Livro 2-A." },
      {
        ...reading.acts[0],
        seq: 2,
        nature: "Construção",
        summary: "Averba-se a construção.",
      },
    ],
  };
  const [again] = await db
    .insert(riOnrImages)
    .values({
      tenantSlug: tenant,
      number: 7,
      tiff,
      reading: second,
      changes: [
        { kind: "retificacao", seq: 1, label: "AV-1-7" },
        { kind: "nova-averbacao", seq: 2, label: "AV-2-7" },
      ],
    })
    .returning({ id: riOnrImages.id });
  const two = await applyOnrReadingWith(db, tenant, again?.id ?? "", ACTOR);
  assert.deepEqual(two, { added: 1, retified: 1 });
  // Applying twice changes nothing.
  assert.deepEqual(
    await applyOnrReadingWith(db, tenant, again?.id ?? "", ACTOR),
    {
      added: 0,
      retified: 0,
    },
  );
});

test("the rubrica goes at the top right corner of every folha", async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage([595.28, 841.89]);
  pdf.addPage([595.28, 841.89]);
  const rubric = await sharp({
    create: {
      width: 200,
      height: 100,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  const out = await pdfToOnrTiff(await pdf.save(), null, rubric);
  assert.equal(out.pages, 2);
  for (const page of [0, 1]) {
    const { data, info } = await sharp(out.tiff, { page })
      .extract({ left: 1654 - 200, top: 70, width: 120, height: 60 })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const dark = [...data].filter((v) => v < 128).length;
    assert.ok(dark > info.width * info.height * 0.5, `folha ${page + 1}`);
  }
});
