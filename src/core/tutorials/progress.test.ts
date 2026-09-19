import assert from "node:assert/strict";
import { test } from "node:test";
import type { Tutorial } from "./catalog.ts";
import {
  formatDuration,
  isTutorialId,
  listOrder,
  mediaHosts,
  nextUnwatched,
  trailProgress,
  tutorialForRoute,
} from "./progress.ts";

function tutorial(
  id: string,
  overrides: Partial<Omit<Tutorial, "id">> = {},
): Tutorial {
  return {
    id,
    title: id,
    description: "",
    durationSeconds: 120,
    videoUrl: `https://media.example.test/${id}.mp4`,
    captionsUrl: `https://media.example.test/${id}.vtt`,
    route: null,
    trail: true,
    ...overrides,
  };
}

const SEVEN = [
  "primeiros-passos",
  "pedidos",
  "agenda",
  "lgpd",
  "atendimento",
  "publicacoes",
  "configuracoes",
].map((id) => tutorial(id));

test("two of seven watched: progress counts them, next is the first gap", () => {
  const watched = new Set(["primeiros-passos", "agenda"]);
  assert.deepEqual(trailProgress(SEVEN, watched), { watched: 2, total: 7 });
  assert.equal(nextUnwatched(SEVEN, watched)?.id, "pedidos");
});

test("a video outside the trail neither counts nor keeps the trail open", () => {
  const catalog = [...SEVEN, tutorial("adequacao-avancado", { trail: false })];
  const watched = new Set(SEVEN.map((t) => t.id));
  assert.deepEqual(trailProgress(catalog, watched), { watched: 7, total: 7 });
  assert.equal(nextUnwatched(catalog, watched), undefined);
});

test("empty catalog: nothing to do, nothing next", () => {
  assert.deepEqual(trailProgress([], new Set()), { watched: 0, total: 0 });
  assert.equal(nextUnwatched([], new Set()), undefined);
});

test("list order is the trail first, then the rest, each in catalog order", () => {
  const catalog = [
    tutorial("a", { trail: false }),
    tutorial("b"),
    tutorial("c", { trail: false }),
    tutorial("d"),
  ];
  assert.deepEqual(
    listOrder(catalog).map((t) => t.id),
    ["b", "d", "a", "c"],
  );
});

test("a route covers itself and its subordinates", () => {
  const catalog = [tutorial("pedidos", { route: "/admin/pedidos" })];
  assert.equal(tutorialForRoute(catalog, "/admin/pedidos")?.id, "pedidos");
  assert.equal(tutorialForRoute(catalog, "/admin/pedidos/novo")?.id, "pedidos");
  assert.equal(
    tutorialForRoute(catalog, "/admin/pedidos/REQ.2026.000001")?.id,
    "pedidos",
  );
  // A prefix of the path, not of the string: /admin/pedidosx is another screen.
  assert.equal(tutorialForRoute(catalog, "/admin/pedidosx"), undefined);
  assert.equal(tutorialForRoute(catalog, "/admin/usuarios"), undefined);
});

test("the panel root covers only itself", () => {
  const catalog = [tutorial("primeiros-passos", { route: "/admin" })];
  assert.equal(tutorialForRoute(catalog, "/admin")?.id, "primeiros-passos");
  assert.equal(tutorialForRoute(catalog, "/admin/usuarios"), undefined);
});

test("the most specific route wins", () => {
  const catalog = [
    tutorial("configuracoes", { route: "/admin/configuracoes" }),
    tutorial("cobranca", {
      route: "/admin/configuracoes/cobranca",
      trail: false,
    }),
  ];
  assert.equal(
    tutorialForRoute(catalog, "/admin/configuracoes/cobranca")?.id,
    "cobranca",
  );
  assert.equal(
    tutorialForRoute(catalog, "/admin/configuracoes/encarregado")?.id,
    "configuracoes",
  );
});

test("a video with no route never claims a screen", () => {
  const catalog = [tutorial("primeiros-passos", { route: null })];
  assert.equal(tutorialForRoute(catalog, "/admin"), undefined);
});

test("media hosts are listed once each, video and captions alike", () => {
  const catalog = [
    tutorial("a"),
    tutorial("b", {
      captionsUrl: "https://captions.example.test/b.vtt",
    }),
  ];
  assert.deepEqual(mediaHosts(catalog), [
    "media.example.test",
    "captions.example.test",
  ]);
  assert.deepEqual(mediaHosts([]), []);
});

test("an id is only known when the catalog has it", () => {
  assert.ok(isTutorialId(SEVEN, "agenda"));
  assert.ok(!isTutorialId(SEVEN, "nao-existe"));
});

test("duration reads in minutes past the first one", () => {
  assert.equal(formatDuration(45), "45 s");
  assert.equal(formatDuration(60), "1 min");
  assert.equal(formatDuration(250), "4 min");
});
