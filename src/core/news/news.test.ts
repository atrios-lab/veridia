import assert from "node:assert/strict";
import { test } from "node:test";
import {
  categoryLabel,
  checkNewsFile,
  NEWS_CATEGORIES,
  NewsInputSchema,
  type NewsRecord,
  newestFirst,
  publicNews,
} from "./news.ts";

// Fictitious posts only.
const post = (over: Partial<NewsRecord> = {}): NewsRecord => ({
  id: "n1",
  title: "Casamento comunitário de exemplo",
  category: "casamento-comunitario",
  eventDate: "2026-11-14",
  summary: "Cerimônia coletiva de exemplo na praça da cidade fictícia.",
  body: "",
  published: true,
  publishedAt: "2026-11-10T12:00:00.000Z",
  imageConsent: true,
  archived: false,
  files: [
    { id: "f1", kind: "photo", name: "a.jpg", position: 2 },
    { id: "f2", kind: "photo", name: "b.jpg", position: 1 },
    { id: "f3", kind: "pdf", name: "cartaz.pdf", position: 3 },
  ],
  ...over,
});

const png = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0,
]);
const pdf = Uint8Array.from([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0, 0, 0, 0, 0, 0,
]);

test("os tipos de notícia cobrem casamento comunitário, evento social e correição", () => {
  assert.deepEqual(
    NEWS_CATEGORIES.map((c) => c.label),
    ["Casamento comunitário", "Evento social", "Correição", "Outras notícias"],
  );
  assert.equal(categoryLabel("correicao"), "Correição");
  // An unknown id never breaks the page.
  assert.equal(categoryLabel("sumiu"), "Outras notícias");
});

test("o formulário da notícia é conferido", () => {
  const base = {
    title: "  Evento social de exemplo ",
    category: "evento-social",
    eventDate: "",
    summary: "Uma tarde de conversa com a comunidade fictícia.",
    body: "",
    imageConsent: false,
    published: false,
  };
  const ok = NewsInputSchema.safeParse(base);
  assert.equal(ok.success, true);
  assert.equal(ok.success && ok.data.title, "Evento social de exemplo");
  for (const bad of [
    { ...base, title: "ab" },
    { ...base, category: "propaganda" },
    { ...base, eventDate: "14/11/2026" },
    { ...base, summary: "curto" },
    { ...base, summary: "x".repeat(281) },
    { ...base, body: "x".repeat(5001) },
  ]) {
    assert.equal(NewsInputSchema.safeParse(bad).success, false);
  }
});

test("o visitante só vê a notícia publicada e não arquivada, e a foto só com autorização", () => {
  const seen = publicNews(post());
  assert.deepEqual(seen?.photos, ["f2", "f1"]); // by position
  assert.deepEqual(seen?.pdf, { id: "f3", name: "cartaz.pdf" });
  assert.equal(seen?.categoryLabel, "Casamento comunitário");
  // Without the authorisation: no photo, the rest stays.
  const semFoto = publicNews(post({ imageConsent: false }));
  assert.deepEqual(semFoto?.photos, []);
  assert.equal(semFoto?.pdf?.id, "f3");
  // A draft and an archived post are not on the site.
  assert.equal(publicNews(post({ published: false })), null);
  assert.equal(publicNews(post({ archived: true })), null);
});

test("as mais novas primeiro: pelo dia do evento, senão pelo dia em que foram ao site", () => {
  const list = newestFirst([
    { title: "B", eventDate: "2026-10-01", publishedAt: null },
    { title: "A", eventDate: null, publishedAt: "2026-11-15T10:00:00.000Z" },
    { title: "C", eventDate: "2026-11-20", publishedAt: null },
    { title: "D", eventDate: "2026-10-01", publishedAt: null },
  ]);
  assert.deepEqual(
    list.map((p) => p.title),
    ["C", "A", "B", "D"],
  );
});

test("os arquivos são conferidos pelo conteúdo, não pelo nome", () => {
  assert.deepEqual(checkNewsFile("photo", png, "foto.png"), {
    ok: true,
    type: "png",
  });
  assert.deepEqual(checkNewsFile("pdf", pdf, "cartaz.pdf"), {
    ok: true,
    type: "pdf",
  });
  // A PDF renamed as a photo, and the other way round.
  assert.equal(checkNewsFile("photo", pdf, "foto.png").ok, false);
  assert.equal(checkNewsFile("pdf", png, "cartaz.pdf").ok, false);
  assert.equal(checkNewsFile("photo", new Uint8Array(0), "a.png").ok, false);
  const big = new Uint8Array(3 * 1024 * 1024 + 1);
  big.set(png);
  const tooBig = checkNewsFile("photo", big, "a.png");
  assert.equal(tooBig.ok, false);
  assert.match(!tooBig.ok ? tooBig.message : "", /3 MB/);
});
