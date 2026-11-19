import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { MAX_PHOTOS, type NewsInput } from "@/core/news/news.ts";
import type { Database } from "@/db/index.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  addFileWith,
  archiveNewsWith,
  createNewsWith,
  listNewsWith,
  NewsError,
  newsFileWith,
  publicNewsOneWith,
  publicNewsWith,
  removeFileWith,
  restoreNewsWith,
  updateNewsWith,
} from "./news.ts";

// Fictitious office and posts only.
const OFFICE = "cartorio-mural";
const OTHER = "cartorio-vizinho";
const ACTOR = "tabeliao";
let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

const input = (over: Partial<NewsInput> = {}): NewsInput => ({
  title: "Casamento comunitário de exemplo",
  category: "casamento-comunitario",
  eventDate: "2026-11-14",
  summary: "Cerimônia coletiva de exemplo na praça da cidade fictícia.",
  body: "Texto de exemplo.",
  imageConsent: true,
  published: true,
  ...over,
});

const file = (name: string, mime = "image/jpeg") => ({
  path: `/tmp/${name}`,
  name,
  mime,
});

test("a notícia só aparece no site depois de publicada, e cada cartório vê as suas", async () => {
  const draft = await createNewsWith(
    db,
    OFFICE,
    input({ title: "Rascunho de exemplo", published: false }),
    ACTOR,
  );
  const live = await createNewsWith(db, OFFICE, input(), ACTOR);
  await createNewsWith(db, OTHER, input({ title: "De outro cartório" }), ACTOR);
  const titles = (await publicNewsWith(db, OFFICE)).map((p) => p.title);
  assert.deepEqual(titles, ["Casamento comunitário de exemplo"]);
  assert.equal(await publicNewsOneWith(db, OFFICE, draft), null);
  assert.ok(await publicNewsOneWith(db, OFFICE, live));
  // A post of another office cannot be reached by id.
  assert.equal(await publicNewsOneWith(db, OTHER, live), null);
  await assert.rejects(
    updateNewsWith(db, OTHER, live, input(), ACTOR),
    /não encontrada/,
  );
  // Publishing the draft puts it on the site and sets the first day.
  await updateNewsWith(
    db,
    OFFICE,
    draft,
    input({ title: "Rascunho de exemplo" }),
    ACTOR,
  );
  const [row] = (await listNewsWith(db, OFFICE)).filter((p) => p.id === draft);
  assert.ok(row?.publishedAt);
  assert.equal((await publicNewsWith(db, OFFICE)).length, 2);
  // Taking it off the site keeps it in the panel.
  await updateNewsWith(
    db,
    OFFICE,
    draft,
    input({ title: "Rascunho de exemplo", published: false }),
    ACTOR,
  );
  assert.equal((await publicNewsWith(db, OFFICE)).length, 1);
  assert.equal((await listNewsWith(db, OFFICE)).length, 2);
  await assert.rejects(
    createNewsWith(db, OFFICE, input({ summary: "curto" }), ACTOR),
    NewsError,
  );
});

test("fotos e PDF: limite, troca do PDF e o que o visitante pode abrir", async () => {
  const office = "cartorio-arquivos";
  const id = await createNewsWith(db, office, input(), ACTOR);
  const first = await addFileWith(
    db,
    office,
    id,
    "photo",
    file("a.jpg"),
    ACTOR,
  );
  assert.equal(first, null);
  await addFileWith(
    db,
    office,
    id,
    "pdf",
    file("v1.pdf", "application/pdf"),
    ACTOR,
  );
  // A new PDF replaces the old one and says which path to remove.
  const replaced = await addFileWith(
    db,
    office,
    id,
    "pdf",
    file("v2.pdf", "application/pdf"),
    ACTOR,
  );
  assert.equal(replaced, "/tmp/v1.pdf");
  let post = (await listNewsWith(db, office))[0];
  assert.deepEqual(
    post?.files.map((f) => f.name),
    ["a.jpg", "v2.pdf"],
  );

  const photoId = post?.files.find((f) => f.kind === "photo")?.id ?? "";
  const pdfId = post?.files.find((f) => f.kind === "pdf")?.id ?? "";
  assert.ok(await newsFileWith(db, office, photoId, { publicOnly: true }));
  assert.ok(await newsFileWith(db, office, pdfId, { publicOnly: true }));
  // Other office: nothing.
  assert.equal(
    await newsFileWith(db, OTHER, photoId, { publicOnly: true }),
    null,
  );

  // Withdrawing the image authorisation takes the photos off the site at
  // once, and the PDF stays.
  await updateNewsWith(db, office, id, input({ imageConsent: false }), ACTOR);
  assert.equal(
    await newsFileWith(db, office, photoId, { publicOnly: true }),
    null,
  );
  assert.ok(await newsFileWith(db, office, photoId, { publicOnly: false }));
  assert.ok(await newsFileWith(db, office, pdfId, { publicOnly: true }));

  // Taking a file off keeps the row, returns the path, and the file is gone.
  assert.equal(
    await removeFileWith(db, office, id, pdfId, ACTOR),
    "/tmp/v2.pdf",
  );
  assert.equal(await removeFileWith(db, office, id, pdfId, ACTOR), null);
  assert.equal(
    await newsFileWith(db, office, pdfId, { publicOnly: false }),
    null,
  );
  post = (await listNewsWith(db, office))[0];
  assert.deepEqual(
    post?.files.map((f) => f.name),
    ["a.jpg"],
  );

  // The limit of photos.
  for (let i = 1; i < MAX_PHOTOS; i++) {
    await addFileWith(db, office, id, "photo", file(`p${i}.jpg`), ACTOR);
  }
  await assert.rejects(
    addFileWith(db, office, id, "photo", file("extra.jpg"), ACTOR),
    /até 8 fotos/,
  );
});

test("arquivar tira do site e do painel, sem apagar, e dá para voltar", async () => {
  const office = "cartorio-arquivar";
  const id = await createNewsWith(db, office, input(), ACTOR);
  await addFileWith(db, office, id, "photo", file("a.jpg"), ACTOR);
  const fileId = (await listNewsWith(db, office))[0]?.files[0]?.id ?? "";
  await archiveNewsWith(db, office, id, ACTOR);
  assert.deepEqual(await publicNewsWith(db, office), []);
  assert.equal((await listNewsWith(db, office)).length, 0);
  assert.equal((await listNewsWith(db, office, { archived: true })).length, 1);
  assert.equal(
    await newsFileWith(db, office, fileId, { publicOnly: true }),
    null,
  );
  await restoreNewsWith(db, office, id, ACTOR);
  assert.equal((await publicNewsWith(db, office)).length, 1);
  assert.ok(await newsFileWith(db, office, fileId, { publicOnly: true }));
});
