import assert from "node:assert/strict";
import { test } from "node:test";
import { SERVICE_REQUEST_STATUSES } from "../../../../../core/request/kinds.ts";
import {
  clampPage,
  compareQueueRows,
  PAGE_GAP,
  pageSlice,
  pageWindow,
  QUEUE_TABS,
  type QueueRowOrder,
  queueHref,
  queueSearchParams,
  queueTabOf,
} from "./queue-order.ts";

const day = (n: number) => new Date(2026, 8, n);

test("every andamento belongs to exactly one tab", () => {
  for (const status of SERVICE_REQUEST_STATUSES) {
    const owners = QUEUE_TABS.filter((t) => t.statuses.includes(status));
    assert.equal(owners.length, 1, `aba de ${status}`);
    assert.equal(queueTabOf(status), owners[0].id);
  }
});

test("the endings share Finalizados; payment reported has a tab of its own", () => {
  assert.equal(queueTabOf("done"), "closed");
  assert.equal(queueTabOf("rejected"), "closed");
  assert.equal(queueTabOf("cancelled"), "closed");
  assert.equal(queueTabOf("archived"), "closed");
  assert.equal(queueTabOf("payment-reported"), "payment-reported");
  assert.notEqual(queueTabOf("payment-reported"), queueTabOf("paid"));
  assert.notEqual(
    queueTabOf("payment-reported"),
    queueTabOf("awaiting-payment"),
  );
});

test("the URL is validated, with defaults for whatever it got wrong", () => {
  assert.deepEqual(queueSearchParams({}), {
    tab: "new",
    attribution: undefined,
    search: undefined,
    page: 1,
    size: 10,
  });
  assert.equal(queueSearchParams({ aba: "qualquer" }).tab, "new");
  assert.equal(queueSearchParams({ aba: "closed" }).tab, "closed");
  assert.equal(queueSearchParams({ por: "30" }).size, 10);
  assert.equal(queueSearchParams({ por: "25" }).size, 25);
  assert.equal(queueSearchParams({ pagina: "0" }).page, 1);
  assert.equal(queueSearchParams({ pagina: "abc" }).page, 1);
  assert.equal(queueSearchParams({ pagina: "4" }).page, 4);
  assert.equal(queueSearchParams({ q: "  " }).search, undefined);
  assert.equal(queueSearchParams({ q: " Rosa " }).search, "Rosa");
  // Only the tenant's own attributions filter; another one is ignored.
  assert.equal(
    queueSearchParams({ atribuicao: "RI" }, ["RCPN", "NOTAS"]).attribution,
    undefined,
  );
  assert.equal(
    queueSearchParams({ atribuicao: "RCPN" }, ["RCPN", "NOTAS"]).attribution,
    "RCPN",
  );
});

test("a page past the end lands on the last page", () => {
  assert.equal(clampPage(5, 12, 10), 2);
  assert.equal(clampPage(2, 12, 10), 2);
  assert.equal(clampPage(1, 0, 10), 1);
  assert.equal(clampPage(0, 30, 10), 1);
});

test("pageSlice takes one page of an already sorted list", () => {
  const rows = Array.from({ length: 29 }, (_, i) => i + 1);
  assert.deepEqual(pageSlice(rows, 1, 10), rows.slice(0, 10));
  assert.deepEqual(
    pageSlice(rows, 3, 10),
    [21, 22, 23, 24, 25, 26, 27, 28, 29],
  );
  assert.deepEqual(pageSlice(rows, 4, 10), []);
});

test("queueHref leaves defaults out and resets the page on a tab, filter or size change", () => {
  const current = queueSearchParams({ aba: "paid", pagina: "3", por: "25" });
  assert.equal(queueHref(current), "/admin/pedidos?aba=paid&por=25&pagina=3");
  assert.equal(
    queueHref(current, { page: 2 }),
    "/admin/pedidos?aba=paid&por=25&pagina=2",
  );
  assert.equal(queueHref(current, { tab: "new" }), "/admin/pedidos?por=25");
  assert.equal(
    queueHref(current, { attribution: "RCPN" }),
    "/admin/pedidos?aba=paid&atribuicao=RCPN&por=25",
  );
  assert.equal(
    queueHref(current, { search: "Rosa" }),
    "/admin/pedidos?aba=paid&q=Rosa&por=25",
  );
  assert.equal(queueHref(current, { size: 10 }), "/admin/pedidos?aba=paid");
  // "Limpar" keeps the tab and drops filter and search.
  const filtered = queueSearchParams({ aba: "paid", atribuicao: "RI", q: "x" });
  assert.equal(
    queueHref(filtered, { attribution: undefined, search: undefined }),
    "/admin/pedidos?aba=paid",
  );
});

test("pageWindow shows every page up to seven, then a window with gaps", () => {
  assert.deepEqual(pageWindow(2, 7), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(pageWindow(6, 12), [1, PAGE_GAP, 5, 6, 7, PAGE_GAP, 12]);
  assert.deepEqual(pageWindow(1, 12), [1, 2, 3, 4, 5, PAGE_GAP, 12]);
  assert.deepEqual(pageWindow(12, 12), [1, PAGE_GAP, 8, 9, 10, 11, 12]);
  assert.deepEqual(pageWindow(1, 1), [1]);
});

test("inside a tab: the latest term first, then the closest, then arrival order", () => {
  const rows: QueueRowOrder[] = [
    { urgency: { kind: "running" }, createdAt: day(5) },
    { urgency: { kind: "running" }, createdAt: day(2) },
    { urgency: { kind: "due-soon", daysLeft: 1 }, createdAt: day(8) },
    { urgency: { kind: "due-soon", daysLeft: 3 }, createdAt: day(1) },
    { urgency: { kind: "overdue", daysLate: 3 }, createdAt: day(7) },
    { urgency: { kind: "overdue", daysLate: 7 }, createdAt: day(6) },
  ];
  assert.deepEqual(
    [...rows].sort(compareQueueRows).map((r) => r.createdAt.getDate()),
    [6, 7, 8, 1, 2, 5],
  );
});

test("paused rows sit between the urgent and the quiet, longest wait first", () => {
  const rows: QueueRowOrder[] = [
    { urgency: { kind: "running" }, createdAt: day(1) },
    { urgency: { kind: "paused", waitingDays: 2 }, createdAt: day(2) },
    { urgency: { kind: "overdue", daysLate: 1 }, createdAt: day(3) },
    { urgency: { kind: "paused", waitingDays: 8 }, createdAt: day(4) },
    { urgency: { kind: "due-soon", daysLeft: 2 }, createdAt: day(5) },
  ];
  assert.deepEqual(
    [...rows].sort(compareQueueRows).map((r) => r.createdAt.getDate()),
    [3, 5, 4, 2, 1],
  );
});
