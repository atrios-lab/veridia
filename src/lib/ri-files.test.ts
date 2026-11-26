import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import sharp from "sharp";
import { situationOf } from "@/core/ri/acts.ts";
import { fichaContent } from "@/core/ri/ficha.ts";
import { readMatriculaText } from "@/core/ri/matricula-text.ts";
import type { Database } from "@/db/index.ts";
import { riFiles } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import { loadAcervoWith, propertyDetailWith } from "./ri.ts";
import {
  addFileWith,
  applyReadingWith,
  listFilesWith,
  readMatriculaFilesWith,
  saveSignatureImageWith,
  setFileDeletedWith,
  signatureSettingsWith,
} from "./ri-files.ts";
import { fichaTiff, imageToBwTiff } from "./ri-tiff.ts";

let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

// Fictitious data only (LGPD).
const TENANT = "cartorio-teste-ri-arquivos";
const ACTOR = { id: "u-oficial" };

const TEXT = `MATRÍCULA Nº 77 - Data: 01/02/1999
IMÓVEL: Imóvel rural denominado Sítio Exemplo, com a área de 3 ha.
PROPRIETÁRIO: DORA FICTÍCIA, CPF 111.444.777-35.
R-1-77 - Em 02/02/2001. Compra e venda. ADQUIRENTE: EDU FICTÍCIO, CPF 529.982.247-25. TRANSMITENTE: DORA FICTÍCIA, CPF 111.444.777-35.
AV-2-77 - Em 03/03/2002. Averba-se a construção de uma casa.`;

test("leitura aplicada: matrícula nova com atos na numeração da ficha", async () => {
  const reading = readMatriculaText(TEXT);
  const { propertyId, acts } = await applyReadingWith(
    db,
    TENANT,
    reading,
    { propertyId: null, seqs: [1, 2] },
    ACTOR,
  );
  assert.equal(acts, 2);
  const detail = await propertyDetailWith(db, TENANT, propertyId);
  assert.equal(detail?.property.number, 77);
  assert.deepEqual(
    detail?.acts.map((a) => `${a.kind}-${a.seq}`),
    ["M-0", "R-1", "AV-2"],
  );
  const acervo = await loadAcervoWith(db, TENANT);
  const owners = situationOf(acervo.acts.get(propertyId) ?? []).owners;
  assert.deepEqual(
    owners.map((o) => o.name),
    ["EDU FICTÍCIO"],
  );
  // Applying again changes nothing: the numbers are already there.
  const again = await applyReadingWith(
    db,
    TENANT,
    reading,
    { propertyId, seqs: [1, 2] },
    ACTOR,
  );
  assert.equal(again.acts, 0);
});

test("anexo: guarda, lista, apaga só marcando e restaura", async () => {
  const acervo = await loadAcervoWith(db, TENANT);
  const propertyId = acervo.properties[0]?.id as string;
  const id = await addFileWith(
    db,
    TENANT,
    {
      propertyId,
      kind: "ficha",
      name: "ficha-77.pdf",
      mime: "application/pdf",
      size: 10,
      path: "/tmp/ficha-77.pdf",
    },
    ACTOR,
  );
  await setFileDeletedWith(db, TENANT, id, true, ACTOR);
  const [row] = await db.select().from(riFiles);
  assert.ok(row?.deletedAt);
  await setFileDeletedWith(db, TENANT, id, false, ACTOR);
  assert.equal(
    (await listFilesWith(db, TENANT, propertyId))[0]?.deletedAt,
    null,
  );
});

test("imagem da assinatura: papel fica transparente, tinta preta", async () => {
  const photo = await sharp({
    create: {
      width: 200,
      height: 80,
      channels: 3,
      background: { r: 200, g: 200, b: 190 },
    },
  })
    .composite([
      {
        input: Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><path d="M20 60 C60 10 120 10 180 50" stroke="navy" stroke-width="6" fill="none"/></svg>',
        ),
      },
    ])
    .jpeg()
    .toBuffer();
  await saveSignatureImageWith(db, TENANT, new Uint8Array(photo), ACTOR);
  const { signatureImage } = await signatureSettingsWith(db, TENANT);
  assert.ok(signatureImage);
  const meta = await sharp(signatureImage).metadata();
  assert.equal(meta.format, "png");
  assert.equal(meta.hasAlpha, true);
  await saveSignatureImageWith(db, TENANT, null, ACTOR);
  assert.equal((await signatureSettingsWith(db, TENANT)).signatureImage, null);
});

test("TIFF da matrícula: preto e branco, 1 bit, G4, 200 dpi (manual Matrícula Online), várias páginas", async () => {
  const [first] = (await loadAcervoWith(db, TENANT)).properties;
  assert.ok(first);
  const ficha = fichaContent({
    office: { name: "Cartório Exemplo", city: "Cidade Exemplo", state: "RN" },
    property: {
      ...first,
      description: "Texto fictício. ".repeat(600),
    },
    acts: [],
    signer: { name: "Oficial Fictício", title: "Oficial de Registro" },
  });
  const tif = await fichaTiff(ficha);
  const meta = await sharp(tif, { pages: -1 }).metadata();
  assert.equal(meta.format, "tiff");
  assert.ok((meta.pages ?? 1) >= 2);
  assert.equal(meta.density, 200);
  assert.equal(meta.channels, 1);
  const scan = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: { r: 240, g: 230, b: 200 },
    },
  })
    .png()
    .toBuffer();
  const bw = await sharp(await imageToBwTiff(new Uint8Array(scan))).metadata();
  assert.equal(bw.format, "tiff");
  assert.equal(bw.channels, 1);
});

test("Livro 3: a leitura do texto preenche o registro auxiliar, sem imóvel", async () => {
  const text = `REGISTRO AUXILIAR Nº 71
TÍTULO: CÉDULA DE CRÉDITO INDUSTRIAL Nº 5/2026, emitida em 02/08/2026.
EMITENTE: INDÚSTRIA FICTÍCIA LTDA, CNPJ nº 11.444.777/0001-61.
CREDOR: BANCO EXEMPLO S.A., CNPJ nº 11.222.333/0001-81.
VALOR: R$ 80.000,00.
GARANTIAS: penhor de uma prensa hidráulica fictícia.`;
  const result = await readMatriculaFilesWith(
    db,
    TENANT,
    [
      {
        name: "registro-71.txt",
        mime: "text/plain",
        bytes: new TextEncoder().encode(text),
      },
    ],
    { book: 3 },
  );
  assert.equal(result.reading.book, 3);
  assert.equal(result.reading.auxKind, "Cédula de crédito industrial");
  assert.match(result.markdown ?? "", /\*\*CREDOR:\*\*/);
  const { propertyId } = await applyReadingWith(
    db,
    TENANT,
    result.reading,
    { propertyId: null, seqs: [] },
    ACTOR,
  );
  const detail = await propertyDetailWith(db, TENANT, propertyId);
  assert.equal(detail?.property.book, 3);
  assert.equal(detail?.property.number, 71);
  assert.equal(detail?.property.location, 0);
  assert.equal(detail?.property.propertyKind, null);
  assert.equal(detail?.property.aux.valueCents, 8000000);
  assert.equal(detail?.property.aux.parties.length, 2);
});
